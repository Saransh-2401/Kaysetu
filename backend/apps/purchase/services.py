"""
PURCH domain services. Money is ALWAYS computed server-side (amount = qty * rate,
tax from the line's tax_rate) — client-supplied totals are never trusted. Every
multi-row write is atomic on the tenant DB.

Integration is emit-only: PURCH announces what happened and INV/BOOKS react if
the tenant bought them. PURCH imports neither.
"""
import logging
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

logger = logging.getLogger("salexa.purchase")

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


_MR_TRANSITIONS = {
    MaterialRequest.Status.DRAFT: {MaterialRequest.Status.SUBMITTED},
    MaterialRequest.Status.SUBMITTED: {MaterialRequest.Status.APPROVED, MaterialRequest.Status.REJECTED},
    MaterialRequest.Status.APPROVED: {MaterialRequest.Status.ORDERED},
    MaterialRequest.Status.REJECTED: set(),
    MaterialRequest.Status.ORDERED: set(),
}


def set_mr_status(mr, new_status, *, reason=""):
    if new_status not in _MR_TRANSITIONS.get(mr.status, set()):
        raise ValidationError(f"Cannot move a {mr.get_status_display()} request to {new_status}.")
    mr.status = new_status
    mr.reject_reason = reason if new_status == MaterialRequest.Status.REJECTED else ""
    mr.save(update_fields=["status", "reject_reason", "updated_at"])
    return mr


# --------------------------------------------------------------- purchase orders
def create_purchase_order(*, supplier_id, order_date, items, delivery_date=None,
                          material_request=None, notes="", payment_terms=""):
    supplier_id = _valid_supplier_id(supplier_id)
    prepared, subtotal, tax_total = _price_lines(items)
    if material_request is not None:
        # Only an APPROVED request may become an order, and only once — going
        # through the state machine keeps draft/rejected requests from jumping
        # straight to ORDERED.
        if material_request.status != MaterialRequest.Status.APPROVED:
            raise ValidationError(
                {"material_request": "only an approved material request can be ordered."}
            )
        if material_request.purchase_orders.exists():
            raise ValidationError({"material_request": "this request has already been ordered."})

    with _tenant_atomic():
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
        if material_request is not None:
            set_mr_status(material_request, MaterialRequest.Status.ORDERED)
    events.emit("purchase.order_created", order_id=po.pk, supplier_id=supplier_id, total=str(po.total))
    return po


_PO_TRANSITIONS = {
    PurchaseOrder.Status.DRAFT: {PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.CANCELLED},
    PurchaseOrder.Status.APPROVED: {PurchaseOrder.Status.SENT, PurchaseOrder.Status.CANCELLED},
    PurchaseOrder.Status.SENT: {PurchaseOrder.Status.CLOSED, PurchaseOrder.Status.CANCELLED},
    PurchaseOrder.Status.CLOSED: set(),
    PurchaseOrder.Status.CANCELLED: set(),
}


def set_po_status(po, new_status):
    if new_status not in _PO_TRANSITIONS.get(po.status, set()):
        raise ValidationError(f"Cannot move a {po.get_status_display()} order to {new_status}.")
    po.status = new_status
    po.save(update_fields=["status", "updated_at"])
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
        po_items = {it.item_id: it for it in po.items.select_for_update()}
        prepared = []
        for item_id, (accepted, rejected) in requested.items():
            po_item = po_items.get(item_id)
            if po_item is None:
                raise ValidationError({"items": f"item {item_id} is not on this purchase order."})
            outstanding = po_item.quantity - (po_item.received_quantity or Decimal("0"))
            if accepted > outstanding:
                raise ValidationError(
                    {"quantity_accepted": f"{accepted} exceeds the outstanding {outstanding} for {po_item.item_name}."}
                )
            if rejected > po_item.quantity:
                raise ValidationError(
                    {"quantity_rejected": f"{rejected} exceeds the ordered {po_item.quantity} for {po_item.item_name}."}
                )
            prepared.append((po_item, accepted, rejected))

        grn = GoodsReceipt.objects.create(
            number=_num("GRN"), purchase_order=po, supplier=po.supplier,
            receipt_date=receipt_date or timezone.localdate(),
            warehouse_id=warehouse_id, status=GoodsReceipt.Status.COMPLETED, notes=notes,
        )
        payload_items = []
        for po_item, accepted, rejected in prepared:
            GoodsReceiptItem.objects.create(
                receipt=grn, item=po_item.item, item_name=po_item.item_name,
                quantity_ordered=po_item.quantity, quantity_accepted=accepted,
                quantity_rejected=rejected, rate=po_item.rate,
            )
            po_item.received_quantity = (po_item.received_quantity or Decimal("0")) + accepted
            po_item.save(update_fields=["received_quantity"])
            if accepted > 0:
                payload_items.append({
                    "item_id": po_item.item_id, "quantity": str(accepted), "rate": str(po_item.rate),
                })
        _refresh_receipt_status(po)

    # INV subscribes and adds the stock (entitlement-gated on its side).
    events.emit(
        "purchase.goods_received",
        receipt_id=grn.pk, receipt_number=grn.number, order_id=po.pk,
        warehouse_id=warehouse_id, items=payload_items,
    )
    return grn


def _refresh_receipt_status(po):
    # Read the lines FRESH — po.items.all() would return the view's prefetch cache
    # (received_quantity as it was at request start) and mis-compute the status.
    items = list(PurchaseOrderItem.objects.filter(order_id=po.pk))
    if items and all((i.received_quantity or 0) >= i.quantity for i in items):
        po.receipt_status = PurchaseOrder.ReceiptStatus.RECEIVED
    elif any((i.received_quantity or 0) > 0 for i in items):
        po.receipt_status = PurchaseOrder.ReceiptStatus.PARTIAL
    else:
        po.receipt_status = PurchaseOrder.ReceiptStatus.PENDING
    po.save(update_fields=["receipt_status", "updated_at"])


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
