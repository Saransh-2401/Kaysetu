"""
ORDERS domain services. Cross-module reads via the capability registry
(inventory stock checks when INV is present); effects emitted as events
(orders.invoice_issued -> BOOKS). Imports only foundation.
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.foundation.integration import capabilities, events
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import DeliveryNote, Invoice, Payment, PickList, SalesOrder, SalesOrderItem, StatusLog


def _num(prefix):
    return prefix + "-" + timezone.now().strftime("%y%m%d%H%M%S%f")[:16]


def create_order(*, customer_id, order_date, items, assigned_agent=None, source=SalesOrder.Source.MANUAL,
                 field_order_id=None, notes="", advance_amount=0) -> SalesOrder:
    """Create a sales order + items, recompute totals server-side. Idempotent on
    field_order_id (an event replay won't duplicate)."""
    if field_order_id is not None:
        existing = SalesOrder.objects.filter(field_order_id=field_order_id).first()
        if existing:
            return existing

    subtotal = tax_total = Decimal("0")
    prepared = []
    for line in items:
        qty = Decimal(str(line.get("quantity", 1)))
        rate = Decimal(str(line.get("rate", 0)))
        tax_rate = Decimal(str(line.get("tax_rate", 0)))
        amount = Decimal(str(line.get("amount", (qty * rate).quantize(Decimal("0.01")))))
        subtotal += amount
        tax_total += (amount * tax_rate / 100).quantize(Decimal("0.01"))
        prepared.append((line, qty, rate, tax_rate, amount))

    with transaction.atomic(using=ensure_alias(require_tenant())):
        order = SalesOrder.objects.create(
            order_number=_num("SO"), customer_id=customer_id,
            assigned_agent=assigned_agent, order_date=order_date, source=source,
            field_order_id=field_order_id, subtotal=subtotal, tax_amount=tax_total,
            total=subtotal + tax_total, advance_amount=Decimal(str(advance_amount)),
            notes=notes,
        )
        for line, qty, rate, tax_rate, amount in prepared:
            SalesOrderItem.objects.create(
                order=order, item_id=line.get("item", line.get("item_id")),
                item_name=line.get("item_name", ""), quantity=qty, rate=rate,
                tax_rate=tax_rate, amount=amount,
            )
        StatusLog.objects.create(order=order, to_status=order.status, note=f"created ({source})")
    events.emit("orders.order_created", order_id=order.pk, source=source)
    return order


def _transition(order: SalesOrder, to_status: str, actor=None, note="") -> SalesOrder:
    old = order.status
    order.status = to_status
    order.save(update_fields=["status", "updated_at"])
    StatusLog.objects.create(
        order=order, from_status=old, to_status=to_status,
        actor_name=getattr(actor, "full_name", ""), note=note,
    )
    return order


def confirm_order(order: SalesOrder, actor=None) -> SalesOrder:
    """Approve a processing order. If the INV module is present, reserve stock
    through its capability (no-op / warning-free when INV is absent)."""
    for line in order.items.all():
        # Prepared seam: INV provides this when installed; None otherwise.
        capabilities.call("inventory.reserve", line.item_id, float(line.quantity), default=None)
    _transition(order, SalesOrder.Status.CONFIRMED, actor, "confirmed")
    events.emit("orders.order_confirmed", order_id=order.pk)
    return order


def stock_warnings(order: SalesOrder) -> list:
    """Per-line shortfall warnings, only when INV is installed (else empty)."""
    warnings = []
    for line in order.items.all():
        on_hand = capabilities.call("inventory.stock_of", line.item_id, default=None)
        if on_hand is not None and on_hand < float(line.quantity):
            warnings.append({"item": line.item_name, "needed": float(line.quantity), "on_hand": on_hand})
    return warnings


def make_pick_list(order: SalesOrder, picker=None) -> PickList:
    pl = PickList.objects.create(order=order, picker=picker)
    if order.status == SalesOrder.Status.CONFIRMED:
        _transition(order, SalesOrder.Status.PACKED, note="pick list created")
    return pl


def make_delivery_note(order: SalesOrder, **fields) -> DeliveryNote:
    dn = DeliveryNote.objects.create(order=order, note_number=_num("DN"), **fields)
    _transition(order, SalesOrder.Status.IN_TRANSIT, note="delivery note created")
    events.emit("orders.dispatched", order_id=order.pk)
    return dn


def mark_delivered(order: SalesOrder, actor=None) -> SalesOrder:
    _transition(order, SalesOrder.Status.DELIVERED, actor, "delivered")
    events.emit("orders.delivered", order_id=order.pk)
    return order


def issue_invoice(order: SalesOrder) -> Invoice:
    invoice = Invoice.objects.create(
        order=order, invoice_number=_num("INV"), invoice_date=timezone.localdate(), total=order.total,
    )
    # BOOKS subscribes to post this to the ledger when present.
    events.emit(
        "orders.invoice_issued",
        invoice_id=invoice.pk, order_id=order.pk, party_id=order.customer_id, total=str(order.total),
    )
    return invoice


def record_payment(order: SalesOrder, *, amount, mode="cash", reference="") -> Payment:
    payment = Payment.objects.create(
        order=order, amount=Decimal(str(amount)), mode=mode, reference=reference
    )
    order.amount_paid = (order.amount_paid or Decimal("0")) + payment.amount
    if order.amount_paid >= order.total:
        order.payment_status = SalesOrder.PaymentStatus.PAID
    elif order.amount_paid > 0:
        order.payment_status = SalesOrder.PaymentStatus.PARTIALLY_PAID
    order.save(update_fields=["amount_paid", "payment_status", "updated_at"])
    events.emit("orders.payment_recorded", order_id=order.pk, amount=str(payment.amount))
    return payment
