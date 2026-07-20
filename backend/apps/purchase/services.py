"""
PURCH domain services. Money is ALWAYS computed server-side (amount = qty * rate,
tax from the line's tax_rate) — client-supplied totals are never trusted. Every
multi-row write is atomic on the tenant DB.

Integration is emit-only: PURCH announces what happened and INV/BOOKS react if
the tenant bought them. PURCH imports neither.
"""
import logging
from collections import defaultdict
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.foundation.integration import events
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import (
    BillPayment,
    GoodsReceipt,
    GoodsReceiptItem,
    MaterialRequest,
    MaterialRequestItem,
    PurchaseBill,
    PurchaseOrder,
    PurchaseOrderItem,
)

logger = logging.getLogger("kaysetu.purchase")

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
    if not parsed.is_finite():   # NaN / Infinity would sail past every guard below
        raise ValidationError({field: f"invalid number: {value!r}"})
    return parsed


def _valid_item_id(line):
    item_id = line.get("item")
    if item_id in (None, ""):
        raise ValidationError({"item": "each line needs an item."})
    from apps.foundation.models import CatalogItem

    if not CatalogItem.objects.filter(pk=item_id).exists():
        raise ValidationError({"item": f"unknown item {item_id}."})
    return item_id


def _valid_supplier_id(supplier_id):
    """A purchase party must actually be a supplier — billing a customer party
    would land the payable in the wrong sub-ledger."""
    from apps.foundation.models import Party

    if supplier_id in (None, ""):
        raise ValidationError({"supplier": "a supplier is required."})
    party = Party.objects.filter(pk=supplier_id).first()
    if party is None:
        raise ValidationError({"supplier": f"unknown supplier {supplier_id}."})
    if party.kind not in (Party.Kind.SUPPLIER, Party.Kind.BOTH):
        raise ValidationError({"supplier": "that party is not a supplier."})
    return party.pk


def _price_lines(items):
    """Validate + price purchase lines server-side. Returns (prepared, subtotal, tax)."""
    prepared = []
    subtotal = tax_total = Decimal("0")
    for line in items or []:
        _valid_item_id(line)
        qty = _dec(line.get("quantity", 0), "quantity")
        rate = _dec(line.get("rate", line.get("estimated_rate", 0)), "rate")
        tax_rate = _dec(line.get("tax_rate", 0), "tax_rate")
        if qty <= 0:
            raise ValidationError({"quantity": "must be greater than zero."})
        if rate < 0 or tax_rate < 0 or tax_rate > 100:
            raise ValidationError({"rate": "rate must be >= 0 and tax_rate within 0..100."})
        amount = (qty * rate).quantize(CENT)
        if amount > MAX_AMOUNT:
            raise ValidationError({"amount": "line amount exceeds the maximum allowed."})
        subtotal += amount
        tax_total += (amount * tax_rate / 100).quantize(CENT)
        prepared.append((line, qty, rate, tax_rate, amount))
    if not prepared:
        raise ValidationError({"items": "at least one line is required."})
    return prepared, subtotal, tax_total


# ------------------------------------------------------------- material requests
def create_material_request(*, items, required_date=None, purpose="", priority="medium", created_by=None):
    prepared, subtotal, _tax = _price_lines(items)
    with _tenant_atomic():
        mr = MaterialRequest.objects.create(
            number=_num("MR"), required_date=required_date, purpose=purpose,
            priority=priority, total_amount=subtotal, created_by=created_by,
        )
        for line, qty, rate, _tr, _amt in prepared:
            MaterialRequestItem.objects.create(
                request=mr, item_id=line["item"], item_name=line.get("item_name", ""),
                quantity=qty, estimated_rate=rate, supplier_id=line.get("supplier") or None,
                specification=line.get("specification", ""),
            )
    return mr


M = MaterialRequest.Status

_MR_TRANSITIONS = {
    M.DRAFT: {M.PENDING_APPROVAL, M.CANCELLED},
    M.PENDING_APPROVAL: {M.APPROVED, M.REJECTED, M.CANCELLED},
    # Accounts sign-off is optional — a request may go straight to ordering.
    M.APPROVED: {M.SENT_TO_ACCOUNTS, M.ORDERED, M.CANCELLED},
    M.SENT_TO_ACCOUNTS: {M.ORDERED, M.CANCELLED},
    M.ORDERED: {M.SHIPMENT_ARRIVED, M.PARTIALLY_RECEIVED, M.RECEIVED, M.CANCELLED},
    M.SHIPMENT_ARRIVED: {M.PARTIALLY_RECEIVED, M.RECEIVED, M.CANCELLED},
    M.PARTIALLY_RECEIVED: {M.RECEIVED, M.STOCKED},
    M.RECEIVED: {M.STOCKED},
    M.STOCKED: set(),
    M.REJECTED: set(),
    M.CANCELLED: set(),
}


def _log_status(obj, old, new, *, actor=None, reason=""):
    """Append to the object's own activity log. Kept here (not in the view) so
    an override made through any path is recorded the same way."""
    history = list(obj.status_history or [])
    history.append({
        "from": old, "to": new, "reason": reason,
        "by": getattr(actor, "full_name", "") or getattr(actor, "email", ""),
        "at": timezone.now().isoformat(),
    })
    obj.status_history = history


def set_mr_status(mr, new_status, *, reason="", actor=None, force=False):
    """Move a request along its lifecycle.

    `force` is the admin override: it skips the state machine but is still
    recorded in status_history, so an out-of-band jump is visible rather than
    indistinguishable from a normal step.
    """
    if new_status not in M.values:
        raise ValidationError({"status": f"'{new_status}' is not a material-request status."})
    if not force and new_status not in _MR_TRANSITIONS.get(mr.status, set()):
        raise ValidationError(f"Cannot move a {mr.get_status_display()} request to {new_status}.")
    old = mr.status
    mr.status = new_status
    mr.reject_reason = reason if new_status == M.REJECTED else ""
    _log_status(mr, old, new_status, actor=actor,
                reason=(f"admin override: {reason}" if force else reason))
    mr.save(update_fields=["status", "reject_reason", "status_history", "updated_at"])
    return mr


def generate_purchase_orders(mr, *, actor=None):
    """Turn an approved request into one PO PER SUPPLIER.

    Lines that name no supplier cannot be ordered — they are reported back
    rather than silently dropped into some arbitrary supplier's order.
    """
    created = []
    with _tenant_atomic():
        # Lock the request INSIDE the transaction and re-check. Reading the
        # guards outside it let two simultaneous calls both see "not yet
        # ordered" and raise two complete sets of POs — duplicate commitments
        # to the supplier.
        mr = MaterialRequest.objects.select_for_update().get(pk=mr.pk)
        # ORDERED is allowed too: a request whose lines were only PARTLY
        # orderable (some had no supplier) must be able to order the rest once
        # a buyer assigns them. Anything earlier or terminal cannot.
        if mr.status not in {M.APPROVED, M.SENT_TO_ACCOUNTS, M.ORDERED}:
            raise ValidationError("Only an approved material request can be ordered.")

        by_supplier, unassigned = {}, []
        already_ordered = set(
            PurchaseOrderItem.objects.filter(order__material_request_id=mr.pk)
            .values_list("item_id", flat=True))
        for line in mr.items.select_related("item"):
            if line.supplier_id is None:
                # Name the item, not its id — this string goes straight onto a
                # screen telling a buyer which line still needs a supplier.
                unassigned.append(line.item_name or line.item.name)
                continue
            if line.item_id in already_ordered:
                continue          # this line was covered by an earlier run
            by_supplier.setdefault(line.supplier_id, []).append(line)

        if not by_supplier:
            if already_ordered:
                # Everything orderable is already on a PO. The remaining lines
                # are the ones still missing a supplier — say so, rather than
                # claiming the whole request was already handled.
                raise ValidationError({
                    "items": "every line with a supplier is already ordered; "
                             f"still unassigned: {', '.join(unassigned) or 'none'}."})
            raise ValidationError(
                {"items": "no line names a supplier, so no purchase order can be raised."})

        for supplier_id, lines in by_supplier.items():
            po = create_purchase_order(
                supplier_id=supplier_id, order_date=timezone.localdate(),
                delivery_date=mr.required_date,
                items=[{"item": ln.item_id, "item_name": ln.item_name,
                        "quantity": str(ln.quantity), "rate": str(ln.estimated_rate)}
                       for ln in lines],
                material_request=mr, mark_ordered=False,
            )
            created.append(po)
        # Mark ORDERED once, after all the POs exist — create_purchase_order's
        # own one-PO-per-request guard is bypassed above for exactly this reason.
        # Only from a pre-ORDERED state: a follow-up run covering lines that had
        # no supplier the first time must not re-transition an already-ordered
        # request (which the state machine would reject, losing the new POs).
        if mr.status in {M.APPROVED, M.SENT_TO_ACCOUNTS}:
            set_mr_status(mr, M.ORDERED, actor=actor)
    return created, unassigned


# --------------------------------------------------------------- purchase orders
def create_purchase_order(*, supplier_id, order_date, items, delivery_date=None,
                          material_request=None, notes="", payment_terms="", mark_ordered=True):
    """Raise a purchase order.

    `mark_ordered=False` is used ONLY by generate_purchase_orders, which raises
    several POs (one per supplier) against a single request and flips it to
    ORDERED once at the end — so the one-PO-per-request guard must not fire on
    the second supplier.
    """
    supplier_id = _valid_supplier_id(supplier_id)
    prepared, subtotal, tax_total = _price_lines(items)

    with _tenant_atomic():
        if material_request is not None and mark_ordered:
            # Checked INSIDE the transaction under a lock: reading these guards
            # outside it let two concurrent creates both see "not yet ordered"
            # and raise duplicate orders against one request.
            material_request = MaterialRequest.objects.select_for_update().get(
                pk=material_request.pk)
            # Only an APPROVED request may become an order, and only once —
            # going through the state machine keeps draft/rejected requests
            # from jumping straight to ORDERED.
            if material_request.status not in {MaterialRequest.Status.APPROVED,
                                               MaterialRequest.Status.SENT_TO_ACCOUNTS}:
                raise ValidationError(
                    {"material_request": "only an approved material request can be ordered."}
                )
            if material_request.purchase_orders.exists():
                raise ValidationError(
                    {"material_request": "this request has already been ordered."})

        po = PurchaseOrder.objects.create(
            number=_num("PO"), supplier_id=supplier_id, order_date=order_date,
            delivery_date=delivery_date, material_request=material_request,
            subtotal=subtotal, tax_amount=tax_total, total=subtotal + tax_total,
            notes=notes, payment_terms=payment_terms,
        )
        for line, qty, rate, tax_rate, amount in prepared:
            PurchaseOrderItem.objects.create(
                order=po, item_id=line["item"], item_name=line.get("item_name", ""),
                quantity=qty, rate=rate, tax_rate=tax_rate, amount=amount,
            )
        if material_request is not None and mark_ordered:
            set_mr_status(material_request, MaterialRequest.Status.ORDERED)
    events.emit("purchase.order_created", order_id=po.pk, supplier_id=supplier_id, total=str(po.total))
    return po


P = PurchaseOrder.Status

_PO_TRANSITIONS = {
    P.DRAFT: {P.PENDING_APPROVAL, P.APPROVED, P.CANCELLED},
    P.PENDING_APPROVAL: {P.APPROVED, P.CANCELLED},
    P.APPROVED: {P.SENT, P.CLOSED, P.CANCELLED},
    P.SENT: {P.CLOSED, P.CANCELLED},
    P.CLOSED: set(),
    P.CANCELLED: set(),
}

R = PurchaseOrder.ReceiptStatus

# Goods move forward only. `short_closed` is the escape hatch: what didn't turn
# up never will, so the order is settled at less than ordered.
_RECEIPT_TRANSITIONS = {
    R.PENDING: {R.SHIPMENT_ARRIVED, R.PARTIALLY_RECEIVED, R.RECEIVED, R.SHORT_CLOSED},
    R.SHIPMENT_ARRIVED: {R.PARTIALLY_RECEIVED, R.RECEIVED, R.SHORT_CLOSED},
    R.PARTIALLY_RECEIVED: {R.RECEIVED, R.STOCKED, R.SHORT_CLOSED},
    R.RECEIVED: {R.STOCKED, R.SHORT_CLOSED},
    R.STOCKED: set(),
    R.SHORT_CLOSED: set(),
}


def set_po_status(po, new_status, *, actor=None, reason="", force=False):
    if new_status not in P.values:
        raise ValidationError({"status": f"'{new_status}' is not a purchase-order status."})
    if not force and new_status not in _PO_TRANSITIONS.get(po.status, set()):
        raise ValidationError(f"Cannot move a {po.get_status_display()} order to {new_status}.")
    old = po.status
    po.status = new_status
    _log_status(po, old, new_status, actor=actor,
                reason=(f"admin override: {reason}" if force else reason))
    po.save(update_fields=["status", "status_history", "updated_at"])
    return po


def set_receipt_status(po, new_status, *, actor=None, reason=""):
    """Move where the GOODS are, independently of the paperwork status."""
    if new_status not in _RECEIPT_TRANSITIONS.get(po.receipt_status, set()):
        raise ValidationError(
            f"Cannot move receipt status from '{po.receipt_status}' to '{new_status}'."
        )
    old = po.receipt_status
    po.receipt_status = new_status
    _log_status(po, f"receipt:{old}", f"receipt:{new_status}", actor=actor, reason=reason)
    po.save(update_fields=["receipt_status", "status_history", "updated_at"])
    return po


# ----------------------------------------------------------------- goods receipt
def receive_goods(po, *, lines, receipt_date=None, warehouse_id=None, notes=""):
    """Record a GRN against an approved/sent PO and hand the accepted quantities
    to INV via `purchase.goods_received`. PURCH itself never touches stock."""
    if po.status not in (PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.SENT):
        raise ValidationError("Only an approved or sent purchase order can receive goods.")

    # Collapse repeated lines for the same item FIRST — validating them one by one
    # would check each against the same stale received_quantity and let the total
    # sail past the ordered quantity.
    requested = {}
    for line in lines or []:
        item_id = line.get("item")
        if item_id in (None, ""):
            raise ValidationError({"items": "each line needs an item."})
        accepted = _dec(line.get("quantity_accepted", 0), "quantity_accepted")
        rejected = _dec(line.get("quantity_rejected", 0), "quantity_rejected")
        if accepted < 0 or rejected < 0:
            raise ValidationError({"quantity_accepted": "quantities cannot be negative."})
        got = requested.setdefault(item_id, [Decimal("0"), Decimal("0")])
        got[0] += accepted
        got[1] += rejected
    if not requested:
        raise ValidationError({"items": "at least one line is required."})
    if all(acc <= 0 and rej <= 0 for acc, rej in requested.values()):
        raise ValidationError({"items": "a receipt needs at least one non-zero quantity."})

    with _tenant_atomic():
        # Lock + re-read the PO lines inside the transaction (a prefetch cache or an
        # unlocked read would let two concurrent GRNs both pass the outstanding check).
        # Grouped by item, NOT keyed by it: a PO may legitimately carry the same
        # item on two lines, and a dict comprehension kept only the LAST one — so
        # the order could never be fully received and stuck in
        # partially_received forever.
        po_lines = defaultdict(list)
        for line in po.items.select_for_update().order_by("id"):
            po_lines[line.item_id].append(line)

        prepared = []
        for item_id, (accepted, rejected) in requested.items():
            lines = po_lines.get(item_id)
            if not lines:
                raise ValidationError({"items": f"item {item_id} is not on this purchase order."})
            ordered = sum((ln.quantity for ln in lines), Decimal("0"))
            already = sum((ln.received_quantity or Decimal("0") for ln in lines), Decimal("0"))
            outstanding = ordered - already
            if accepted > outstanding:
                raise ValidationError(
                    {"quantity_accepted": f"{accepted} exceeds the outstanding {outstanding} for {lines[0].item_name}."}
                )
            if rejected > ordered:
                raise ValidationError(
                    {"quantity_rejected": f"{rejected} exceeds the ordered {ordered} for {lines[0].item_name}."}
                )
            prepared.append((lines, accepted, rejected))

        grn = GoodsReceipt.objects.create(
            number=_num("GRN"), purchase_order=po, supplier=po.supplier,
            receipt_date=receipt_date or timezone.localdate(),
            warehouse_id=warehouse_id, status=GoodsReceipt.Status.COMPLETED, notes=notes,
        )
        payload_items = []
        for lines, accepted, rejected in prepared:
            first = lines[0]
            ordered = sum((ln.quantity for ln in lines), Decimal("0"))
            GoodsReceiptItem.objects.create(
                receipt=grn, item=first.item, item_name=first.item_name,
                quantity_ordered=ordered, quantity_accepted=accepted,
                quantity_rejected=rejected, rate=first.rate,
            )
            # Fill the lines in order: an item split across two lines is
            # received against the first until it is full, then the next.
            remaining = accepted
            for line in lines:
                if remaining <= 0:
                    break
                room = line.quantity - (line.received_quantity or Decimal("0"))
                take = min(room, remaining)
                if take <= 0:
                    continue
                line.received_quantity = (line.received_quantity or Decimal("0")) + take
                line.save(update_fields=["received_quantity"])
                remaining -= take
            if accepted > 0:
                payload_items.append({
                    "item_id": first.item_id, "quantity": str(accepted), "rate": str(first.rate),
                })
        _refresh_receipt_status(po)

        # INV subscribes and adds the stock (entitlement-gated on its side).
        # Emitted INSIDE the transaction so the receipt and the stock it owes
        # commit together: a rolled-back GRN adds nothing, and a committed one
        # can never lose its stock movement (handlers run on_commit).
        events.emit(
            "purchase.goods_received",
            receipt_id=grn.pk, receipt_number=grn.number, order_id=po.pk,
            warehouse_id=warehouse_id, items=payload_items,
        )
    return grn


# Goods only move forward. Once someone has confirmed the stock is on a shelf
# (or written off what never arrived), a later GRN must not undo that.
_TERMINAL_RECEIPT = {PurchaseOrder.ReceiptStatus.STOCKED,
                     PurchaseOrder.ReceiptStatus.SHORT_CLOSED}


def _refresh_receipt_status(po):
    """Re-derive where the goods are from the lines.

    Never walks backwards: a GRN that recorded only REJECTED quantities used to
    drag the order all the way back to `pending`, erasing a manual
    `shipment_arrived`, and a second GRN could revert a terminal `stocked`.
    """
    if po.receipt_status in _TERMINAL_RECEIPT:
        return po
    # Read the lines FRESH — po.items.all() would return the view's prefetch cache
    # (received_quantity as it was at request start) and mis-compute the status.
    items = list(PurchaseOrderItem.objects.filter(order_id=po.pk))
    if items and all((i.received_quantity or 0) >= i.quantity for i in items):
        derived = PurchaseOrder.ReceiptStatus.RECEIVED
    elif any((i.received_quantity or 0) > 0 for i in items):
        derived = PurchaseOrder.ReceiptStatus.PARTIALLY_RECEIVED
    else:
        # Nothing accepted yet. Keep any manually-recorded progress
        # (shipment_arrived) rather than resetting to pending.
        derived = po.receipt_status or PurchaseOrder.ReceiptStatus.PENDING

    rank = {PurchaseOrder.ReceiptStatus.PENDING: 0,
            PurchaseOrder.ReceiptStatus.SHIPMENT_ARRIVED: 1,
            PurchaseOrder.ReceiptStatus.PARTIALLY_RECEIVED: 2,
            PurchaseOrder.ReceiptStatus.RECEIVED: 3}
    if rank.get(derived, 0) >= rank.get(po.receipt_status, 0):
        po.receipt_status = derived
        po.save(update_fields=["receipt_status", "updated_at"])
    return po


# ------------------------------------------------------------------------ bills
def create_bill(*, supplier_id, invoice_date, purchase_order=None, supplier_invoice_no="",
                due_date=None, items=None, subtotal=None, tax_amount=None):
    """Book a supplier bill. Amounts come from the PO when one is linked (never
    from the client); otherwise from priced lines."""
    if purchase_order is not None:
        if purchase_order.status not in (PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.SENT,
                                         PurchaseOrder.Status.CLOSED):
            raise ValidationError("Only an approved, sent or closed purchase order can be billed.")
        if purchase_order.bills.exists():
            # BOOKS is idempotent per BILL, so a second bill would be a legitimate
            # second posting — i.e. a doubled payable. Block it here.
            raise ValidationError("This purchase order has already been billed.")
        net, tax = purchase_order.subtotal, purchase_order.tax_amount
        supplier_id = purchase_order.supplier_id
    elif items:
        _prepared, net, tax = _price_lines(items)
        supplier_id = _valid_supplier_id(supplier_id)
    else:
        net = _dec(subtotal or 0, "subtotal")
        tax = _dec(tax_amount or 0, "tax_amount")
        if net <= 0:
            raise ValidationError({"subtotal": "a bill needs a positive amount."})
        if tax < 0:
            raise ValidationError({"tax_amount": "tax cannot be negative."})
        if net > MAX_AMOUNT or tax > MAX_AMOUNT:
            raise ValidationError({"subtotal": "amount exceeds the maximum allowed."})
        supplier_id = _valid_supplier_id(supplier_id)

    with _tenant_atomic():
        bill = PurchaseBill.objects.create(
            number=_num("BILL"), supplier_id=supplier_id, purchase_order=purchase_order,
            supplier_invoice_no=supplier_invoice_no, invoice_date=invoice_date, due_date=due_date,
            subtotal=net, tax_amount=tax, total=net + tax,
        )
        # BOOKS subscribes: Dr Inventory / Dr GST Input / Cr Accounts Payable.
        # Inside the transaction so the bill and its payable commit together.
        events.emit(
            "purchase.bill_issued",
            bill_id=bill.pk, party_id=bill.supplier_id, subtotal=str(net),
            tax_amount=str(tax), total=str(bill.total),
            reference=purchase_order.number if purchase_order else bill.number,
        )
    return bill


def record_bill_payment(bill, *, amount, mode="bank", reference=""):
    amount = _dec(amount, "amount")
    if amount <= 0:
        raise ValidationError({"amount": "must be a positive amount."})
    alias = ensure_alias(require_tenant())
    with transaction.atomic(using=alias):
        locked = PurchaseBill.objects.select_for_update().get(pk=bill.pk)
        outstanding = locked.total - (locked.paid_amount or Decimal("0"))
        if amount > outstanding + CENT:
            raise ValidationError({"amount": f"exceeds the outstanding balance ({outstanding})."})
        payment = BillPayment.objects.create(bill=locked, amount=amount, mode=mode, reference=reference)
        locked.paid_amount = (locked.paid_amount or Decimal("0")) + amount
        if locked.paid_amount >= locked.total:
            locked.status = PurchaseBill.Status.PAID
        elif locked.paid_amount > 0:
            locked.status = PurchaseBill.Status.PARTIALLY_PAID
        else:
            locked.status = PurchaseBill.Status.UNPAID
        locked.save(update_fields=["paid_amount", "status"])
        if locked.purchase_order_id:
            _refresh_po_payment(locked.purchase_order_id)

        # BOOKS subscribes: Dr Accounts Payable / Cr Cash|Bank.
        events.emit(
            "purchase.payment_made",
            payment_id=payment.pk, bill_id=bill.pk, party_id=locked.supplier_id,
            amount=str(amount), mode=mode,
        )
    bill.refresh_from_db()
    return payment


def _refresh_po_payment(po_id):
    """Recompute a PO's paid total from its bills. Locks the PO row and sums in
    the DB so two concurrent payments on different bills can't clobber each other."""
    from django.db.models import Sum

    locked = PurchaseOrder.objects.select_for_update().get(pk=po_id)
    paid = PurchaseBill.objects.filter(purchase_order_id=po_id).aggregate(
        s=Sum("paid_amount"))["s"] or Decimal("0")
    locked.paid_amount = paid
    if paid >= locked.total and locked.total > 0:
        locked.payment_status = PurchaseOrder.PaymentStatus.PAID
    elif paid > 0:
        locked.payment_status = PurchaseOrder.PaymentStatus.PARTIALLY_PAID
    else:
        locked.payment_status = PurchaseOrder.PaymentStatus.UNPAID
    locked.save(update_fields=["paid_amount", "payment_status", "updated_at"])


def mark_po_paid(po, *, reference="", actor=None):
    """Settle a purchase order that was paid outside the bill flow.

    Only valid for an order with NO bill. A billed order's payment must go
    through record_bill_payment: the ledger's payable is created by the bill,
    so settling the order directly would leave BOOKS holding an open payable
    while the spend report called it paid — and the next bill payment would
    silently reverse this settlement anyway, because _refresh_po_payment
    recomputes paid_amount from the bills alone.
    """
    if po.status == PurchaseOrder.Status.CANCELLED:
        raise ValidationError("A cancelled order cannot be marked paid.")
    if po.payment_status == PurchaseOrder.PaymentStatus.PAID:
        raise ValidationError("This order is already settled.")

    alias = ensure_alias(require_tenant())
    with transaction.atomic(using=alias):
        locked = PurchaseOrder.objects.select_for_update().get(pk=po.pk)
        if locked.payment_status == PurchaseOrder.PaymentStatus.PAID:
            raise ValidationError("This order is already settled.")
        if locked.bills.exists():
            raise ValidationError(
                "This order has a supplier bill — record the payment against the bill "
                "so it reaches the ledger."
            )
        previous = locked.payment_status
        locked.payment_status = PurchaseOrder.PaymentStatus.PAID
        locked.paid_amount = locked.total
        locked.payment_reference = reference
        # Read the PREVIOUS status before overwriting it — the log used to
        # record `paid -> paid` on every entry, losing the prior state.
        _log_status(locked, f"payment:{previous}", "payment:paid",
                    actor=actor, reason=reference)
        locked.save(update_fields=["payment_status", "paid_amount", "payment_reference",
                                   "status_history", "updated_at"])
    po.refresh_from_db()
    return po


def expense_report(*, from_date=None, to_date=None):
    """Procurement spend, sliced the three ways the report screen shows it."""
    from django.db.models import Count, Sum

    qs = PurchaseOrder.objects.exclude(
        status__in=[PurchaseOrder.Status.CANCELLED, PurchaseOrder.Status.DRAFT]
    ).select_related("supplier")
    if from_date:
        qs = qs.filter(order_date__gte=from_date)
    if to_date:
        qs = qs.filter(order_date__lte=to_date)

    orders = list(qs)
    total = sum((o.total for o in orders), Decimal("0"))
    paid = sum((o.paid_amount or Decimal("0") for o in orders), Decimal("0"))

    by_supplier = {}
    for o in orders:
        row = by_supplier.setdefault(
            o.supplier_id,
            {"supplier": o.supplier.name, "po_count": 0,
             "total": Decimal("0"), "paid": Decimal("0"), "unpaid": Decimal("0")},
        )
        row["po_count"] += 1
        row["total"] += o.total
        row["paid"] += o.paid_amount or Decimal("0")
        row["unpaid"] = row["total"] - row["paid"]

    by_month = {}
    for o in orders:
        key = o.order_date.strftime("%Y-%m")
        row = by_month.setdefault(key, {"month": key, "po_count": 0, "total": Decimal("0")})
        row["po_count"] += 1
        row["total"] += o.total

    return {
        "summary": {
            "total_expense": str(total), "paid": str(paid), "unpaid": str(total - paid),
            "po_count": len(orders),
        },
        "by_supplier": sorted(
            ({**r, "total": str(r["total"]), "paid": str(r["paid"]), "unpaid": str(r["unpaid"])}
             for r in by_supplier.values()),
            key=lambda r: Decimal(r["total"]), reverse=True,
        ),
        "by_month": [{**r, "total": str(r["total"])} for r in sorted(by_month.values(),
                                                                    key=lambda r: r["month"])],
        "rows": [{
            "po_number": o.number, "supplier": o.supplier.name,
            "order_date": o.order_date.isoformat(), "total": str(o.total),
            "payment_status": o.payment_status, "receipt_status": o.receipt_status,
        } for o in orders],
    }


def supplier_price_history(supplier_id):
    """Per-item negotiated-rate history for one supplier, from their PO lines.

    This is what stops a buyer re-negotiating blind: it answers "what did we
    last pay this supplier for this item, and what's the spread?"
    """
    lines = (PurchaseOrderItem.objects
             .filter(order__supplier_id=supplier_id)
             .exclude(order__status=PurchaseOrder.Status.CANCELLED)
             .select_related("order", "item")
             .order_by("-order__order_date", "-order_id"))

    by_item = {}
    for line in lines:
        row = by_item.get(line.item_id)
        if row is None:
            # Lines arrive newest-first, so the FIRST one seen is the latest.
            row = by_item[line.item_id] = {
                "item_id": line.item_id,
                "item_name": line.item_name or line.item.name,
                "item_code": line.item.code or "",
                "uom": line.item.unit,
                "last_rate": str(line.rate),
                "last_po_number": line.order.number,
                "last_order_date": line.order.order_date.isoformat(),
                "po_count": 0, "_rates": [], "history": [],
            }
        row["po_count"] += 1
        row["_rates"].append(line.rate)
        row["history"].append({
            "po_number": line.order.number,
            "order_date": line.order.order_date.isoformat(),
            "rate": str(line.rate), "quantity": str(line.quantity),
        })

    results = []
    for row in by_item.values():
        rates = row.pop("_rates")
        row["min_rate"] = str(min(rates))
        row["max_rate"] = str(max(rates))
        row["avg_rate"] = str((sum(rates) / len(rates)).quantize(CENT))
        results.append(row)
    results.sort(key=lambda r: r["item_name"])
    return {"count": len(results), "results": results}
