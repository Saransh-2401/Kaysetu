"""
DIST domain services. Prices and totals are computed server-side. Allocation is
capped by the company's real stock when INV is installed (asked via capability —
no import); without INV the request is approved in full (documented degrade).
"""
import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.foundation.integration import capabilities, events
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import (
    DistributorInvoice,
    DistributorPayment,
    DistributorStock,
    StockRequest,
    StockRequestItem,
    StockRequestLog,
)

logger = logging.getLogger("salexa.distribution")

CENT = Decimal("0.01")
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


def _distributor(party_id):
    from apps.foundation.models import Party

    if party_id in (None, ""):
        raise ValidationError({"distributor": "a distributor is required."})
    party = Party.objects.filter(pk=party_id).first()
    if party is None:
        raise ValidationError({"distributor": f"unknown distributor {party_id}."})
    # We SELL to distributors, so they are customer-side parties. Billing a
    # supplier party here would pollute that party's ledger through BOOKS.
    if party.kind not in (Party.Kind.CUSTOMER, Party.Kind.BOTH):
        raise ValidationError({"distributor": "that party cannot receive stock."})
    return party


# ------------------------------------------------------------------- requests
def create_stock_request(*, distributor_id, items, notes=""):
    """A distributor asks for stock. Unit price comes from the catalog, never
    from the client."""
    from apps.foundation.models import CatalogItem

    distributor = _distributor(distributor_id)
    prepared = []
    total = Decimal("0")
    seen_items = set()
    for line in items or []:
        item_id = line.get("item")
        catalog_item = CatalogItem.objects.filter(pk=item_id).first()
        if catalog_item is None:
            raise ValidationError({"item": f"unknown item {item_id}."})
        # One line per item: duplicates would each be allocated against the same
        # available stock at approval, over-promising what the company holds.
        if catalog_item.pk in seen_items:
            raise ValidationError({"items": f"item {catalog_item.name} is listed more than once."})
        seen_items.add(catalog_item.pk)
        qty = _dec(line.get("requested_quantity", line.get("quantity", 0)), "requested_quantity")
        if qty <= 0:
            raise ValidationError({"requested_quantity": "must be greater than zero."})
        price = catalog_item.price or Decimal("0")
        amount = (qty * price).quantize(CENT)
        if amount > MAX_AMOUNT:
            raise ValidationError({"amount": "line amount exceeds the maximum allowed."})
        total += amount
        prepared.append((catalog_item, qty, price, amount))
    if not prepared:
        raise ValidationError({"items": "at least one line is required."})

    with _tenant_atomic():
        req = StockRequest.objects.create(
            number=_num("SR"), distributor=distributor, total_amount=total, notes=notes,
        )
        for catalog_item, qty, price, amount in prepared:
            StockRequestItem.objects.create(
                request=req, item=catalog_item, item_name=catalog_item.name,
                requested_quantity=qty, unit_price=price, total_price=amount,
            )
        StockRequestLog.objects.create(request=req, from_status="", to_status=req.status,
                                       note="raised")
    events.emit("dist.request_created", request_id=req.pk, distributor_id=distributor.pk)
    return req


_TRANSITIONS = {
    StockRequest.Status.PENDING: {StockRequest.Status.APPROVED, StockRequest.Status.REJECTED},
    StockRequest.Status.APPROVED: {StockRequest.Status.DISPATCHED, StockRequest.Status.REJECTED},
    StockRequest.Status.DISPATCHED: {StockRequest.Status.DELIVERED},
    StockRequest.Status.DELIVERED: set(),
    StockRequest.Status.REJECTED: set(),
}


def _log(req, previous, note="", actor=None):
    StockRequestLog.objects.create(request=req, from_status=previous, to_status=req.status,
                                   note=note, actor=actor)


def _guard(req, target):
    if target not in _TRANSITIONS.get(req.status, set()):
        raise ValidationError(f"Cannot move a {req.get_status_display()} request to {target}.")


def approve_request(req, *, actor=None, allocations=None):
    """Approve, allocating what the company can actually supply.

    When INV is installed we ask it for each item's available quantity and cap the
    approval at it, recording the difference as a shortage. Without INV (capability
    returns None) the request is approved in full."""
    _guard(req, StockRequest.Status.APPROVED)
    overrides = {}
    for key, value in (allocations or {}).items():
        try:
            overrides[int(key)] = _dec(value, "approved_quantity")
        except (TypeError, ValueError):
            raise ValidationError({"allocations": f"invalid item key {key!r}."})

    # Resolve the stock provider ONCE: `None` means INV isn't installed (approve
    # in full, documented degrade). If it IS installed but a call raises, we must
    # NOT fall back to full approval — that would promise stock we never checked.
    stock_of = capabilities.get("inventory.stock_of")

    with _tenant_atomic():
        total = Decimal("0")
        shortage = False
        for line in req.items.select_for_update():
            wanted = line.requested_quantity
            if stock_of is None:
                approved = wanted
            else:
                available = _dec(stock_of(line.item_id), "stock")
                approved = min(wanted, available)
            # An explicit allocation may only ever REDUCE what stock allows.
            if line.item_id in overrides:
                approved = min(approved, overrides[line.item_id])
            approved = max(Decimal("0"), approved)
            line.approved_quantity = approved
            line.shortage_quantity = wanted - approved
            line.total_price = (approved * line.unit_price).quantize(CENT)
            line.save(update_fields=["approved_quantity", "shortage_quantity", "total_price"])
            total += line.total_price
            shortage = shortage or line.shortage_quantity > 0
            # Hold the stock so a second approval can't promise the same units
            # (INV releases it when the dispatch issues).
            if approved > 0:
                capabilities.call("inventory.reserve", line.item_id, float(approved), default=None)

        previous = req.status
        req.status = StockRequest.Status.APPROVED
        req.total_amount = total
        req.has_shortage = shortage
        req.approved_by = actor
        req.save(update_fields=["status", "total_amount", "has_shortage", "approved_by", "updated_at"])
        _log(req, previous, "approved", actor)
    return req


def reject_request(req, *, reason, actor=None):
    if not reason:
        raise ValidationError({"reason": "a rejection reason is required."})
    with _tenant_atomic():
        locked = StockRequest.objects.select_for_update().get(pk=req.pk)
        _guard(locked, StockRequest.Status.REJECTED)
        was_approved = locked.status == StockRequest.Status.APPROVED
        previous = locked.status
        locked.status = StockRequest.Status.REJECTED
        locked.reject_reason = reason
        locked.total_amount = Decimal("0")   # a rejected request owes nothing
        locked.save(update_fields=["status", "reject_reason", "total_amount", "updated_at"])
        _log(locked, previous, reason, actor)
        if was_approved:
            # give the held stock back
            for line in locked.items.all():
                if (line.approved_quantity or 0) > 0:
                    capabilities.call("inventory.release", line.item_id,
                                      float(line.approved_quantity), default=None)
    req.refresh_from_db()
    return req


def dispatch_request(req, *, actor=None):
    """Ship the approved quantities: company stock goes down (INV, via event) and
    the distributor's own stock goes up (DIST owns that book)."""
    from django.db.models import F

    with _tenant_atomic():
        # Lock + re-read: without this, two concurrent dispatches both pass the
        # guard and the stock moves twice for one shipment.
        locked = StockRequest.objects.select_for_update().get(pk=req.pk)
        _guard(locked, StockRequest.Status.DISPATCHED)
        payload = []
        for line in locked.items.all():
            qty = line.approved_quantity or Decimal("0")
            if qty <= 0:
                continue
            stock, _ = DistributorStock.objects.get_or_create(
                distributor_id=locked.distributor_id, item_id=line.item_id
            )
            # F() so a concurrent credit for the same distributor+item can't be lost
            DistributorStock.objects.filter(pk=stock.pk).update(on_hand=F("on_hand") + qty)
            payload.append({"item_id": line.item_id, "quantity": str(qty)})

        previous = locked.status
        locked.status = StockRequest.Status.DISPATCHED
        locked.save(update_fields=["status", "updated_at"])
        _log(locked, previous, "dispatched", actor)
    req.refresh_from_db()

    # INV subscribes and deducts the company's stock (entitlement-gated there).
    events.emit("dist.stock_dispatched", request_id=req.pk, request_number=req.number, items=payload)
    return req


def mark_delivered(req, *, actor=None):
    with _tenant_atomic():
        locked = StockRequest.objects.select_for_update().get(pk=req.pk)
        _guard(locked, StockRequest.Status.DELIVERED)
        previous = locked.status
        locked.status = StockRequest.Status.DELIVERED
        locked.save(update_fields=["status", "updated_at"])
        _log(locked, previous, "delivered", actor)
    req.refresh_from_db()
    return req


# ------------------------------------------------------------------- invoices
def issue_invoice(req, *, invoice_date=None, due_date=None):
    """Invoice a dispatched request. BOOKS posts Dr AR / Cr Sales when installed."""
    with _tenant_atomic():
        # Lock + re-check INSIDE the transaction: a check-then-act outside it lets
        # two concurrent calls both create an invoice (each with its own id, so
        # BOOKS' per-invoice idempotency would happily post revenue twice).
        req = StockRequest.objects.select_for_update().get(pk=req.pk)
        if req.status not in (StockRequest.Status.DISPATCHED, StockRequest.Status.DELIVERED):
            raise ValidationError("Only a dispatched request can be invoiced.")
        if req.invoices.exists():
            raise ValidationError("This request has already been invoiced.")

        invoice = DistributorInvoice.objects.create(
            number=_num("DINV"), request=req, distributor_id=req.distributor_id,
            invoice_date=invoice_date or timezone.localdate(), due_date=due_date,
            total_amount=req.total_amount,
        )
        req.payment_status = StockRequest.PaymentStatus.INVOICED
        req.save(update_fields=["payment_status", "updated_at"])

    events.emit(
        "dist.invoice_issued",
        invoice_id=invoice.pk, party_id=req.distributor_id,
        total=str(invoice.total_amount), reference=req.number,
    )
    return invoice


def record_invoice_payment(invoice, *, amount, mode="bank", reference=""):
    amount = _dec(amount, "amount")
    if amount <= 0:
        raise ValidationError({"amount": "must be a positive amount."})
    alias = ensure_alias(require_tenant())
    with transaction.atomic(using=alias):
        locked = DistributorInvoice.objects.select_for_update().get(pk=invoice.pk)
        outstanding = (locked.total_amount - (locked.paid_amount or Decimal("0"))).quantize(CENT)
        if amount.quantize(CENT) > outstanding:
            raise ValidationError({"amount": f"exceeds the outstanding balance ({outstanding})."})
        payment = DistributorPayment.objects.create(
            invoice=locked, amount=amount, mode=mode, reference=reference,
        )
        locked.paid_amount = (locked.paid_amount or Decimal("0")) + amount
        locked.status = (DistributorInvoice.Status.PAID if locked.paid_amount >= locked.total_amount
                         else DistributorInvoice.Status.PARTIALLY_PAID)
        locked.payment_reference = reference or locked.payment_reference
        locked.save(update_fields=["paid_amount", "status", "payment_reference"])
        _sync_request_payment(locked.request_id)

    # BOOKS subscribes: Dr Cash|Bank / Cr Accounts Receivable — otherwise the
    # receivable raised by dist.invoice_issued would never be cleared.
    events.emit(
        "dist.payment_received",
        payment_id=payment.pk, invoice_id=invoice.pk,
        party_id=locked.distributor_id, amount=str(amount), mode=mode,
    )
    invoice.refresh_from_db()
    return invoice


def _sync_request_payment(request_id):
    from django.db.models import Sum

    req = StockRequest.objects.select_for_update().get(pk=request_id)
    paid = DistributorInvoice.objects.filter(request_id=request_id).aggregate(
        s=Sum("paid_amount"))["s"] or Decimal("0")
    req.amount_paid = paid
    if paid >= req.total_amount and req.total_amount > 0:
        req.payment_status = StockRequest.PaymentStatus.PAID
    elif paid > 0:
        req.payment_status = StockRequest.PaymentStatus.PARTIALLY_PAID
    else:
        req.payment_status = StockRequest.PaymentStatus.INVOICED
    req.save(update_fields=["amount_paid", "payment_status", "updated_at"])
