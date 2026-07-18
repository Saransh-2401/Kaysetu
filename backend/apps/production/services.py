"""
PROD domain services. A work order explodes its BOM to the planned quantity;
completing it consumes raw materials and yields finished goods — both handed to
INV by event, never by import.
"""
import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.foundation.integration import capabilities, events
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import BillOfMaterials, BOMItem, WorkOrder, WorkOrderMaterial

logger = logging.getLogger("salexa.production")

CENT = Decimal("0.01")
QTY = Decimal("0.001")
MAX_AMOUNT = Decimal("99999999.99")


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))


def _num(prefix):
    import secrets

    return f"{prefix}-{timezone.now().strftime('%y%m%d%H%M%S%f')}-{secrets.token_hex(2)}"


def _dec(value, field):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field: f"invalid number: {value!r}"})
    if not parsed.is_finite():
        raise ValidationError({field: f"invalid number: {value!r}"})
    return parsed


def _catalog_item(item_id, field="item"):
    from apps.foundation.models import CatalogItem

    if item_id in (None, ""):
        raise ValidationError({field: "an item is required."})
    item = CatalogItem.objects.filter(pk=item_id).first()
    if item is None:
        raise ValidationError({field: f"unknown item {item_id}."})
    return item


# ---------------------------------------------------------------------- BOM
def create_bom(*, item_id, materials, output_quantity=1, notes=""):
    finished = _catalog_item(item_id)
    output = _dec(output_quantity, "output_quantity")
    if output <= 0:
        raise ValidationError({"output_quantity": "must be greater than zero."})

    prepared, cost = [], Decimal("0")
    seen = set()
    for line in materials or []:
        raw = _catalog_item(line.get("raw_material"), "raw_material")
        if raw.pk == finished.pk:
            raise ValidationError({"raw_material": "an item cannot be a material of itself."})
        if raw.pk in seen:
            raise ValidationError({"materials": f"{raw.name} is listed more than once."})
        seen.add(raw.pk)
        qty = _dec(line.get("quantity", 0), "quantity")
        if qty <= 0:
            raise ValidationError({"quantity": "must be greater than zero."})
        rate = _dec(line.get("rate", raw.price or 0), "rate")
        amount = (qty * rate).quantize(CENT)
        if amount > MAX_AMOUNT:
            raise ValidationError({"amount": "line amount exceeds the maximum allowed."})
        cost += amount
        prepared.append((raw, qty, rate, amount))
    if not prepared:
        raise ValidationError({"materials": "a BOM needs at least one material."})

    with _tenant_atomic():
        bom = BillOfMaterials.objects.create(
            number=_num("BOM"), item=finished, output_quantity=output,
            material_cost=cost, notes=notes,
        )
        for raw, qty, rate, amount in prepared:
            BOMItem.objects.create(bom=bom, raw_material=raw, material_name=raw.name,
                                   quantity=qty, rate=rate, amount=amount)
    return bom


# --------------------------------------------------------------- work orders
def create_work_order(*, bom, planned_quantity, start_date=None, end_date=None,
                      warehouse_id=None, notes=""):
    """Explode the BOM to the planned quantity into WorkOrderMaterial lines."""
    if not bom.is_active:
        raise ValidationError({"bom": "that bill of materials is inactive."})
    planned = _dec(planned_quantity, "planned_quantity")
    if planned <= 0:
        raise ValidationError({"planned_quantity": "must be greater than zero."})

    factor = planned / bom.output_quantity
    with _tenant_atomic():
        order = WorkOrder.objects.create(
            number=_num("WO"), bom=bom, item=bom.item, planned_quantity=planned,
            start_date=start_date, end_date=end_date, warehouse_id=warehouse_id, notes=notes,
        )
        for line in bom.materials.all():
            WorkOrderMaterial.objects.create(
                work_order=order, raw_material=line.raw_material,
                material_name=line.material_name or line.raw_material.name,
                required_quantity=(line.quantity * factor).quantize(QTY),
            )
    events.emit("prod.order_created", order_id=order.pk, item_id=bom.item_id, quantity=str(planned))
    return order


_TRANSITIONS = {
    WorkOrder.Status.DRAFT: {WorkOrder.Status.RELEASED, WorkOrder.Status.CANCELLED},
    WorkOrder.Status.RELEASED: {WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.CANCELLED},
    WorkOrder.Status.IN_PROGRESS: {WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED},
    WorkOrder.Status.COMPLETED: set(),
    WorkOrder.Status.CANCELLED: set(),
}


def _guard(order, target):
    if target not in _TRANSITIONS.get(order.status, set()):
        raise ValidationError(f"Cannot move a {order.get_status_display()} work order to {target}.")


def release_order(order):
    """Release for production, recording raw-material availability from INV so a
    shortage is visible BEFORE the floor starts."""
    stock_of = capabilities.get("inventory.stock_of")
    with _tenant_atomic():
        locked = WorkOrder.objects.select_for_update().get(pk=order.pk)
        _guard(locked, WorkOrder.Status.RELEASED)
        shortage = False
        for line in locked.materials.select_for_update():
            if stock_of is not None:
                available = _dec(stock_of(line.raw_material_id), "stock")
                line.available_at_release = available
                line.save(update_fields=["available_at_release"])
                shortage = shortage or available < line.required_quantity
        locked.status = WorkOrder.Status.RELEASED
        locked.has_shortage = shortage
        locked.save(update_fields=["status", "has_shortage", "updated_at"])
    order.refresh_from_db()
    return order


def start_order(order):
    with _tenant_atomic():
        locked = WorkOrder.objects.select_for_update().get(pk=order.pk)
        _guard(locked, WorkOrder.Status.IN_PROGRESS)
        locked.status = WorkOrder.Status.IN_PROGRESS
        locked.start_date = locked.start_date or timezone.localdate()
        locked.save(update_fields=["status", "start_date", "updated_at"])
    order.refresh_from_db()
    return order


def cancel_order(order):
    with _tenant_atomic():
        locked = WorkOrder.objects.select_for_update().get(pk=order.pk)
        _guard(locked, WorkOrder.Status.CANCELLED)
        locked.status = WorkOrder.Status.CANCELLED
        locked.save(update_fields=["status", "updated_at"])
    order.refresh_from_db()
    return order


def complete_order(order, *, produced_quantity=None, consumption=None):
    """Finish the run: consume raw materials and yield finished goods.

    Consumption defaults to the exploded requirement scaled to what was actually
    produced; an explicit {raw_material_id: qty} map overrides it (wastage, etc).
    Both movements are handed to INV by event — PROD never touches stock.
    """
    overrides = {}
    for key, value in (consumption or {}).items():
        try:
            overrides[int(key)] = _dec(value, "consumed_quantity")
        except (TypeError, ValueError):
            raise ValidationError({"consumption": f"invalid material key {key!r}."})

    with _tenant_atomic():
        locked = WorkOrder.objects.select_for_update().get(pk=order.pk)
        _guard(locked, WorkOrder.Status.COMPLETED)
        produced = (_dec(produced_quantity, "produced_quantity")
                    if produced_quantity is not None else locked.planned_quantity)
        if produced <= 0:
            raise ValidationError({"produced_quantity": "must be greater than zero."})
        if produced > locked.planned_quantity:
            raise ValidationError(
                {"produced_quantity": f"exceeds the planned {locked.planned_quantity}."}
            )
        # scale the recipe to the actual yield
        yield_factor = produced / locked.planned_quantity

        consumed_payload = []
        for line in locked.materials.select_for_update():
            if line.raw_material_id in overrides:
                used = overrides[line.raw_material_id]
            else:
                used = (line.required_quantity * yield_factor).quantize(QTY)
            if used < 0:
                raise ValidationError({"consumption": "quantities cannot be negative."})
            line.consumed_quantity = used
            line.save(update_fields=["consumed_quantity"])
            if used > 0:
                consumed_payload.append({"item_id": line.raw_material_id, "quantity": str(used)})

        locked.produced_quantity = produced
        locked.status = WorkOrder.Status.COMPLETED
        locked.end_date = locked.end_date or timezone.localdate()
        locked.save(update_fields=["produced_quantity", "status", "end_date", "updated_at"])
        number, item_id, warehouse_id = locked.number, locked.item_id, locked.warehouse_id
        unit_cost = (locked.bom.material_cost / locked.bom.output_quantity
                     if locked.bom.output_quantity else Decimal("0"))

        # INV subscribes to both (entitlement-gated there): raw stock out,
        # finished in. Emitted INSIDE the transaction so a completed run can
        # never lose half its stock movements — and a rolled-back one moves none.
        if consumed_payload:
            events.emit("prod.materials_consumed", order_id=locked.pk, order_number=number,
                        items=consumed_payload)
        events.emit(
            "prod.goods_produced", order_id=locked.pk, order_number=number,
            warehouse_id=warehouse_id,
            items=[{"item_id": item_id, "quantity": str(produced), "rate": str(unit_cost)}],
        )
    order.refresh_from_db()
    return order
