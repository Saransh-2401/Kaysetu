"""
PURCH module — Procurement. Lives in EACH TENANT'S database.

The buy-side mirror of ORDERS: Material Request -> Purchase Order -> Goods
Receipt (GRN) -> Purchase Bill. Suppliers are foundation Parties (kind=supplier);
items are foundation CatalogItems. Imports ONLY foundation.

Integration is event-only, no cross-module import:
  - a completed GRN emits `purchase.goods_received` -> INV adds the stock
  - a booked bill emits `purchase.bill_issued`      -> BOOKS posts Dr Inventory /
    Dr GST Input / Cr Accounts Payable
  - a supplier payment emits `purchase.payment_made` -> BOOKS posts Dr AP / Cr Cash
"""
from django.db import models


class MaterialRequest(models.Model):
    """An internal request to procure items; approved MRs become Purchase Orders."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        ORDERED = "ordered", "Ordered"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    required_date = models.DateField(null=True, blank=True)
    purpose = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    reject_reason = models.CharField(max_length=255, blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="material_requests"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class MaterialRequestItem(models.Model):
    request = models.ForeignKey(MaterialRequest, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT, related_name="mr_items")
    item_name = models.CharField(max_length=200, blank=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    estimated_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supplier = models.ForeignKey(
        "foundation.Party", null=True, blank=True, on_delete=models.SET_NULL, related_name="mr_suggested_items"
    )
    specification = models.TextField(blank=True)

    class Meta:
        ordering = ["id"]


class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        APPROVED = "approved", "Approved"
        SENT = "sent", "Sent to Supplier"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"

    class ReceiptStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIAL = "partial", "Partially Received"
        RECEIVED = "received", "Received"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    supplier = models.ForeignKey("foundation.Party", on_delete=models.PROTECT, related_name="purchase_orders")
    order_date = models.DateField()
    delivery_date = models.DateField(null=True, blank=True)
    material_request = models.ForeignKey(
        MaterialRequest, null=True, blank=True, on_delete=models.SET_NULL, related_name="purchase_orders"
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    receipt_status = models.CharField(max_length=12, choices=ReceiptStatus.choices, default=ReceiptStatus.PENDING)
    payment_status = models.CharField(max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    payment_terms = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class PurchaseOrderItem(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT, related_name="po_items")
    item_name = models.CharField(max_length=200, blank=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    received_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        ordering = ["id"]


class GoodsReceipt(models.Model):
    """A GRN — goods physically received against a PO. Completing it hands the
    quantities to INV (which owns stock) via an event; PURCH holds no stock."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        COMPLETED = "completed", "Completed"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="receipts")
    supplier = models.ForeignKey("foundation.Party", on_delete=models.PROTECT, related_name="grn_receipts")
    receipt_date = models.DateField()
    # Loose reference to an INV warehouse (INV owns the Warehouse table; no FK to
    # keep PURCH import-free). None => INV receives into its default warehouse.
    warehouse_id = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class GoodsReceiptItem(models.Model):
    receipt = models.ForeignKey(GoodsReceipt, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT, related_name="grn_items")
    item_name = models.CharField(max_length=200, blank=True)
    quantity_ordered = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    quantity_accepted = models.DecimalField(max_digits=14, decimal_places=3)
    quantity_rejected = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]


class PurchaseBill(models.Model):
    """Supplier's invoice. Booking it posts to the ledger (Dr Inventory/GST Input,
    Cr Accounts Payable) via an event BOOKS subscribes to."""

    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    supplier_invoice_no = models.CharField(max_length=100, blank=True)
    purchase_order = models.ForeignKey(
        PurchaseOrder, null=True, blank=True, on_delete=models.SET_NULL, related_name="bills"
    )
    supplier = models.ForeignKey("foundation.Party", on_delete=models.PROTECT, related_name="purchase_bills")
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UNPAID)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class BillPayment(models.Model):
    class Mode(models.TextChoices):
        CASH = "cash", "Cash"
        BANK = "bank", "Bank Transfer"
        UPI = "upi", "UPI"
        CHEQUE = "cheque", "Cheque"

    bill = models.ForeignKey(PurchaseBill, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.BANK)
    reference = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_at", "-id"]
