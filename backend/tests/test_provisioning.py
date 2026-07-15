from pathlib import Path

import pytest

from apps.control.models import ProvisioningJob, Subscription
from apps.tenancy.context import use_tenant
from apps.tenancy.provisioning import provision_tenant

pytestmark = pytest.mark.django_db(databases="__all__")


def test_signup_provisions_a_working_tenant(make_tenant, settings):
    tenant, _ = make_tenant(package_code="P2")  # Sales Management = FIELD

    # Physical tenant database exists
    db_file = Path(settings.TENANCY["SQLITE_DIR"]) / f"{tenant.db_name}.sqlite3"
    assert db_file.exists()

    # Control-plane state
    assert tenant.status == "trial"
    assert tenant.trial_ends_at is not None
    assert tenant.entitled_modules() == ["FIELD"]
    assert Subscription.objects.filter(tenant=tenant, status="trialing").exists()
    job = tenant.jobs.get(job_type=ProvisioningJob.Type.CREATE)
    assert job.status == ProvisioningJob.Status.DONE
    assert "done" in job.log

    # Tenant-plane baseline
    from apps.foundation.models import EntitlementSnapshot, OrgSettings, Role, TenantUser

    with use_tenant(tenant):
        assert OrgSettings.objects.get(pk=1).company_name == tenant.name
        assert EntitlementSnapshot.current_modules() == ["FIELD"]
        role_slugs = set(Role.objects.values_list("slug", flat=True))
        assert {"admin", "sales_manager", "sales_agent"} <= role_slugs
        assert "field_agent" not in role_slugs  # TRACK not purchased
        owner = TenantUser.objects.get(email=tenant.owner_email)
        assert owner.is_owner and owner.role.slug == "admin"


def test_industry_preset_applies_service_labels(make_tenant):
    tenant, _ = make_tenant(package_code="P2", industry="services")
    from apps.foundation.models import OrgSettings

    with use_tenant(tenant):
        labels = OrgSettings.objects.get(pk=1).labels
    assert labels["catalog_item"] == "Service"
    assert labels["party_customer"] == "Client"


def test_reprovisioning_is_idempotent(make_tenant):
    tenant, _ = make_tenant(package_code="P1")
    provision_tenant(tenant)  # run again, e.g. SuperAdmin retry

    from apps.foundation.models import Role, TenantUser

    with use_tenant(tenant):
        assert TenantUser.objects.filter(email=tenant.owner_email).count() == 1
        assert Role.objects.filter(slug="admin").count() == 1
    assert tenant.jobs.filter(status="done").count() >= 2


def test_public_packages_lists_published(api, db):
    response = api.get("/api/public/packages")
    assert response.status_code == 200
    codes = [p["code"] for p in response.data]
    assert "P1" in codes and "P8" in codes
    p5 = next(p for p in response.data if p["code"] == "P5")
    assert sorted(p5["modules"]) == ["INV", "PROD"]  # Production Management pairing
