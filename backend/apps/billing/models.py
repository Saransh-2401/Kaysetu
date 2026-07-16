"""Billing models — control plane (default DB). Money never lives in tenant DBs."""
from django.db import models

from apps.control.models import Package, Subscription, Tenant


class PaymentOrder(models.Model):
    """One checkout attempt. Created before the gateway order, marked paid by
    signature-verified callback or webhook (whichever lands first — idempotent)."""

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="payment_orders")
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="payment_orders")
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name="payment_orders")
    seats = models.PositiveIntegerField(default=1)
    billing_cycle = models.CharField(max_length=16, default="monthly")

    currency = models.CharField(max_length=8, default="INR")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    gateway = models.CharField(max_length=16, default="mock")  # mock | razorpay
    gateway_order_id = models.CharField(max_length=100, blank=True, db_index=True)
    gateway_payment_id = models.CharField(max_length=100, blank=True)

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CREATED)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant.org_code} {self.total} {self.currency} ({self.status})"
