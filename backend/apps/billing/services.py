"""Billing services: pricing quotes, checkout, payment application, dunning."""
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from apps.control.models import ControlAuditLog, Package, Subscription, Tenant, TenantModule
from apps.tenancy.provisioning import sync_entitlements

from .gateway import get_gateway
from .models import PaymentOrder

TWO = Decimal("0.01")


def quote(package: Package, seats: int, cycle: str) -> dict:
    """Price a subscription. Annual base uses the package's annual price;
    annual per-extra-user = monthly per-user x 12."""
    extra_users = max(0, seats - package.included_users)
    if cycle == Subscription.Cycle.ANNUAL:
        base = package.base_price_annual
        extra = package.per_user_price * 12 * extra_users
    else:
        base = package.base_price_monthly
        extra = package.per_user_price * extra_users
    subtotal = (base + extra).quantize(TWO)
    tax = (subtotal * Decimal(settings.BILLING["GST_RATE"]) / 100).quantize(TWO)
    return {
        "package_code": package.code,
        "seats": seats,
        "included_users": package.included_users,
        "extra_users": extra_users,
        "billing_cycle": cycle,
        "currency": "INR",
        "subtotal": str(subtotal),
        "tax_rate": settings.BILLING["GST_RATE"],
        "tax": str(tax),
        "total": str((subtotal + tax).quantize(TWO)),
    }


def start_checkout(tenant: Tenant, *, package_code: str, seats: int, cycle: str) -> PaymentOrder:
    package = Package.objects.get(code=package_code, is_published=True, is_addon=False)
    subscription = tenant.subscriptions.order_by("-started_at").first()
    if subscription is None:
        subscription = Subscription.objects.create(tenant=tenant, package=package, seats=seats)

    amounts = quote(package, seats, cycle)
    order = PaymentOrder.objects.create(
        tenant=tenant,
        subscription=subscription,
        package=package,
        seats=seats,
        billing_cycle=cycle,
        subtotal=Decimal(amounts["subtotal"]),
        tax=Decimal(amounts["tax"]),
        total=Decimal(amounts["total"]),
    )
    gateway = get_gateway()
    created = gateway.create_order(
        amount_paise=int(Decimal(amounts["total"]) * 100),
        currency="INR",
        receipt=f"po_{order.pk}",
    )
    order.gateway = gateway.name
    order.gateway_order_id = created["gateway_order_id"]
    order.meta = {"key_id": created["key_id"], "quote": amounts}
    order.save()
    return order


def apply_payment_success(order: PaymentOrder, payment_id: str = "") -> PaymentOrder:
    """Activate the subscription for a paid order. Idempotent — callback and
    webhook may both land."""
    if order.status == PaymentOrder.Status.PAID:
        return order

    now = timezone.now()
    order.status = PaymentOrder.Status.PAID
    order.gateway_payment_id = payment_id
    order.paid_at = now
    order.save()

    subscription = order.subscription
    package_changed = subscription.package_id != order.package_id
    subscription.package = order.package
    subscription.seats = order.seats
    subscription.billing_cycle = order.billing_cycle
    subscription.status = Subscription.Status.ACTIVE
    subscription.current_period_end = now + timezone.timedelta(
        days=365 if order.billing_cycle == Subscription.Cycle.ANNUAL else 30
    )
    subscription.save()

    tenant = order.tenant
    tenant.status = Tenant.Status.ACTIVE
    tenant.package = order.package
    tenant.save(update_fields=["status", "package", "updated_at"])

    if package_changed:
        _apply_package_entitlements(tenant, order.package)
    sync_entitlements(tenant)

    ControlAuditLog.objects.create(
        action="billing.payment_applied",
        entity="PaymentOrder",
        entity_id=str(order.pk),
        after={"tenant": tenant.org_code, "package": order.package.code, "total": str(order.total)},
    )
    return order


def _apply_package_entitlements(tenant: Tenant, package: Package):
    """Package switch: package-sourced rows follow the new package; manual
    overrides and add-ons are preserved."""
    new_codes = set(package.module_codes())
    for entitlement in tenant.entitlements.filter(source=TenantModule.Source.PACKAGE):
        if entitlement.module_code not in new_codes:
            entitlement.enabled = False
            entitlement.save(update_fields=["enabled"])
    for code in new_codes:
        obj, created = TenantModule.objects.get_or_create(
            tenant=tenant, module_code=code,
            defaults={"source": TenantModule.Source.PACKAGE},
        )
        if not created and not obj.enabled:
            obj.enabled = True
            obj.save(update_fields=["enabled"])


def run_dunning() -> dict:
    """Suspend tenants whose trial or paid period lapsed past the grace window.
    Reminder notifications hook in here once SMTP/SMS is configured."""
    grace = timezone.timedelta(days=settings.BILLING["GRACE_DAYS"])
    now = timezone.now()
    suspended = []

    expired_trials = Tenant.objects.filter(
        status=Tenant.Status.TRIAL, trial_ends_at__lt=now - grace
    ).exclude(subscriptions__status=Subscription.Status.ACTIVE)
    for tenant in expired_trials:
        tenant.status = Tenant.Status.SUSPENDED
        tenant.save(update_fields=["status", "updated_at"])
        suspended.append(tenant.org_code)

    lapsed = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE, current_period_end__lt=now - grace
    ).select_related("tenant")
    for subscription in lapsed:
        subscription.status = Subscription.Status.PAST_DUE
        subscription.save(update_fields=["status"])
        tenant = subscription.tenant
        if tenant.status == Tenant.Status.ACTIVE:
            tenant.status = Tenant.Status.SUSPENDED
            tenant.save(update_fields=["status", "updated_at"])
            suspended.append(tenant.org_code)

    if suspended:
        ControlAuditLog.objects.create(
            action="billing.dunning_suspend", after={"tenants": suspended}
        )
    return {"suspended": suspended}
