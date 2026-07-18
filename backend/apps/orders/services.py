"""
ORDERS domain services. Cross-module reads via the capability registry
(inventory stock checks when INV is present); effects emitted as events
(orders.invoice_issued -> BOOKS). Imports only foundation.
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.foundation.integration import capabilities, events
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import DeliveryNote, Invoice, Payment, PickList, SalesOrder, SalesOrderItem, StatusLog

MAX_AMOUNT = Decimal("9999999999.99")
S = SalesOrder.Status

# Forward-only lifecycle: which source states may move to each target.
_ALLOWED_TRANSITIONS = {
    S.CONFIRMED: {S.PROCESSING},
    S.PACKED: {S.CONFIRMED},
    S.IN_TRANSIT: {S.PACKED, S.CONFIRMED},   # a pick list may be skipped
    S.DELIVERED: {S.IN_TRANSIT},
    S.REJECTED: {S.PROCESSING, S.CONFIRMED},
}


def _num(prefix):
    # Full microseconds + random suffix. The old form truncated to 100µs, so two
    # documents created in the same instant collided on the unique number.
    import secrets

    return f"{prefix}-{timezone.now().strftime('%y%m%d%H%M%S%f')}-{secrets.token_hex(2)}"


def _to_decimal(value, field):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field: "must be a number."})


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
        qty = _to_decimal(line.get("quantity", 1), "quantity")
        rate = _to_decimal(line.get("rate", 0), "rate")
        tax_rate = _to_decimal(line.get("tax_rate", 0), "tax_rate")
        if qty <= 0:
            raise ValidationError({"quantity": "must be greater than 0."})
        if rate < 0 or tax_rate < 0 or tax_rate > 100:
            raise ValidationError({"rate": "rate must be >= 0 and tax_rate within 0..100."})
        # Amount is ALWAYS computed server-side — never trusted from the client.
        amount = (qty * rate).quantize(Decimal("0.01"))
        if amount > MAX_AMOUNT:
            raise ValidationError({"amount": "line amount exceeds the maximum allowed."})
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
    allowed = _ALLOWED_TRANSITIONS.get(to_status, set())
    if order.status not in allowed:
        raise ValidationError(f"Cannot move order from '{order.status}' to '{to_status}'.")
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
    if order.status != SalesOrder.Status.CONFIRMED:
        raise ValidationError("Only a confirmed order can have a pick list.")
    pl = PickList.objects.create(order=order, picker=picker)
    _transition(order, SalesOrder.Status.PACKED, note="pick list created")
    return pl


def make_delivery_note(order: SalesOrder, **fields) -> DeliveryNote:
    # The emit sits INSIDE the transaction: its delivery record commits with the
    # dispatch itself, so the stock deduction can neither be lost (crash after
    # commit) nor applied for a note that rolled back (handlers run on_commit).
    with transaction.atomic(using=ensure_alias(require_tenant())):
        dn = DeliveryNote.objects.create(order=order, note_number=_num("DN"), **fields)
        _transition(order, SalesOrder.Status.IN_TRANSIT, note="delivery note created")
        # Carry line items so INV can deduct stock (no import back into ORDERS).
        events.emit(
            "orders.dispatched",
            order_id=order.pk, order_number=order.order_number,
            items=[{"item_id": i.item_id, "quantity": str(i.quantity)} for i in order.items.all()],
        )
    return dn


def mark_delivered(order: SalesOrder, actor=None) -> SalesOrder:
    _transition(order, SalesOrder.Status.DELIVERED, actor, "delivered")
    events.emit("orders.delivered", order_id=order.pk)
    return order


def issue_invoice(order: SalesOrder) -> Invoice:
    if order.status != SalesOrder.Status.DELIVERED:
        raise ValidationError("Order must be delivered before invoicing.")
    if order.invoices.exists():
        raise ValidationError("Invoice already issued for this order.")
    with transaction.atomic(using=ensure_alias(require_tenant())):
        invoice = Invoice.objects.create(
            order=order, invoice_number=_num("INV"),
            invoice_date=timezone.localdate(), total=order.total,
        )
        # BOOKS subscribes to post this to the ledger when present. subtotal + tax_amount
        # let it split output GST out of revenue (Dr AR / Cr Sales / Cr GST Payable).
        # Emitted inside the transaction so the invoice and its ledger obligation
        # are recorded together — the post can never be silently lost.
        events.emit(
            "orders.invoice_issued",
            invoice_id=invoice.pk, order_id=order.pk, party_id=order.customer_id,
            total=str(order.total), subtotal=str(order.subtotal), tax_amount=str(order.tax_amount),
        )
    return invoice


def record_payment(order: SalesOrder, *, amount, mode="cash", reference="") -> Payment:
    amount = _to_decimal(amount, "amount")
    if amount <= 0:
        raise ValidationError({"amount": "must be a positive amount."})
    if order.status == SalesOrder.Status.REJECTED:
        raise ValidationError("Cannot record a payment against a rejected order.")

    with transaction.atomic(using=ensure_alias(require_tenant())):
        # Lock the order row so concurrent payments don't lose updates.
        locked = SalesOrder.objects.select_for_update().get(pk=order.pk)
        outstanding = locked.total - (locked.amount_paid or Decimal("0"))
        if amount > outstanding + Decimal("0.01"):
            raise ValidationError({"amount": f"exceeds the outstanding balance ({outstanding})."})
        payment = Payment.objects.create(order=locked, amount=amount, mode=mode, reference=reference)
        locked.amount_paid = (locked.amount_paid or Decimal("0")) + amount
        if locked.amount_paid >= locked.total:
            locked.payment_status = SalesOrder.PaymentStatus.PAID
        elif locked.amount_paid > 0:
            locked.payment_status = SalesOrder.PaymentStatus.PARTIALLY_PAID
        else:
            locked.payment_status = SalesOrder.PaymentStatus.PENDING
        locked.save(update_fields=["amount_paid", "payment_status", "updated_at"])
        # party_id + payment_id let BOOKS post an idempotent receipt against the
        # right customer's receivable; mode routes it to Cash vs Bank (no import
        # back). Inside the lock so the receipt is recorded with the payment.
        events.emit(
            "orders.payment_recorded",
            order_id=order.pk, payment_id=payment.pk, party_id=order.customer_id,
            amount=str(amount), mode=mode,
        )
    order.refresh_from_db()
    return payment
