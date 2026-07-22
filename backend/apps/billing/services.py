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
        per_user_unit = package.per_user_price * 12
    else:
        base = package.base_price_monthly
        per_user_unit = package.per_user_price
    extra = per_user_unit * extra_users
    subtotal = (base + extra).quantize(TWO)
    tax = (subtotal * Decimal(settings.BILLING["GST_RATE"]) / 100).quantize(TWO)
    return {
        "package_code": package.code,
        "package_name": package.name,
        "seats": seats,
        "included_users": package.included_users,
        "extra_users": extra_users,
        "billing_cycle": cycle,
        "currency": "INR",
        # Frozen line-item prices — the GST invoice renders from these, so a
        # later package price change never rewrites an already-issued invoice.
        "base": str(base.quantize(TWO)),
        "per_user_unit": str(per_user_unit.quantize(TWO)),
        "extra_amount": str(extra.quantize(TWO)),
        "subtotal": str(subtotal),
        "tax_rate": settings.BILLING["GST_RATE"],
        "tax": str(tax),
        "total": str((subtotal + tax).quantize(TWO)),
    }


def seat_limit(tenant: Tenant) -> int | None:
    """Paid seats if a subscription exists (incl. past_due — grace period),
    else the package's included users during trial. None = no cap."""
    subscription = (
        tenant.subscriptions.filter(
            status__in=[Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE]
        )
        .order_by("-started_at")
        .first()
    )
    if subscription:
        return subscription.seats
    return tenant.package.included_users if tenant.package_id else None


def seat_usage(tenant: Tenant) -> int:
    """Active users inside the tenant's own database."""
    from apps.foundation.models import TenantUser
    from apps.tenancy.context import use_tenant

    with use_tenant(tenant):
        return TenantUser.objects.filter(is_active=True).count()


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
    """Two-stage dunning, run daily by the scheduler.

    Stage 1 — period ended: subscription -> PAST_DUE. The tenant keeps working
    through the grace window; the portal banner tells them to pay.
    Stage 2 — grace exhausted: tenant -> SUSPENDED (login blocked) for lapsed
    trials and unpaid PAST_DUE subscriptions alike.
    """
    grace = timezone.timedelta(days=settings.BILLING["GRACE_DAYS"])
    now = timezone.now()
    suspended, past_due = [], []

    newly_due = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE, current_period_end__lt=now
    ).select_related("tenant")
    for subscription in newly_due:
        subscription.status = Subscription.Status.PAST_DUE
        subscription.save(update_fields=["status"])
        past_due.append(subscription.tenant.org_code)

    expired_trials = Tenant.objects.filter(
        status=Tenant.Status.TRIAL, trial_ends_at__lt=now - grace
    ).exclude(subscriptions__status=Subscription.Status.ACTIVE)
    for tenant in expired_trials:
        tenant.status = Tenant.Status.SUSPENDED
        tenant.save(update_fields=["status", "updated_at"])
        suspended.append(tenant.org_code)

    lapsed = Subscription.objects.filter(
        status=Subscription.Status.PAST_DUE, current_period_end__lt=now - grace
    ).select_related("tenant")
    for subscription in lapsed:
        tenant = subscription.tenant
        if tenant.status == Tenant.Status.ACTIVE:
            tenant.status = Tenant.Status.SUSPENDED
            tenant.save(update_fields=["status", "updated_at"])
            suspended.append(tenant.org_code)

    if suspended or past_due:
        ControlAuditLog.objects.create(
            action="billing.dunning_sweep",
            after={"suspended": suspended, "past_due": past_due},
        )
    return {"suspended": suspended, "past_due": past_due}
