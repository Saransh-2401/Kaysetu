"""
Tenant provisioning — the machinery that replaces seed scripts.

provision_tenant() takes a control-plane Tenant from "a row in the control DB"
to "a working portal": physical DB -> migrations -> industry preset ->
role templates -> entitlement snapshot -> owner login. Every step is
idempotent (get_or_create) so a failed job can simply be retried.
"""
import logging
import traceback

from django.core.management import call_command
from django.utils import timezone

from .context import use_tenant
from .db import create_database_if_needed, ensure_alias

logger = logging.getLogger("kaysetu.provisioning")

# Labels each industry preset applies inside the tenant DB. The tenant admin
# can edit any of these later (Settings -> Terminology).
INDUSTRY_PRESETS = {
    "manufacturing": {
        "catalog_item": "Product",
        "catalog": "Products",
        "party_customer": "Customer",
        "party_supplier": "Supplier",
        "visit": "Visit",
    },
    "distribution": {
        "catalog_item": "Product",
        "catalog": "Products",
        "party_customer": "Retailer",
        "party_supplier": "Supplier",
        "visit": "Visit",
    },
    "services": {
        "catalog_item": "Service",
        "catalog": "Services",
        "party_customer": "Client",
        "party_supplier": "Vendor",
        "visit": "Meeting",
    },
    "generic": {
        "catalog_item": "Item",
        "catalog": "Catalog",
        "party_customer": "Customer",
        "party_supplier": "Supplier",
        "visit": "Visit",
    },
}

# Role templates activated per purchased module (blueprint §4/§5).
MODULE_ROLE_TEMPLATES = {
    "TRACK": [("field_manager", "Field Manager"), ("field_agent", "Field Agent")],
    "FIELD": [("sales_manager", "Sales Manager"), ("sales_agent", "Sales Agent")],
    "ORDERS": [("dispatcher", "Dispatcher")],
    "DIST": [("distributor", "Distributor")],
    "INV": [("warehouse_manager", "Warehouse Manager")],
    "PROD": [("production_manager", "Production Manager")],
    "PURCH": [("purchase_manager", "Purchase Manager")],
    "BOOKS": [("accounts_officer", "Accounts Officer")],
    "CRM": [],
    "ATT": [],
    "TA": [],
}


class ProvisioningError(Exception):
    pass


def provision_tenant(tenant, owner_password=None, job=None):
    """Run (or re-run) full provisioning for a tenant. Returns the job."""
    from apps.control.models import ProvisioningJob

    if job is None:
        job = ProvisioningJob.objects.create(tenant=tenant, job_type=ProvisioningJob.Type.CREATE)
    job.status = ProvisioningJob.Status.RUNNING
    job.started_at = timezone.now()
    job.attempts += 1
    job.append_log(f"attempt {job.attempts}: provisioning started")
    job.save()

    try:
        create_database_if_needed(tenant)
        job.append_log("database ready")

        alias = ensure_alias(tenant)
        call_command("migrate", database=alias, interactive=False, verbosity=0)
        job.append_log("migrations applied")

        modules = tenant.entitled_modules()
        with use_tenant(tenant):
            _apply_baseline(tenant, modules, owner_password)
        job.append_log(f"baseline applied (modules: {', '.join(modules) or 'none'})")

        if tenant.status in (tenant.Status.PROVISIONING, tenant.Status.FAILED):
            tenant.status = tenant.Status.TRIAL if tenant.trial_ends_at else tenant.Status.ACTIVE
            tenant.save(update_fields=["status", "updated_at"])

        job.status = ProvisioningJob.Status.DONE
        job.finished_at = timezone.now()
        job.append_log("done")
        job.save()
        logger.info("provisioned tenant %s (%s)", tenant.org_code, tenant.slug)
        return job
    except Exception as exc:
        job.status = ProvisioningJob.Status.FAILED
        job.append_log(f"FAILED: {exc}\n{traceback.format_exc()}")
        job.finished_at = timezone.now()
        job.save()
        tenant.status = tenant.Status.FAILED
        tenant.save(update_fields=["status", "updated_at"])
        logger.exception("provisioning failed for tenant %s", tenant.org_code)
        raise ProvisioningError(str(exc)) from exc


def _apply_baseline(tenant, modules, owner_password):
    """Create baseline data inside the tenant DB. Must stay idempotent."""
    from apps.foundation.models import EntitlementSnapshot, OrgSettings, Role, TenantUser

    OrgSettings.objects.get_or_create(
        pk=1,
        defaults={
            "company_name": tenant.name,
            "industry": tenant.industry,
            "labels": INDUSTRY_PRESETS.get(tenant.industry, INDUSTRY_PRESETS["generic"]),
        },
    )

    admin_role, _ = Role.objects.get_or_create(
        slug="admin",
        defaults={"name": "Admin", "is_system": True, "permissions": {"*": ["*"]}},
    )
    _ensure_role_templates(modules)

    owner, created = TenantUser.objects.get_or_create(
        email=tenant.owner_email,
        defaults={
            "full_name": tenant.owner_name,
            "phone": tenant.owner_phone,
            "role": admin_role,
            "is_owner": True,
        },
    )
    if created:
        if owner_password:
            owner.set_password(owner_password)
        else:
            owner.set_unusable_password()
        owner.save()

    # Seed per-module baseline (e.g. BOOKS chart of accounts) BEFORE flipping the
    # entitlement gate on, so an entitled module can never observe missing setup.
    _apply_module_setup(modules)
    _write_snapshot(modules)


def _apply_module_setup(modules):
    """Per-module baseline data (idempotent). Only for entitled modules; a
    module's setup never imports another module."""
    if "TRACK" in modules:
        from apps.tracking.models import TrackingSettings

        TrackingSettings.objects.get_or_create(pk=1)
    if "INV" in modules:
        from apps.inventory.models import Warehouse

        if not Warehouse.objects.exists():
            Warehouse.objects.create(name="Main Warehouse", code="MAIN", is_default=True)
    if "BOOKS" in modules:
        from apps.books.services import seed_chart_of_accounts

        seed_chart_of_accounts()


def _ensure_role_templates(modules):
    from apps.foundation.models import Role

    for module_code in modules:
        for slug, name in MODULE_ROLE_TEMPLATES.get(module_code, []):
            Role.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "is_system": True,
                    "permissions": {module_code: ["*"]},
                },
            )


def _write_snapshot(modules):
    from apps.foundation.models import EntitlementSnapshot

    EntitlementSnapshot.objects.update_or_create(
        pk=1, defaults={"modules": sorted(modules), "synced_at": timezone.now()}
    )


def sync_entitlements(tenant):
    """Push the control-plane entitlement state into the tenant DB snapshot.

    Called whenever the SuperAdmin (or a purchase) enables/disables a tenant's
    modules. Because a newly-enabled module may ship tables the tenant DB does
    not yet have, we MIGRATE first, then apply the module's baseline, then flip
    the entitlement snapshot LAST inside an atomic block — so a schema-dependent
    failure can never leave the runtime gate on with no schema behind it. This
    is what makes "upgrade to another module later" self-sufficient.
    """
    from django.db import transaction

    modules = tenant.entitled_modules()
    alias = ensure_alias(tenant)
    call_command("migrate", database=alias, interactive=False, verbosity=0)
    with use_tenant(tenant), transaction.atomic(using=alias):
        _ensure_role_templates(modules)
        _apply_module_setup(modules)
        _write_snapshot(modules)  # gate flips on only after setup succeeds
    return modules
