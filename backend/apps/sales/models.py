"""
SALES module — the customer-facing document layer.

ORDERS records what was agreed and dispatched; BOOKS records what it did to the
ledger. Neither is the *invoice a customer receives*: that needs a GST split per
line, an HSN code, a due date, a discount and a running balance. This app owns
that document, plus the two things that adjust it — payments and credit/debit
notes — and the free-text manual invoice, which has no order behind it at all.

Imports ONLY foundation. The link back to a sales order is a loose integer, the
same convention PURCH uses for warehouses, so SALES stays import-free.
"""
from django.db import models


class SalesInvoice(models.Model):
    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"

    class TaxMode(models.TextChoices):
        PERCENTAGE = "percentage", "Percentage"
        RUPEE = "rupee", "Rupee"

    class DiscountType(models.TextChoices):
        AMOUNT = "amount", "Amount"
        PERCENTAGE = "percentage", "Percentage"

    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer = models.ForeignKey("foundation.Party", on_delete=models.PROTECT,
                                 related_name="sales_invoices")
    # Loose reference to orders.SalesOrder — unique so one order cannot be
    # invoiced twice, which would double-bill the customer AND double-post to
    # the ledger. Nullable: a direct invoice needs no order.
    sales_order_id = models.IntegerField(null=True, blank=True, unique=True, db_index=True)
    sales_order_number = models.CharField(max_length=50, blank=True)

    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)

    is_tax_inclusive = models.BooleanField(default=False)
    tax_input_mode = models.CharField(max_length=20, choices=TaxMode.choices,
                                      default=TaxMode.PERCENTAGE)
    is_igst = models.BooleanField(default=False)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    discount_type = models.CharField(max_length=20, choices=DiscountType.choices,
                                     default=DiscountType.AMOUNT)
    discount_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Real cash received, and nothing else. Deriving this from `outstanding`
    # made a credit note look like a payment — the invoice reported money
    # collected that never arrived, and a debit note erased a receipt that had.
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Signed net of adjustment notes: credits negative, debits positive. Kept
    # apart from `total` so the issued document stays immutable and from
    # `paid_amount` so cash stays honest.
    adjustment_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    outstanding_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices,
                                      default=PaymentStatus.UNPAID, db_index=True)
    payment_reference = models.CharField(max_length=100, blank=True)

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey("foundation.TenantUser", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="sales_invoices")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-invoice_date", "-id"]
        indexes = [models.Index(fields=["customer", "-invoice_date"])]

    def __str__(self):
        return self.invoice_number


class SalesInvoiceItem(models.Model):
    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", null=True, blank=True,
                             on_delete=models.PROTECT, related_name="sales_invoice_items")
    item_name = models.CharField(max_length=200)
    hsn_code = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)

    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    taxable_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]


class ManualInvoice(models.Model):
    """An invoice raised against a name, not a Party — the one-off sale that
    never went through the order pipeline. Free-text by design."""

    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"
        CANCELLED = "cancelled", "Cancelled"

    class TaxType(models.TextChoices):
        CGST_SGST = "cgst_sgst", "CGST + SGST"
        IGST = "igst", "IGST"

    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer_name = models.CharField(max_length=255)
    customer_address = models.TextField(blank=True)
    customer_gstin = models.CharField(max_length=20, blank=True)

    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)

    tax_type = models.CharField(max_length=20, choices=TaxType.choices, default=TaxType.CGST_SGST)
    is_tax_inclusive = models.BooleanField(default=True)

    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    advance_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    payment_reference = models.CharField(max_length=100, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices,
                              default=Status.UNPAID, db_index=True)

    created_by = models.ForeignKey("foundation.TenantUser", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="manual_invoices")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-invoice_date", "-created_at"]

    def __str__(self):
        return self.invoice_number


class ManualInvoiceItem(models.Model):
    manual_invoice = models.ForeignKey(ManualInvoice, on_delete=models.CASCADE,
                                       related_name="items")
    item_name = models.CharField(max_length=255)
    hsn_code = models.CharField(max_length=20, blank=True)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    taxable_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]


class PaymentEntry(models.Model):
    class Mode(models.TextChoices):
        CASH = "cash", "Cash"
        BANK = "bank", "Bank Transfer"
        UPI = "upi", "UPI"
        CHEQUE = "cheque", "Cheque"
        CARD = "card", "Card"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        CLEARED = "cleared", "Cleared"
        BOUNCED = "bounced", "Bounced"

    payment_number = models.CharField(max_length=50, unique=True, db_index=True)
    sales_invoice = models.ForeignKey(SalesInvoice, null=True, blank=True,
                                      on_delete=models.PROTECT, related_name="payments")
    sales_order_id = models.IntegerField(null=True, blank=True, db_index=True)

    payment_date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.BANK)
    company_bank_account = models.CharField(max_length=100, blank=True)
    reference_no = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    remarks = models.TextField(blank=True)

    created_by = models.ForeignKey("foundation.TenantUser", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="payment_entries")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-id"]


class AdjustmentNote(models.Model):
    """Credit and debit notes — the only things besides a payment that move an
    invoice's balance."""

    class Type(models.TextChoices):
        CREDIT = "credit", "Credit Note"
        DEBIT = "debit", "Debit Note"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"

    note_number = models.CharField(max_length=50, unique=True, db_index=True)
    note_type = models.CharField(max_length=10, choices=Type.choices, db_index=True)

    sales_invoice = models.ForeignKey(SalesInvoice, null=True, blank=True,
                                      on_delete=models.PROTECT, related_name="adjustments")
    manual_invoice = models.ForeignKey(ManualInvoice, null=True, blank=True,
                                       on_delete=models.PROTECT, related_name="adjustments")
    # Loose reference to distribution.DistributorInvoice (SALES imports no module).
    distributor_invoice_id = models.IntegerField(null=True, blank=True, db_index=True)

    adjustment_date = models.DateField()
    adjustment_amount = models.DecimalField(max_digits=15, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)

    created_by = models.ForeignKey("foundation.TenantUser", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="adjustment_notes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-adjustment_date", "-created_at"]
