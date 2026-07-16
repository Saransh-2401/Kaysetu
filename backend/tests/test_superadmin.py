import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def test_superadmin_endpoints_require_control_scope(api, make_tenant, tenant_token, admin_token):
    tenant, _ = make_tenant()
    user_token = tenant_token(tenant)["access"]

    assert auth(api, user_token).get("/api/sa/tenants/").status_code == 403
    api.credentials()  # drop auth entirely
    assert api.get("/api/sa/tenants/").status_code == 401
    assert auth(api, admin_token).get("/api/sa/tenants/").status_code == 200


def test_tenant_list_and_detail(api, make_tenant, admin_token):
    tenant, _ = make_tenant(company="Kishmi Foods", package_code="P3")
    listing = auth(api, admin_token).get("/api/sa/tenants/", {"search": "Kishmi"})
    assert listing.data["count"] == 1

    detail = auth(api, admin_token).get(f"/api/sa/tenants/{tenant.pk}/")
    assert detail.status_code == 200
    assert detail.data["entitled_modules"] == ["CRM", "FIELD", "TRACK"]
    assert detail.data["subscriptions"][0]["package_code"] == "P3"
    assert detail.data["jobs"][0]["status"] == "done"


def test_suspend_blocks_login_and_live_tokens(api, make_tenant, tenant_token, admin_token):
    tenant, _ = make_tenant()
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/me").status_code == 200

    suspend = auth(api, admin_token).post(f"/api/sa/tenants/{tenant.pk}/suspend/")
    assert suspend.status_code == 200 and suspend.data["status"] == "suspended"

    # Fresh login blocked with a clear message
    login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": tenant.owner_email, "password": "owner-pass-123"},
    )
    assert login.status_code == 403
    assert login.data["code"] == "tenant_suspended"

    # Already-issued token dies on the next request
    assert auth(api, token).get("/api/me").status_code == 401

    # Reactivation restores access
    auth(api, admin_token).post(f"/api/sa/tenants/{tenant.pk}/activate/")
    assert auth(api, token).get("/api/me").status_code == 200


def test_audit_log_written_for_admin_actions(api, make_tenant, admin_token):
    from apps.control.models import ControlAuditLog

    tenant, _ = make_tenant()
    auth(api, admin_token).post(f"/api/sa/tenants/{tenant.pk}/suspend/")
    entry = ControlAuditLog.objects.filter(action="tenant.suspended").first()
    assert entry is not None
    assert entry.after == {"status": "suspended"}
    assert entry.actor.email == "root@salexa.com"


def test_command_center_stats(api, make_tenant, admin_token):
    tenant_a, _ = make_tenant(package_code="P1")
    tenant_b, _ = make_tenant(package_code="P2")
    auth(api, admin_token).post(f"/api/sa/tenants/{tenant_b.pk}/suspend/")

    stats = auth(api, admin_token).get("/api/sa/stats")
    assert stats.status_code == 200
    assert stats.data["tenants"]["total"] == 2
    assert stats.data["tenants"]["by_status"]["trial"] == 1
    assert stats.data["tenants"]["by_status"]["suspended"] == 1
    assert stats.data["signups_this_week"] == 2
    assert stats.data["provisioning"]["failed"] == 0
    codes = {p["package__code"] for p in stats.data["package_distribution"]}
    assert codes == {"P1", "P2"}


def test_package_composer_edit(api, admin_token):
    from apps.control.models import Package

    package = Package.objects.get(code="P1")
    response = auth(api, admin_token).patch(
        f"/api/sa/packages/{package.pk}/", {"base_price_monthly": "1299.00"}
    )
    assert response.status_code == 200
    package.refresh_from_db()
    assert str(package.base_price_monthly) == "1299.00"

    # Public pricing reflects it immediately
    api.credentials()
    public = api.get("/api/public/packages")
    p1 = next(p for p in public.data if p["code"] == "P1")
    assert p1["base_price_monthly"] == "1299.00"
