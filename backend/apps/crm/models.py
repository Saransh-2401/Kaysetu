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


class Quotation(models.Model):
    """A priced proposal sent to a prospect or customer.

    Sits between a lead and an order: winning one is what justifies raising a
    sales order. The customer is a foundation Party, so a quotation to a lead
    and a quotation to an existing customer are the same document.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        WON = "won", "Won"
        LOST = "lost", "Lost"
        EXPIRED = "expired", "Expired"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    party = models.ForeignKey("foundation.Party", on_delete=models.PROTECT,
                              related_name="quotations")
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="quotations")
    quotation_date = models.DateField()
    valid_until = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="INR")

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=12, choices=Status.choices,
                              default=Status.DRAFT, db_index=True)
    lost_reason = models.CharField(max_length=255, blank=True)
    terms_and_conditions = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    owner = models.ForeignKey("foundation.TenantUser", null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="quotations")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-quotation_date", "-id"]

    def __str__(self):
        return self.number

    @property
    def is_expired(self):
        from django.utils import timezone

        return bool(self.valid_until and self.valid_until < timezone.localdate()
                    and self.status in (self.Status.DRAFT, self.Status.SUBMITTED))


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT,
                             related_name="quotation_items")
    item_name = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]
