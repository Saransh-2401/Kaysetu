"""
TA module — Travel Allowance. Lives in EACH TENANT'S database.

Trips (auto-filled from TRACK's GPS distance when that module is installed) roll
up into a periodic claim that runs Manager -> Finance -> Paid. Imports ONLY
foundation; TRACK is asked for distance via capability, and BOOKS records the
payout via event.
"""
from django.db import models


class PolicyConfig(models.Model):
    """Reimbursement rates + caps, optionally per city and vehicle."""

    class Vehicle(models.TextChoices):
        BIKE = "bike", "Two-wheeler"
        CAR = "car", "Car"
        PUBLIC = "public", "Public transport"

    city = models.CharField(max_length=100, blank=True)   # blank = applies everywhere
    vehicle_type = models.CharField(max_length=10, choices=Vehicle.choices, default=Vehicle.BIKE)
    rate_per_km = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    max_daily_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_monthly_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("city", "vehicle_type")]
        ordering = ["city", "vehicle_type"]

    def __str__(self):
        return f"{self.city or 'All'} / {self.vehicle_type} @ {self.rate_per_km}"


class Trip(models.Model):
    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        GPS = "gps", "GPS (tracked)"

    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="trips"
    )
    date = models.DateField(db_index=True)
    distance_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    transport_mode = models.CharField(max_length=10, choices=PolicyConfig.Vehicle.choices,
                                      default=PolicyConfig.Vehicle.BIKE)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    # Admin choice of whether the day's distance is measured from home or office
    # (set at end-of-day); blank = use the policy default.
    basis = models.CharField(
        max_length=10, blank=True,
        choices=[("home", "From home"), ("office", "From office")],
    )
    notes = models.CharField(max_length=255, blank=True)
    claim = models.ForeignKey(
        "travel.AllowanceClaim", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="trips",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("agent", "date")]   # one trip record per agent per day
        ordering = ["-date", "-id"]

    @property
    def is_claimed(self):
        return self.claim_id is not None


def _claim_document_path(instance, filename):
    """Keep every tenant's uploads in their own directory."""
    from apps.tenancy.context import get_tenant

    tenant = get_tenant()
    slug = getattr(tenant, "slug", None) or "unknown"
    return f"ta/{slug}/claim-{instance.claim_id}/{filename}"


class AllowanceDocument(models.Model):
    """Supporting evidence attached to a claim (toll receipt, fuel bill, ...)."""

    class DocType(models.TextChoices):
        RECEIPT = "receipt", "Receipt"
        TOLL = "toll", "Toll"
        FUEL = "fuel", "Fuel"
        OTHER = "other", "Other"

    claim = models.ForeignKey(
        "travel.AllowanceClaim", on_delete=models.CASCADE, related_name="documents"
    )
    file = models.FileField(upload_to=_claim_document_path)
    file_name = models.CharField(max_length=255, blank=True)
    doc_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.RECEIPT)
    uploaded_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="ta_documents",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class AgentBankDetail(models.Model):
    """Where an agent's reimbursement is paid. One record per user."""

    agent = models.OneToOneField(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="bank_detail"
    )
    account_holder_name = models.CharField(max_length=200, blank=True)
    account_number = models.CharField(max_length=30, blank=True)
    ifsc_code = models.CharField(max_length=15, blank=True)
    bank_name = models.CharField(max_length=150, blank=True)
    upi_id = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["agent_id"]

    @property
    def masked_account_number(self):
        """Never echo a full account number back to a list screen."""
        number = self.account_number or ""
        return f"{'*' * max(0, len(number) - 4)}{number[-4:]}" if number else ""


class NotificationPreference(models.Model):
    """Per-user TA notification channel choices."""

    user = models.OneToOneField(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="ta_notification_prefs"
    )
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    in_app_enabled = models.BooleanField(default=True)
    deadline_reminders = models.BooleanField(default=True)
    unclaimed_reminders = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)


class AllowanceClaim(models.Model):
    """A period's trips rolled up, running Manager -> Finance -> Paid."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        MANAGER_APPROVED = "manager_approved", "Manager Approved"
        FINANCE_APPROVED = "finance_approved", "Finance Approved"
        PAID = "paid", "Paid"
        REJECTED = "rejected", "Rejected"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.PROTECT, related_name="allowance_claims"
    )
    period_start = models.DateField()
    period_end = models.DateField()
    total_distance_km = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    system_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    decision_note = models.CharField(max_length=255, blank=True)
    manager_approved_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="ta_manager_approvals",
    )
    finance_approved_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="ta_finance_approvals",
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-period_start", "-id"]

    def __str__(self):
        return self.number
