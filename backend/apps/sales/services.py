"""
SALES domain services.

Every money figure is computed HERE, from quantity, rate and tax rate. The
previous platform let the browser send `subtotal`, `tax_amount` and
`grand_total` and stored them verbatim — so a tampered or simply buggy client
could book an invoice whose parts didn't add up, and the ledger would inherit it.

GST split: CGST/SGST vs IGST is a per-invoice choice (place of supply is not
derivable from the data the tenant actually holds), but the SPLIT itself is
arithmetic and is never taken from the client.
"""
import secrets
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.foundation.integration import events
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import (
    AdjustmentNote,
    ManualInvoice,
    ManualInvoiceItem,
    PaymentEntry,
    SalesInvoice,
    SalesInvoiceItem,
)

CENT = Decimal("0.01")
ZERO = Decimal("0")
MAX_AMOUNT = Decimal("99999999.99")


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))


def _num(prefix):
    return f"{prefix}-{timezone.now().strftime('%y%m%d%H%M%S%f')}-{secrets.token_hex(2)}"


def _dec(value, field, *, default=ZERO):
    if value in (None, ""):
        return default
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field: f"invalid number: {value!r}"})
    if not parsed.is_finite():
        raise ValidationError({field: f"invalid number: {value!r}"})
    return parsed


def _q(value):
    return value.quantize(CENT)


# --------------------------------------------------------------- tax arithmetic
def split_tax(tax_total, *, is_igst):
    """Split a line's tax into the GST components.

    The halves are derived so they re-sum to the rounded total exactly —
    computing each as `tax/2` independently loses a paisa on odd amounts, and
    an invoice whose components don't add up to its total is a filing problem.
    """
    tax_total = _q(tax_total)
    if is_igst:
        return ZERO, ZERO, tax_total
    cgst = _q(tax_total / 2)
    return cgst, tax_total - cgst, ZERO


def price_line(*, quantity, rate, tax_rate, is_tax_inclusive, is_igst):
    """One line's money, computed from scratch. Returns a dict of components."""
    if quantity <= 0:
        raise ValidationError({"quantity": "must be greater than zero."})
    if rate < 0:
        raise ValidationError({"rate": "must not be negative."})
    if tax_rate < 0 or tax_rate > 100:
        raise ValidationError({"tax_rate": "must be within 0..100."})

    gross = _q(quantity * rate)
    if is_tax_inclusive:
        taxable = _q(gross / (1 + tax_rate / 100)) if tax_rate else gross
        tax = gross - taxable
        total = gross
    else:
        taxable = gross
        tax = _q(taxable * tax_rate / 100)
        total = taxable + tax
    if total > MAX_AMOUNT:
        raise ValidationError({"amount": "line amount exceeds the maximum allowed."})

    cgst, sgst, igst = split_tax(tax, is_igst=is_igst)
    half = _q(tax_rate / 2)
    return {
        "amount": taxable, "taxable_value": taxable, "tax_amount": tax,
        "total_price": total,
        "cgst_amount": cgst, "sgst_amount": sgst, "igst_amount": igst,
        "cgst_rate": ZERO if is_igst else half,
        "sgst_rate": ZERO if is_igst else (tax_rate - half),
        "igst_rate": tax_rate if is_igst else ZERO,
    }


def resolve_discount(taxable_subtotal, *, discount_type, discount_value):
    """The discount, measured against the TAXABLE value — not the gross.

    A discount shown on the invoice reduces the value of supply, so GST is
    charged on the discounted amount. Discounting the tax-inclusive total
    instead charges GST on money the customer was never billed, and leaves
    subtotal + tax != total, which is also what made the ledger drop the GST
    line entirely (BOOKS refuses to post figures that don't reconcile).
    """
    if discount_type == SalesInvoice.DiscountType.PERCENTAGE:
        if discount_value < 0 or discount_value > 100:
            raise ValidationError({"discount_value": "a percentage must be within 0..100."})
        discount = _q(taxable_subtotal * discount_value / 100)
    else:
        discount = _q(discount_value)
    if discount < 0:
        raise ValidationError({"discount_value": "must not be negative."})
    if discount > taxable_subtotal:
        raise ValidationError({
            "discount_amount":
            f"discount cannot exceed the taxable value ({taxable_subtotal})."})
    return discount


def apply_line_discount(lines, discount, taxable_subtotal, *, is_igst):
    """Spread a header discount across the lines and re-derive every tax figure.

    Done per line, not on the header, so each line keeps a correct HSN-level
    taxable value and GST split. The last line absorbs the rounding residual so
    the parts always re-sum to the header exactly — an invoice whose components
    don't add up is a filing problem, not a cosmetic one.
    """
    if discount <= 0 or taxable_subtotal <= 0:
        return

    remaining = discount
    for index, line in enumerate(lines):
        is_last = index == len(lines) - 1
        share = remaining if is_last else _q(discount * line.taxable_value / taxable_subtotal)
        share = min(share, line.taxable_value)
        remaining -= share

        line.taxable_value = line.taxable_value - share
        line.amount = line.taxable_value
        line.tax_amount = _q(line.taxable_value * line.tax_rate / 100)
        cgst, sgst, igst = split_tax(line.tax_amount, is_igst=is_igst)
        line.cgst_amount, line.sgst_amount, line.igst_amount = cgst, sgst, igst
        line.total_price = line.taxable_value + line.tax_amount


# ------------------------------------------------------------- sales invoices
def create_sales_invoice(*, customer_id, invoice_date, items, due_date=None,
                         sales_order_id=None, sales_order_number="", is_igst=False,
                         is_tax_inclusive=False, discount_type="amount", discount_value=0,
                         notes="", created_by=None, invoice_number=None):
    from apps.foundation.models import CatalogItem, Party

    if not customer_id:
        raise ValidationError({"customer": "a customer is required."})
    if not Party.objects.filter(pk=customer_id).exists():
        raise ValidationError({"customer": f"unknown party {customer_id}."})
    if not items:
        raise ValidationError({"items": "at least one line is required."})
    if sales_order_id and SalesInvoice.objects.filter(sales_order_id=sales_order_id).exists():
        raise ValidationError({"sales_order": "this order has already been invoiced."})

    prepared = []
    gross_taxable = ZERO
    for raw in items:
        quantity = _dec(raw.get("quantity"), "quantity")
        rate = _dec(raw.get("rate"), "rate")
        catalog = None
        item_id = raw.get("item") or raw.get("item_id")
        if item_id:
            catalog = CatalogItem.objects.filter(pk=item_id).first()
            if catalog is None:
                raise ValidationError({"item": f"unknown catalog item {item_id}."})
        tax_rate = _dec(raw.get("tax_rate"), "tax_rate",
                        default=(catalog.tax_rate if catalog else ZERO))
        money = price_line(quantity=quantity, rate=rate, tax_rate=tax_rate,
                           is_tax_inclusive=is_tax_inclusive, is_igst=is_igst)
        gross_taxable += money["amount"]
        prepared.append(SalesInvoiceItem(
            item=catalog,
            item_name=raw.get("item_name") or (catalog.name if catalog else ""),
            hsn_code=raw.get("hsn_code") or (catalog.hsn_sac if catalog else ""),
            description=raw.get("description", ""),
            quantity=quantity, rate=rate, tax_rate=tax_rate, **money,
        ))

    discount = resolve_discount(
        gross_taxable, discount_type=discount_type,
        discount_value=_dec(discount_value, "discount_value"))
    apply_line_discount(prepared, discount, gross_taxable, is_igst=is_igst)

    # Headers are SUMS of the (post-discount) lines, so the parts always
    # reconcile to the whole and BOOKS can split GST out of revenue.
    subtotal = sum((line.taxable_value for line in prepared), ZERO)
    tax_total = sum((line.tax_amount for line in prepared), ZERO)
    cgst_total = sum((line.cgst_amount for line in prepared), ZERO)
    sgst_total = sum((line.sgst_amount for line in prepared), ZERO)
    igst_total = sum((line.igst_amount for line in prepared), ZERO)
    total = subtotal + tax_total

    with _tenant_atomic():
        invoice = SalesInvoice.objects.create(
            invoice_number=invoice_number or _num("INV"),
            customer_id=customer_id, sales_order_id=sales_order_id or None,
            sales_order_number=sales_order_number,
            invoice_date=invoice_date or timezone.localdate(), due_date=due_date,
            is_tax_inclusive=is_tax_inclusive, is_igst=is_igst,
            subtotal=subtotal, tax_amount=tax_total,
            cgst_amount=cgst_total, sgst_amount=sgst_total, igst_amount=igst_total,
            discount_type=discount_type, discount_value=_dec(discount_value, "discount_value"),
            discount_amount=discount, total=total, outstanding_amount=total,
            notes=notes, created_by=created_by,
        )
        for line in prepared:
            line.invoice = invoice
        SalesInvoiceItem.objects.bulk_create(prepared)
        # Emitted inside the transaction: the invoice and its ledger obligation
        # are recorded together, so a post can never be silently lost.
        events.emit(
            "sales.invoice_issued",
            invoice_id=invoice.pk, party_id=customer_id, total=str(total),
            subtotal=str(subtotal), tax_amount=str(tax_total),
        )
    return invoice


def net_due(invoice):
    """What the customer actually owes: the issued total, moved by adjustment
    notes. `total` itself is never mutated — it is the document as issued."""
    return (invoice.total or ZERO) + (invoice.adjustment_total or ZERO)


def recompute_balance(invoice, *, reference=""):
    """Re-derive the balance from the two independent facts.

    `paid_amount` (cash) and `adjustment_total` (notes) are each maintained by
    their own caller; this only ever READS them. One function so payments and
    adjustment notes cannot drift into two different definitions of 'paid'.
    """
    due = net_due(invoice)
    invoice.outstanding_amount = max(ZERO, due - (invoice.paid_amount or ZERO))
    if invoice.outstanding_amount <= 0:
        invoice.payment_status = SalesInvoice.PaymentStatus.PAID
    elif (invoice.paid_amount or ZERO) > 0:
        invoice.payment_status = SalesInvoice.PaymentStatus.PARTIALLY_PAID
    else:
        # A credit note reduces what is owed but is NOT a payment. Reporting
        # this as partially_paid would put uncollected money in a cash figure.
        invoice.payment_status = SalesInvoice.PaymentStatus.UNPAID
    if reference:
        invoice.payment_reference = reference
    invoice.save(update_fields=["outstanding_amount", "payment_status",
                                "payment_reference", "updated_at"])
    return invoice


def record_payment(*, amount, payment_date=None, sales_invoice=None, sales_order_id=None,
                   mode="bank", reference_no="", company_bank_account="", remarks="",
                   status=PaymentEntry.Status.DRAFT, created_by=None):
    amount = _dec(amount, "amount")
    if amount <= 0:
        raise ValidationError({"amount": "must be a positive amount."})
    # The portal sends 'bank_transfer'; the ledger routes on the canonical name,
    # and an unrecognised mode would silently post to Cash.
    mode = {"bank_transfer": "bank", "netbanking": "bank", "neft": "bank",
            "rtgs": "bank"}.get(str(mode).lower(), str(mode).lower())
    if mode not in PaymentEntry.Mode.values:
        raise ValidationError({"mode": f"'{mode}' is not a payment mode."})

    with _tenant_atomic():
        if sales_invoice is not None:
            locked = SalesInvoice.objects.select_for_update().get(pk=sales_invoice.pk)
            if amount > (locked.outstanding_amount or ZERO) + CENT:
                raise ValidationError(
                    {"amount": f"exceeds the outstanding balance ({locked.outstanding_amount})."})
            sales_invoice = locked
        payment = PaymentEntry.objects.create(
            payment_number=_num("PAY"), sales_invoice=sales_invoice,
            sales_order_id=sales_order_id or None,
            payment_date=payment_date or timezone.localdate(), amount=amount, mode=mode,
            company_bank_account=company_bank_account, reference_no=reference_no,
            status=status, remarks=remarks, created_by=created_by,
        )
        if sales_invoice is not None:
            # paid_amount tracks CASH, and only cash.
            sales_invoice.paid_amount = (sales_invoice.paid_amount or ZERO) + amount
            sales_invoice.save(update_fields=["paid_amount", "updated_at"])
            recompute_balance(sales_invoice, reference=reference_no)
            events.emit(
                "sales.payment_recorded",
                payment_id=payment.pk, invoice_id=sales_invoice.pk,
                party_id=sales_invoice.customer_id, amount=str(amount), mode=mode,
            )
    return payment


def reverse_payment(payment, *, reason=""):
    """A cheque bounced (or a transfer was recalled): undo the settlement.

    Without this a bounced payment leaves the invoice PAID forever — the
    customer drops off every receivables report while the ledger still shows
    the cash. The reversal posts its own compensating entry rather than
    editing the original, so the bounce is visible in the audit trail.
    """
    if payment.status == PaymentEntry.Status.BOUNCED:
        raise ValidationError("This payment has already been reversed.")
    with _tenant_atomic():
        payment.status = PaymentEntry.Status.BOUNCED
        payment.remarks = f"{payment.remarks}\nBounced: {reason}".strip()
        payment.save(update_fields=["status", "remarks"])
        invoice = payment.sales_invoice
        if invoice is not None:
            locked = SalesInvoice.objects.select_for_update().get(pk=invoice.pk)
            locked.paid_amount = max(ZERO, (locked.paid_amount or ZERO) - payment.amount)
            locked.save(update_fields=["paid_amount", "updated_at"])
            recompute_balance(locked)
            events.emit(
                "sales.payment_reversed",
                payment_id=payment.pk, invoice_id=locked.pk,
                party_id=locked.customer_id, amount=str(payment.amount), mode=payment.mode,
            )
    return payment


# ------------------------------------------------------------ manual invoices
def _manual_totals(items, *, tax_type, is_tax_inclusive, discount_amount, advance_paid, round_off):
    is_igst = tax_type == ManualInvoice.TaxType.IGST
    prepared = []
    subtotal = tax_total = cgst_total = sgst_total = igst_total = ZERO
    for raw in items or []:
        name = (raw.get("item_name") or "").strip()
        if not name:
            raise ValidationError({"item_name": "every line needs a name."})
        quantity = _dec(raw.get("quantity"), "quantity")
        unit_price = _dec(raw.get("unit_price"), "unit_price")
        tax_percentage = _dec(raw.get("tax_percentage"), "tax_percentage")
        money = price_line(quantity=quantity, rate=unit_price, tax_rate=tax_percentage,
                           is_tax_inclusive=is_tax_inclusive, is_igst=is_igst)
        subtotal += money["amount"]
        tax_total += money["tax_amount"]
        cgst_total += money["cgst_amount"]
        sgst_total += money["sgst_amount"]
        igst_total += money["igst_amount"]
        prepared.append(ManualInvoiceItem(
            item_name=name, hsn_code=raw.get("hsn_code", ""),
            quantity=quantity, unit_price=unit_price, tax_percentage=tax_percentage,
            taxable_amount=money["amount"], tax_amount=money["tax_amount"],
            cgst_amount=money["cgst_amount"], sgst_amount=money["sgst_amount"],
            igst_amount=money["igst_amount"], total_amount=money["total_price"],
        ))
    if not prepared:
        raise ValidationError({"items": "at least one line is required."})

    discount = _dec(discount_amount, "discount_amount")
    if discount < 0:
        raise ValidationError({"discount_amount": "must not be negative."})
    if discount > subtotal + tax_total:
        raise ValidationError(
            {"discount_amount": "cannot be more than the total amount (Subtotal + Tax)."})

    # Round-off settles the paise on a hand-typed invoice — it is NOT a second
    # discount field. Unbounded, a large negative value zeroed a real invoice
    # and walked straight past the discount check above.
    rounding = _dec(round_off, "round_off")
    if rounding.copy_abs() > Decimal("1"):
        raise ValidationError(
            {"round_off": "round-off may only settle paise (within +/- 1.00)."})

    advance = _dec(advance_paid, "advance_paid")
    if advance < 0:
        raise ValidationError({"advance_paid": "must not be negative."})

    grand_total = subtotal + tax_total - discount + rounding
    if advance > grand_total:
        raise ValidationError(
            {"advance_paid": f"cannot exceed the invoice total ({grand_total})."})
    return prepared, {
        "subtotal": subtotal, "tax_amount": tax_total, "cgst_amount": cgst_total,
        "sgst_amount": sgst_total, "igst_amount": igst_total, "discount_amount": discount,
        "advance_paid": _dec(advance_paid, "advance_paid"),
        "round_off": _dec(round_off, "round_off"), "grand_total": max(ZERO, grand_total),
    }


def create_manual_invoice(*, data, created_by=None):
    number = (data.get("invoice_number") or "").strip()
    if not number:
        raise ValidationError({"invoice_number": "required."})
    if ManualInvoice.objects.filter(invoice_number=number).exists():
        raise ValidationError({"invoice_number": "that invoice number is already used."})
    if not (data.get("customer_name") or "").strip():
        raise ValidationError({"customer_name": "required."})

    invoice_date = data.get("invoice_date") or timezone.localdate()
    due_date = data.get("due_date") or None
    if due_date and str(due_date) < str(invoice_date):
        raise ValidationError({"due_date": "cannot be before the invoice date."})

    tax_type = data.get("tax_type") or ManualInvoice.TaxType.CGST_SGST
    is_inclusive = bool(data.get("is_tax_inclusive", True))
    items, totals = _manual_totals(
        data.get("items"), tax_type=tax_type, is_tax_inclusive=is_inclusive,
        discount_amount=data.get("discount_amount"), advance_paid=data.get("advance_paid"),
        round_off=data.get("round_off"),
    )

    with _tenant_atomic():
        invoice = ManualInvoice.objects.create(
            invoice_number=number, customer_name=data["customer_name"].strip(),
            customer_address=data.get("customer_address", ""),
            customer_gstin=data.get("customer_gstin", ""),
            invoice_date=invoice_date, due_date=due_date,
            tax_type=tax_type, is_tax_inclusive=is_inclusive,
            notes=data.get("notes", ""), created_by=created_by, **totals,
        )
        for line in items:
            line.manual_invoice = invoice
        ManualInvoiceItem.objects.bulk_create(items)
    return invoice


def update_manual_invoice(invoice, data):
    if invoice.status == ManualInvoice.Status.PAID:
        raise ValidationError("A paid invoice can no longer be edited.")
    for field in ("customer_name", "customer_address", "customer_gstin",
                  "invoice_date", "due_date", "notes", "tax_type"):
        if field in data:
            setattr(invoice, field, data[field])
    if "is_tax_inclusive" in data:
        invoice.is_tax_inclusive = bool(data["is_tax_inclusive"])

    # Money fields change the totals, so they must go through the same recompute
    # as the lines. Handling them only inside the `items` branch meant a PATCH
    # of discount_amount alone returned 200 with nothing changed.
    money_changed = any(k in data for k in ("discount_amount", "advance_paid", "round_off"))

    with _tenant_atomic():
        if "items" in data or money_changed:
            if invoice.adjustments.exists():
                # Recomputing totals from the lines would wipe the grand_total
                # reduction a credit note applied, silently un-crediting it.
                raise ValidationError(
                    "This invoice has adjustment notes against it and can no longer be "
                    "edited — raise another note instead.")
            lines = data.get("items")
            if lines is None:
                lines = [{"item_name": row.item_name, "hsn_code": row.hsn_code,
                          "quantity": row.quantity, "unit_price": row.unit_price,
                          "tax_percentage": row.tax_percentage}
                         for row in invoice.items.all()]
            items, totals = _manual_totals(
                lines, tax_type=invoice.tax_type,
                is_tax_inclusive=invoice.is_tax_inclusive,
                discount_amount=data.get("discount_amount", invoice.discount_amount),
                advance_paid=data.get("advance_paid", invoice.advance_paid),
                round_off=data.get("round_off", invoice.round_off),
            )
            invoice.items.all().delete()
            for line in items:
                line.manual_invoice = invoice
            ManualInvoiceItem.objects.bulk_create(items)
            for key, value in totals.items():
                setattr(invoice, key, value)
        invoice.save()
    # Re-query: `items` was rewritten, so any prefetch the caller holds is stale.
    return ManualInvoice.objects.prefetch_related("items").get(pk=invoice.pk)


def mark_manual_paid(invoice, *, payment_reference, payment_date=None):
    if not payment_reference:
        raise ValidationError({"payment_reference": "required."})
    if invoice.status == ManualInvoice.Status.CANCELLED:
        raise ValidationError("A cancelled invoice cannot be marked paid.")
    invoice.status = ManualInvoice.Status.PAID
    invoice.payment_reference = payment_reference
    invoice.payment_date = payment_date or timezone.localdate()
    invoice.save(update_fields=["status", "payment_reference", "payment_date", "updated_at"])
    return invoice


# --------------------------------------------------------- adjustment notes
def create_adjustment(*, note_type, adjustment_amount, reason, sales_invoice=None,
                      manual_invoice=None, distributor_invoice_id=None, created_by=None):
    if note_type not in AdjustmentNote.Type.values:
        raise ValidationError({"note_type": "must be 'credit' or 'debit'."})
    amount = _dec(adjustment_amount, "adjustment_amount")
    if amount <= 0:
        raise ValidationError({"adjustment_amount": "must be a positive amount."})
    if not (reason or "").strip():
        raise ValidationError({"reason": "required."})

    targets = [t for t in (sales_invoice, manual_invoice, distributor_invoice_id) if t]
    if len(targets) != 1:
        raise ValidationError({"detail": "name exactly one invoice to adjust."})

    # A credit note reduces what is owed; a debit note increases it.
    delta = -amount if note_type == AdjustmentNote.Type.CREDIT else amount

    with _tenant_atomic():
        if sales_invoice is not None:
            # Lock the invoice: two concurrent notes would otherwise both read
            # the same balance and both settle from stale state.
            sales_invoice = SalesInvoice.objects.select_for_update().get(pk=sales_invoice.pk)
            # Bound CUMULATIVELY, not per note. Checking each note against the
            # invoice total in isolation let N notes of the full amount through,
            # each posting to the ledger — crediting AR far past the original
            # debit while the invoice screen, clamped at zero, showed nothing.
            proposed = (sales_invoice.adjustment_total or ZERO) + delta
            if proposed < -(sales_invoice.total or ZERO):
                already = -(sales_invoice.adjustment_total or ZERO)
                raise ValidationError({
                    "adjustment_amount":
                    f"Credit notes cannot exceed the invoice total "
                    f"({sales_invoice.total}); {already} is already credited."})
            sales_invoice.adjustment_total = proposed
            sales_invoice.save(update_fields=["adjustment_total", "updated_at"])
            recompute_balance(sales_invoice)
        elif manual_invoice is not None:
            manual_invoice = ManualInvoice.objects.select_for_update().get(pk=manual_invoice.pk)
            if amount > manual_invoice.grand_total and delta < 0:
                raise ValidationError({
                    "adjustment_amount":
                    f"Amount exceeds invoice total ({manual_invoice.grand_total})"})
            manual_invoice.grand_total = max(ZERO, (manual_invoice.grand_total or ZERO) + delta)
            if manual_invoice.grand_total <= 0:
                manual_invoice.status = ManualInvoice.Status.PAID
            manual_invoice.save(update_fields=["grand_total", "status", "updated_at"])

        note = AdjustmentNote.objects.create(
            note_number=_num("ADJ"), note_type=note_type,
            sales_invoice=sales_invoice, manual_invoice=manual_invoice,
            distributor_invoice_id=distributor_invoice_id or None,
            adjustment_date=timezone.localdate(), adjustment_amount=amount,
            reason=reason, created_by=created_by,
        )
        # ONLY a note against a ledger-posted document may touch the ledger.
        # A manual invoice is deliberately off-ledger, so adjusting one used to
        # credit a receivable that had never been debited — inventing a contra
        # balance against no party. Distributor invoices are DIST's to post.
        if sales_invoice is not None:
            events.emit(
                "sales.adjustment_created",
                note_id=note.pk, note_type=note_type, amount=str(amount),
                party_id=sales_invoice.customer_id,
            )
    return note


def searchable_invoices(*, note_type, query="", limit=8, offset=0):
    """Invoices that can still take an adjustment note.

    One note per invoice, ever — allowing a second would let the same credit be
    issued twice against one document.
    """
    # Paging comes straight from a query string — a non-numeric value is a bad
    # request, not a server error.
    try:
        limit = max(1, min(int(limit or 8), 50))
        offset = max(0, int(offset or 0))
    except (TypeError, ValueError):
        raise ValidationError({"limit": "limit and offset must be whole numbers."})

    if note_type == AdjustmentNote.Type.CREDIT:
        qs = SalesInvoice.objects.filter(adjustments__isnull=True).select_related("customer")
        if query:
            qs = qs.filter(invoice_number__icontains=query) | qs.filter(
                customer__name__icontains=query)
        rows = [{
            "id": inv.pk, "invoice_number": inv.invoice_number,
            "customer_name": inv.customer.name if inv.customer_id else "",
            "total_amount": float(inv.total or 0), "date": inv.invoice_date.isoformat(),
            "type": "Sales Invoice",
        } for inv in qs.order_by("-invoice_date", "-id")[offset:offset + limit + 1]]
    else:
        qs = ManualInvoice.objects.filter(adjustments__isnull=True)
        if query:
            qs = qs.filter(invoice_number__icontains=query) | qs.filter(
                customer_name__icontains=query)
        rows = [{
            "id": inv.pk, "invoice_number": inv.invoice_number,
            "customer_name": inv.customer_name,
            "total_amount": float(inv.grand_total or 0), "date": inv.invoice_date.isoformat(),
            "type": "Manual Invoice",
        } for inv in qs.order_by("-invoice_date", "-id")[offset:offset + limit + 1]]

    has_more = len(rows) > limit
    rows = rows[:limit]
    return {"results": rows, "has_more": has_more, "count": len(rows)}
