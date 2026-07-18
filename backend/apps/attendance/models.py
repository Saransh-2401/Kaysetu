"""
ATT module — Attendance & Leave. Lives in EACH TENANT'S database.

Office attendance (desk staff punching in/out), leave management and the holiday
calendar. Field-staff GPS attendance belongs to TRACK; this is the office side —
the two share one portal screen but are separately sellable. Imports ONLY foundation.
"""
from django.db import models


class Holiday(models.Model):
    date = models.DateField(unique=True, db_index=True)
    name = models.CharField(max_length=200)
    is_optional = models.BooleanField(default=False)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.date} {self.name}"


class OfficeAttendance(models.Model):
    class CheckOutType(models.TextChoices):
        MANUAL = "manual", "Manual"
        AUTO = "auto", "Auto (end of day)"
        ADMIN = "admin", "Closed by admin"

    user = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="office_attendance"
    )
    date = models.DateField(db_index=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    check_out_type = models.CharField(max_length=10, choices=CheckOutType.choices, blank=True)
    working_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    checked_out_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="closed_attendance",
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = [("user", "date")]
        ordering = ["-date", "-id"]

    @property
    def is_open(self):
        return self.check_in_time is not None and self.check_out_time is None


class LeaveType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    days_per_year = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    is_paid = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class LeaveRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    user = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="leave_requests"
    )
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="requests")
    from_date = models.DateField()
    to_date = models.DateField()
    days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    decision_note = models.CharField(max_length=255, blank=True)
    decided_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="leave_decisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-from_date", "-id"]
