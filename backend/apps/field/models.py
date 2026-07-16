"""
FIELD module — Field Sales Operations. Lives in EACH TENANT'S database.

Ported from the previous platform's field_sales.Visit / VisitImage /
SalesTarget / SalesCityTarget, decoupled: the visited customer/prospect is a
Foundation Party (not crm.Customer), the agent is a foundation.TenantUser, and
order lines reference the Foundation CatalogItem. A field order is a NEW
lightweight entity (there was none — agents booked a full sales.SalesOrder);
it emits an event the Orders module subscribes to when present.

Imports ONLY foundation. Cross-module data (tracking hours, order fulfilment,
notifications) flows through the capability registry / event bus.
"""
from django.db import models
from django.db.models import Q


class Visit(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        SKIPPED = "skipped", "Skipped"
        RESCHEDULED = "rescheduled", "Rescheduled"

    class Transport(models.TextChoices):
        BIKE = "bike", "Bike"
        WALK = "walk", "Walk"
        CAR = "car", "Car"

    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="visits"
    )
    # The visited party (customer or prospect) — Foundation Party, not a CRM model.
    party = models.ForeignKey(
        "foundation.Party", on_delete=models.PROTECT, related_name="visits",
        null=True, blank=True,
    )

    visit_date = models.DateField()
    scheduled_time = models.TimeField()

    actual_checkin_time = models.DateTimeField(null=True, blank=True)
    actual_checkout_time = models.DateTimeField(null=True, blank=True)
    checkin_location = models.JSONField(default=dict, blank=True)   # {lat,lng,address}
    checkout_location = models.JSONField(default=dict, blank=True)
    # Cross-checked against TRACK's live location when the TRACK module is on.
    gps_verified = models.BooleanField(default=False)

    visit_type = models.CharField(max_length=100, blank=True)
    purpose = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    checkout_notes = models.TextField(blank=True)
    outcome = models.CharField(max_length=100, blank=True)

    transport_mode = models.CharField(max_length=10, choices=Transport.choices, default=Transport.BIKE)
    distance_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    skip_reason = models.TextField(blank=True)
    reschedule_reason = models.TextField(blank=True)
    rescheduled_to = models.DateField(null=True, blank=True)
    rescheduled_time = models.TimeField(null=True, blank=True)

    checkin_selfie = models.URLField(max_length=1000, blank=True)
    voice_note_url = models.URLField(max_length=1000, blank=True)

    # Idempotency for the offline mobile client (client-generated uuid).
    client_uuid = models.CharField(max_length=64, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-visit_date", "-scheduled_time"]
        indexes = [
            models.Index(fields=["agent", "visit_date"]),
            models.Index(fields=["status", "-visit_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["client_uuid"], condition=~Q(client_uuid=""),
                name="field_visit_unique_client_uuid",
            )
        ]

    def __str__(self):
        return f"visit {self.pk} agent={self.agent_id} {self.status}"


class VisitImage(models.Model):
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name="images")
    image_url = models.URLField(max_length=1000)
    image_type = models.CharField(max_length=50, default="shop_image")
    created_at = models.DateTimeField(auto_now_add=True)


class SalesTarget(models.Model):
    """Monthly targets with a three-tier fallback (agent → global-monthly →
    default), enforced by partial unique constraints as in the original."""

    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="targets",
        null=True, blank=True,
    )
    month = models.PositiveSmallIntegerField(null=True, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    is_default = models.BooleanField(default=False)

    visit_target = models.IntegerField(default=0)
    order_target = models.IntegerField(default=0)
    stock_request_target = models.IntegerField(default=0)
    revenue_target = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock_request_revenue_target = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    new_client_target = models.IntegerField(default=0)
    login_hours_target = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    pincodes = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_default"], condition=Q(is_default=True),
                name="field_unique_default_target",
            ),
            models.UniqueConstraint(
                fields=["month", "year"],
                condition=Q(is_default=False, agent__isnull=True),
                name="field_unique_global_monthly_target",
            ),
            models.UniqueConstraint(
                fields=["agent", "month", "year"],
                condition=Q(is_default=False, agent__isnull=False),
                name="field_unique_agent_monthly_target",
            ),
        ]


class SalesCityTarget(models.Model):
    target = models.ForeignKey(SalesTarget, on_delete=models.CASCADE, related_name="city_targets")
    city = models.CharField(max_length=100)
    visit_target = models.IntegerField(default=0)
    order_target = models.IntegerField(default=0)
    stock_request_target = models.IntegerField(default=0)
    revenue_target = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock_request_revenue_target = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    new_client_target = models.IntegerField(default=0)
    login_hours_target = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        unique_together = [("target", "city")]
        ordering = ["city"]


class FieldOrder(models.Model):
    """A lightweight order an agent books in the field against the Foundation
    catalog. Standalone approve→done flow; emits `field.order_booked` so the
    Orders module can pull it into the full fulfilment pipeline when present."""

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONFIRMED = "confirmed", "Confirmed"
        DELIVERED = "delivered", "Delivered"
        REJECTED = "rejected", "Rejected"

    order_number = models.CharField(max_length=40, unique=True)
    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="field_orders"
    )
    party = models.ForeignKey(
        "foundation.Party", on_delete=models.PROTECT, related_name="field_orders"
    )
    order_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    client_uuid = models.CharField(max_length=64, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-order_date", "-id"]
        indexes = [models.Index(fields=["agent", "-order_date"])]

    def __str__(self):
        return self.order_number


class FieldOrderItem(models.Model):
    order = models.ForeignKey(FieldOrder, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT, related_name="+")
    item_name = models.CharField(max_length=200)   # snapshot at booking time
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class Collection(models.Model):
    """Payment an agent collects in the field. Emits `field.collection_recorded`
    so the Books module can post it to the ledger when present."""

    class Mode(models.TextChoices):
        CASH = "cash", "Cash"
        UPI = "upi", "UPI"
        CHEQUE = "cheque", "Cheque"

    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="collections"
    )
    party = models.ForeignKey(
        "foundation.Party", on_delete=models.PROTECT, related_name="collections"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.CASH)
    reference = models.CharField(max_length=100, blank=True)   # cheque/UPI ref
    against_invoice = models.CharField(max_length=64, blank=True)
    collected_at = models.DateTimeField(auto_now_add=True)
    client_uuid = models.CharField(max_length=64, blank=True, db_index=True)
