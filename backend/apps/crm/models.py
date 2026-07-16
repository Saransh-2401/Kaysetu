"""
CRM module — Leads & Pipeline. Lives in EACH TENANT'S database.

A Lead is a PIPELINE FACET over a Foundation Party (kind=prospect): the party
carries the shared identity (name/phone/email/address) so FIELD can visit it
and ORDERS can bill it with zero coupling, while the Lead carries the sales
pipeline (source, status, follow-ups). On conversion the party flips to a
customer. Imports only foundation.
"""
from django.db import models


class Lead(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REPLIED = "replied", "Replied"
        INTERESTED = "interested", "Interested"
        QUALIFIED = "qualified", "Qualified"
        CONVERTED = "converted", "Converted"
        LOST = "lost", "Lost"

    class Source(models.TextChoices):
        COLD_CALLING = "cold_calling", "Cold Calling"
        EXHIBITION = "exhibition", "Exhibition"
        CAMPAIGN = "campaign", "Campaign"
        WEBSITE = "website", "Website"
        REFERRAL = "referral", "Referral"
        EXISTING_CUSTOMER = "existing_customer", "Existing Customer"
        FIELD_VISIT = "field_visit", "Field Visit"
        OTHER = "other", "Other"

    # The prospect's shared identity — a Foundation Party (kind=prospect while
    # open; flipped to customer on conversion).
    party = models.ForeignKey(
        "foundation.Party", on_delete=models.SET_NULL, null=True, related_name="leads"
    )
    assigned_to = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="leads"
    )

    company_name = models.CharField(max_length=200, blank=True)
    source = models.CharField(max_length=30, choices=Source.choices, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)
    industry = models.CharField(max_length=100, blank=True)
    territory = models.CharField(max_length=100, blank=True)
    employee_count = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"lead {self.pk} ({self.status})"


class LeadActivity(models.Model):
    """Lifecycle timeline entry for a lead (status change, note, contact)."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="activities")
    action = models.CharField(max_length=60)
    detail = models.JSONField(default=dict, blank=True)
    actor_name = models.CharField(max_length=200, blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]
