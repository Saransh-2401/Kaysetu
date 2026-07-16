"""Portal-compat endpoints: legacy profile + entitlement-folded permission matrix.

These are what let the Old Project portal log in and package-gate its sidebars
against the new backend.
"""
import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def test_legacy_profile_shape(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    profile = auth(api, token).get("/api/auth/users/me/")
    assert profile.status_code == 200
    data = profile.data
    # Fields the portal reads off the current user
    for field in ["id", "email", "username", "full_name", "role", "is_active", "operating_city"]:
        assert field in data
    assert data["role"] == "admin"
    assert data["username"] == data["email"]  # synthesised


def test_entitlement_matrix_hides_unbought_packages(api, make_tenant, tenant_token):
    # P2 = Sales Management = FIELD only
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    matrix = auth(api, token).get("/api/core/role-permissions/me/")
    assert matrix.status_code == 200
    perms = matrix.data["permissions"]

    # is_full MUST be false, else the portal short-circuits and package gating fails.
    assert matrix.data["is_full"] is False

    # FIELD keys enabled
    assert perms["sales_team"]["enabled"] is True
    assert perms["visits"]["enabled"] is True
    # Un-bought package keys disabled
    assert perms["production_dashboard"]["enabled"] is False  # PROD
    assert perms["general_ledger"]["enabled"] is False        # BOOKS
    assert perms["purchase_orders"]["enabled"] is False       # PURCH
    assert perms["warehouse_dashboard"]["enabled"] is False   # INV
    # Platform-core always enabled
    assert perms["company_settings"]["enabled"] is True
    assert perms["users"]["enabled"] is True
    assert perms["customers"]["enabled"] is True  # shared master data
    assert perms["suppliers"]["enabled"] is True   # Foundation-core party (review fix)
    # FIELD-only tenant has neither TRACK nor ATT -> attendance hidden
    assert perms["attendance"]["enabled"] is False
    # distributor adjustments follow DIST (not INV) -> hidden here
    assert perms["distributor_adjustments"]["enabled"] is False


def test_attendance_visible_with_either_track_or_att(api, make_tenant, tenant_token, admin_token):
    # P1 = Agent Live Tracking = TRACK only. Field-staff attendance must show.
    tenant, _ = make_tenant(package_code="P1")
    token = tenant_token(tenant)["access"]
    perms = auth(api, token).get("/api/core/role-permissions/me/").data["permissions"]
    assert perms["attendance"]["enabled"] is True   # via TRACK
    assert perms["tracking_health"]["enabled"] is True

    # A FIELD-only tenant gains attendance once the ATT add-on is enabled.
    field_tenant, _ = make_tenant(package_code="P2")
    ftoken = tenant_token(field_tenant)["access"]
    assert auth(api, ftoken).get("/api/core/role-permissions/me/").data["permissions"]["attendance"]["enabled"] is False
    auth(api, admin_token).post(
        f"/api/sa/tenants/{field_tenant.pk}/set-modules/", {"modules": ["FIELD", "ATT"]}
    )
    assert auth(api, ftoken).get("/api/core/role-permissions/me/").data["permissions"]["attendance"]["enabled"] is True


def test_change_password_self_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    login = tenant_token(tenant)
    token = login["access"]
    uid = login["user"]["id"]
    client = auth(api, token)

    # Wrong current password -> 400
    assert client.patch(
        f"/api/auth/users/{uid}/change_password/",
        {"old_password": "wrong", "new_password": "NewPass123", "new_password_confirm": "NewPass123"},
    ).status_code == 400

    # Mismatch confirm -> 400
    assert client.patch(
        f"/api/auth/users/{uid}/change_password/",
        {"old_password": "owner-pass-123", "new_password": "NewPass123", "new_password_confirm": "Other123"},
    ).status_code == 400

    # Success -> 204, and the new password works for login
    assert client.patch(
        f"/api/auth/users/{uid}/change_password/",
        {"old_password": "owner-pass-123", "new_password": "BrandNew123", "new_password_confirm": "BrandNew123"},
    ).status_code == 204
    relogin = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": tenant.owner_email, "password": "BrandNew123"},
    )
    assert relogin.status_code == 200

    # Cannot change another user's password
    assert client.patch(
        f"/api/auth/users/{uid + 999}/change_password/",
        {"old_password": "x", "new_password": "Whatever123", "new_password_confirm": "Whatever123"},
    ).status_code == 403


def test_entitlement_matrix_enterprise_enables_all(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")  # Enterprise = everything
    token = tenant_token(tenant)["access"]
    perms = auth(api, token).get("/api/core/role-permissions/me/").data["permissions"]
    assert perms["production_dashboard"]["enabled"] is True
    assert perms["general_ledger"]["enabled"] is True
    assert perms["tracking_health"]["enabled"] is True
    assert perms["travel_allowance"]["enabled"] is True


def test_entitlement_matrix_reflects_superadmin_override(api, make_tenant, tenant_token, admin_token):
    tenant, _ = make_tenant(package_code="P2")  # FIELD only
    token = tenant_token(tenant)["access"]
    before = auth(api, token).get("/api/core/role-permissions/me/").data["permissions"]
    assert before["general_ledger"]["enabled"] is False

    auth(api, admin_token).post(
        f"/api/sa/tenants/{tenant.pk}/set-modules/", {"modules": ["FIELD", "BOOKS"]}
    )
    after = auth(api, token).get("/api/core/role-permissions/me/").data["permissions"]
    assert after["general_ledger"]["enabled"] is True  # BOOKS now entitled


def test_compat_endpoints_require_tenant_token(api, make_tenant, admin_token):
    make_tenant(package_code="P2")
    # SuperAdmin (control scope) must not resolve tenant compat endpoints
    assert auth(api, admin_token).get("/api/auth/users/me/").status_code == 403
    assert auth(api, admin_token).get("/api/core/role-permissions/me/").status_code == 403
    api.credentials()
    assert api.get("/api/core/role-permissions/me/").status_code == 401
