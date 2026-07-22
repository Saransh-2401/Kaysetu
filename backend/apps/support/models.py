"""Support tickets — control plane (default DB).

Tickets are raised by tenant users and worked by the SuperAdmin team, so they
live beside Tenant/Subscription where the ops console can query across every
org. The tenant author is captured as a snapshot (name/email) because tenant
users live in per-tenant databases and cross-plane FKs are impossible.
"""
from django.db import models

from apps.control.models import AdminUser, Tenant


class SupportTicket(models.Model):
    class Category(models.TextChoices):
        BILLING = "billing", "Billing & Subscription"
        TECHNICAL = "technical", "Technical Issue"
        DATA = "data", "Data / Reports"
        FEATURE = "feature_request", "Feature Request"
        OTHER = "other", "Other"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        WAITING_ON_CUSTOMER = "waiting_on_customer", "Waiting on Customer"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="support_tickets")
    subject = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN, db_index=True)

    # Snapshot of the tenant user who raised it (tenant users live in tenant DBs).
    created_by_name = models.CharField(max_length=150, blank=True)
    created_by_email = models.EmailField(blank=True)

    assigned_to = models.ForeignKey(
        AdminUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    last_reply_by = models.CharField(max_length=16, blank=True)  # tenant | superadmin

    class Meta:
        ordering = ["-updated_at"]

    @property
    def ticket_no(self) -> str:
        return f"TKT-{self.pk:05d}"

    def __str__(self):
        return f"{self.ticket_no} [{self.tenant.org_code}] {self.subject}"


class TicketMessage(models.Model):
    class AuthorKind(models.TextChoices):
        TENANT = "tenant", "Tenant"
        SUPERADMIN = "superadmin", "SuperAdmin"

    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="messages")
    author_kind = models.CharField(max_length=12, choices=AuthorKind.choices)
    author_name = models.CharField(max_length=150, blank=True)
    author_email = models.EmailField(blank=True)
    body = models.TextField()
    # Internal notes are superadmin-team-only and never serialized to tenants.
    is_internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.ticket_id}/{self.author_kind}@{self.created_at:%Y-%m-%d %H:%M}"
