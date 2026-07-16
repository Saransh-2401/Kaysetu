"""
ORDERS module — Sales Orders & Dispatch. Lives in EACH TENANT'S database.

Ported from the previous platform's sales app (SalesOrder/PickList/Invoice),
decoupled: customer -> Foundation Party, agent -> TenantUser, lines ->
CatalogItem. Orders arrive here from the FIELD module via the `field.order_booked`
event (never an import). Imports only foundation.
"""
from django.db import models


class SalesOrder(models.Model):
    class Status(models.TextChoices):
        PROCESSING = "processing", "Processing"       # awaiting approval
        CONFIRMED = "order_confirmed", "Order Confirmed"
        PACKED = "packed", "Packed"
        IN_TRANSIT = "in_transit", "In-Transit"
        DELIVERED = "delivered", "Delivered"
        REJECTED = "rejected", "Rejected"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual (back-office)"
        FIELD = "field", "Field agent"

    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer = models.ForeignKey("foundation.Party", on_delete=models.PROTECT, related_name="sales_orders")
    assigned_agent = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="sales_orders"
    )
    order_date = models.DateField()
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    # Link back to the originating FIELD order (so FIELD can show fulfilment).
    field_order_id = models.IntegerField(null=True, blank=True, db_index=True)

    currency = models.CharField(max_length=3, default="INR")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    billing_address = models.JSONField(default=dict, blank=True)
    shipping_address = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROCESSING)
    payment_status = models.CharField(max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-order_date", "-id"]
        indexes = [models.Index(fields=["status", "-order_date"])]

    def __str__(self):
        return self.order_number


class SalesOrderItem(models.Model):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT, related_name="+")
    item_name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class StatusLog(models.Model):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="status_logs")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    actor_name = models.CharField(max_length=200, blank=True)
    note = models.CharField(max_length=200, blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]


class PickList(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PICKED = "picked", "Picked"

    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="pick_lists")
    picker = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="pick_lists"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)


class DeliveryNote(models.Model):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="delivery_notes")
    note_number = models.CharField(max_length=50, unique=True)
    transporter = models.CharField(max_length=200, blank=True)
    vehicle_number = models.CharField(max_length=40, blank=True)
    driver_name = models.CharField(max_length=120, blank=True)
    driver_phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Invoice(models.Model):
    """Lightweight invoice (full GST e-invoicing lives in the BOOKS module)."""

    order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, related_name="invoices")
    invoice_number = models.CharField(max_length=50, unique=True)
    invoice_date = models.DateField()
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class Payment(models.Model):
    class Mode(models.TextChoices):
        CASH = "cash", "Cash"
        UPI = "upi", "UPI"
        CHEQUE = "cheque", "Cheque"
        BANK = "bank", "Bank Transfer"

    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.CASH)
    reference = models.CharField(max_length=100, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
