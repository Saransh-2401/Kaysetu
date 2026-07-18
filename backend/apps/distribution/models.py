"""
DIST module — Distribution Network. Lives in EACH TENANT'S database.

The distributor channel: a distributor raises a StockRequest, the company
approves (allocating what it can and recording any shortage), dispatches, and
invoices. Distributors are foundation Parties; items are foundation CatalogItems.
Imports ONLY foundation.

Integration is event-only:
  * dispatch  emits `dist.stock_dispatched` -> INV deducts COMPANY stock
  * invoicing emits `dist.invoice_issued`   -> BOOKS posts Dr AR / Cr Sales
DIST owns the DISTRIBUTOR's own stock (DistributorStock); INV owns the company's.
"""
from django.db import models


class DistributorStock(models.Model):
    """What a distributor currently holds — their book, not the company warehouse."""

    distributor = models.ForeignKey(
        "foundation.Party", on_delete=models.CASCADE, related_name="distributor_stock"
    )
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.CASCADE, related_name="distributor_stock")
    on_hand = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    low_stock_threshold = models.DecimalField(max_digits=14, decimal_places=3, default=10)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("distributor", "item")]
        ordering = ["distributor_id", "item_id"]

    @property
    def is_low(self):
        return self.on_hand <= self.low_stock_threshold


class StockRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        DISPATCHED = "dispatched", "Dispatched"
        DELIVERED = "delivered", "Delivered"
        REJECTED = "rejected", "Rejected"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        INVOICED = "invoiced", "Invoiced"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    distributor = models.ForeignKey(
        "foundation.Party", on_delete=models.PROTECT, related_name="stock_requests"
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    payment_status = models.CharField(max_length=16, choices=PaymentStatus.choices,
                                      default=PaymentStatus.UNPAID, db_index=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    has_shortage = models.BooleanField(default=False)
    reject_reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="approved_stock_requests",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return self.number


class StockRequestItem(models.Model):
    request = models.ForeignKey(StockRequest, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT, related_name="stock_request_items")
    item_name = models.CharField(max_length=200, blank=True)
    requested_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    approved_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    shortage_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]


class StockRequestLog(models.Model):
    """Status trail — who moved the request and when."""

    request = models.ForeignKey(StockRequest, on_delete=models.CASCADE, related_name="logs")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    note = models.CharField(max_length=255, blank=True)
    actor = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="stock_request_logs"
    )
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at", "-id"]


class DistributorInvoice(models.Model):
    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    # unique: one invoice per request, enforced by the DB so a concurrent
    # double-invoice cannot slip past the application check.
    request = models.ForeignKey(StockRequest, on_delete=models.PROTECT,
                                related_name="invoices", unique=True)
    distributor = models.ForeignKey(
        "foundation.Party", on_delete=models.PROTECT, related_name="distributor_invoices"
    )
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UNPAID)
    payment_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class DistributorPayment(models.Model):
    """A collection against a distributor invoice. A real row (rather than a
    synthesised key) gives BOOKS a stable, unique idempotency handle."""

    class Mode(models.TextChoices):
        CASH = "cash", "Cash"
        BANK = "bank", "Bank Transfer"
        UPI = "upi", "UPI"
        CHEQUE = "cheque", "Cheque"

    invoice = models.ForeignKey(DistributorInvoice, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.BANK)
    reference = models.CharField(max_length=100, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at", "-id"]
