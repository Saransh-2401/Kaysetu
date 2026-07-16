"""Control-plane services: self-serve signup and entitlement management."""
import secrets

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.tenancy.provisioning import provision_tenant, sync_entitlements

from .models import Package, ProvisioningJob, Subscription, Tenant, TenantModule

ORG_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I


def generate_org_code() -> str:
    while True:
        code = "SLX-" + "".join(secrets.choice(ORG_CODE_ALPHABET) for _ in range(6))
        if not Tenant.objects.filter(org_code=code).exists():
            return code


def unique_slug(name: str) -> str:
    base = slugify(name)[:60] or "tenant"
    slug = base
    while Tenant.objects.filter(slug=slug).exists():
        slug = f"{base}-{secrets.token_hex(2)}"
    return slug


def signup(
    *,
    company_name: str,
    owner_name: str,
    owner_email: str,
    owner_phone: str = "",
    password: str,
    package_code: str,
    industry: str = Tenant.Industry.GENERIC,
    seats: int | None = None,
) -> Tenant:
    """Create + provision a tenant end-to-end (the no-seed-script path)."""
    package = Package.objects.get(code=package_code, is_published=True, is_addon=False)

    with transaction.atomic():
        slug = unique_slug(company_name)
        tenant = Tenant.objects.create(
            org_code=generate_org_code(),
            name=company_name,
            slug=slug,
            db_name=settings.TENANCY["DB_PREFIX"] + slug.replace("-", "_"),
            industry=industry,
            owner_name=owner_name,
            owner_email=owner_email,
            owner_phone=owner_phone,
            package=package,
            trial_ends_at=timezone.now() + timezone.timedelta(days=settings.TRIAL_DAYS),
        )
        for code in package.module_codes():
            TenantModule.objects.create(
                tenant=tenant, module_code=code, source=TenantModule.Source.PACKAGE
            )
        Subscription.objects.create(
            tenant=tenant,
            package=package,
            seats=seats or package.included_users,
            status=Subscription.Status.TRIALING,
            current_period_end=tenant.trial_ends_at,
        )
        job = ProvisioningJob.objects.create(tenant=tenant, job_type=ProvisioningJob.Type.CREATE)

    # Outside the transaction: touches the tenant database, not the control DB.
    provision_tenant(tenant, owner_password=password, job=job)
    return tenant


def set_tenant_modules(tenant: Tenant, module_codes: list[str]) -> list[str]:
    """SuperAdmin manual override of a tenant's entitlements."""
    module_codes = set(module_codes)
    existing = {tm.module_code: tm for tm in tenant.entitlements.all()}

    for code, tm in existing.items():
        should_be = code in module_codes
        if tm.enabled != should_be:
            tm.enabled = should_be
            tm.source = TenantModule.Source.MANUAL
            tm.save(update_fields=["enabled", "source"])
    for code in module_codes - existing.keys():
        TenantModule.objects.create(
            tenant=tenant, module_code=code, source=TenantModule.Source.MANUAL
        )

    # Record the SYNC job truthfully: RUNNING -> DONE only if the tenant-DB
    # sync (migrate + module setup + snapshot) actually succeeds, else FAILED.
    job = ProvisioningJob.objects.create(
        tenant=tenant, job_type=ProvisioningJob.Type.SYNC,
        status=ProvisioningJob.Status.RUNNING,
        log="entitlement sync via set_tenant_modules\n",
    )
    try:
        modules = sync_entitlements(tenant)
    except Exception as exc:
        job.status = ProvisioningJob.Status.FAILED
        job.append_log(f"FAILED: {exc}")
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "log", "finished_at"])
        raise
    job.status = ProvisioningJob.Status.DONE
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "finished_at"])
    return modules
