"""Marketing leads — control plane (default DB).

A lead arrives from kaysetu.in BEFORE any tenant exists, so it cannot live in a
tenant database: there is no tenant to put it in. It sits beside Tenant in the
control plane, which is also where the ops team already works its support
queue.

Distinct from ``crm.Lead``: that one belongs to a customer's own sales pipeline
inside their tenant DB. This one is *our* pipeline — people asking to buy
KaySetu.
"""
from django.db import models

from apps.control.models import AdminUser, Tenant


class Lead(models.Model):
    class Source(models.TextChoices):
        CONTACT_FORM = "contact_form", "Contact form"
        FOOTER_DEMO = "footer_demo", "Footer demo request"
        INSTANT_DEMO = "instant_demo", "Instant demo"
        PRICING = "pricing", "Pricing enquiry"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        QUALIFIED = "qualified", "Qualified"
        CONVERTED = "converted", "Converted"
        LOST = "lost", "Lost"
        SPAM = "spam", "Spam"

    # What the visitor typed
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    company = models.CharField(max_length=150, blank=True)
    message = models.TextField(blank=True)
    attachment_url = models.URLField(max_length=1000, blank=True)

    source = models.CharField(max_length=20, choices=Source.choices, default=Source.CONTACT_FORM)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)

    # Attribution — captured so spend can be traced to pipeline later.
    utm_source = models.CharField(max_length=100, blank=True)
    utm_medium = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)
    page_url = models.URLField(max_length=500, blank=True)
    referrer = models.URLField(max_length=500, blank=True)

    # Abuse forensics (the public endpoint is unauthenticated).
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)

    assigned_to = models.ForeignKey(
        AdminUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_leads"
    )
    # Set when this lead becomes a paying org, so ops can see conversion.
    converted_tenant = models.ForeignKey(
        Tenant, null=True, blank=True, on_delete=models.SET_NULL, related_name="source_leads"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    contacted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email"]), models.Index(fields=["source", "status"])]

    @property
    def reference(self) -> str:
        return f"LEAD-{self.pk:05d}"

    def __str__(self):
        return f"{self.reference} {self.name} <{self.email}>"


class LeadNote(models.Model):
    """Internal follow-up trail. Never shown to the person who enquired."""

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(AdminUser, null=True, on_delete=models.SET_NULL, related_name="lead_notes")
    author_name = models.CharField(max_length=150, blank=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.lead_id} note @{self.created_at:%Y-%m-%d %H:%M}"
