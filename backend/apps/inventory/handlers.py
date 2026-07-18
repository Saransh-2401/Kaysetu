"""
Event subscriptions INV sets up — INV is the stock authority, so it reacts to
what the operational modules announce, without either side importing the other:

  * ORDERS emits `orders.dispatched`       -> deduct stock (+ release reservation)
  * DIST   emits `dist.stock_dispatched`   -> deduct stock (distributor channel)
  * PROD   emits `prod.materials_consumed` -> deduct raw materials
  * PURCH  emits `purchase.goods_received` -> add received stock
  * PROD   emits `prod.goods_produced`     -> add finished goods

All are gated on the INV entitlement, so a tenant without INV ignores them.

EVERY handler applies its whole payload in ONE transaction. That matters twice
over: stock can never end up half-applied against a document the emitter already
considers complete, and — because a failed delivery therefore changed nothing —
the outbox can safely replay it, applying the effect exactly once.
"""


def _inv_entitled() -> bool:
    from apps.foundation.models import EntitlementSnapshot

    return "INV" in EntitlementSnapshot.current_modules()


def _tenant_atomic():
    from django.db import transaction

    from apps.tenancy.context import require_tenant
    from apps.tenancy.db import ensure_alias

    return transaction.atomic(using=ensure_alias(require_tenant()))


def _lines(payload):
    return [ln for ln in payload.get("items", []) if ln.get("item_id") is not None]


def _issue_all(payload, reference_key):
    """Deduct every line of a dispatch/consumption in a single transaction."""
    if not _inv_entitled():
        return
    lines = _lines(payload)
    if not lines:
        return

    from . import services

    reference = payload.get(reference_key, "")
    with _tenant_atomic():
        for line in lines:
            services.issue_for_dispatch(line["item_id"], line.get("quantity", 0),
                                        reference=reference)


def _receive_all(payload, reference_key):
    """Receive every line of a GRN/production run in a single transaction."""
    if not _inv_entitled():
        return
    lines = _lines(payload)
    if not lines:
        return

    from .models import Warehouse
    from . import services

    reference = payload.get(reference_key, "")
    with _tenant_atomic():
        warehouse = None
        warehouse_id = payload.get("warehouse_id")
        if warehouse_id:
            warehouse = Warehouse.objects.filter(pk=warehouse_id).first()
        if warehouse is None:
            warehouse = services.default_warehouse()

        for line in lines:
            services.receive_stock(line["item_id"], warehouse, line.get("quantity", 0),
                                   rate=line.get("rate", 0), reference=reference)


def _on_order_dispatched(**payload):
    _issue_all(payload, "order_number")


def _on_dist_dispatched(**payload):
    _issue_all(payload, "request_number")


def _on_materials_consumed(**payload):
    _issue_all(payload, "order_number")


def _on_goods_received(**payload):
    _receive_all(payload, "receipt_number")


def _on_goods_produced(**payload):
    _receive_all(payload, "order_number")


def register_all():
    from apps.foundation.integration import events

    events.subscribe("orders.dispatched", _on_order_dispatched)
    events.subscribe("purchase.goods_received", _on_goods_received)
    events.subscribe("dist.stock_dispatched", _on_dist_dispatched)
    events.subscribe("prod.materials_consumed", _on_materials_consumed)
    events.subscribe("prod.goods_produced", _on_goods_produced)
