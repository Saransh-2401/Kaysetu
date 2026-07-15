"""Module gating: you get exactly what you bought — and integration when added."""
import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def test_p1_gets_tracking_not_field(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    token = tenant_token(tenant)["access"]

    assert auth(api, token).get("/api/t/track/ping").status_code == 200
    assert auth(api, token).get("/api/t/field/ping").status_code == 403
    assert auth(api, token).get("/api/t/books/ping").status_code == 403


def test_p2_gets_field_not_tracking(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]

    assert auth(api, token).get("/api/t/field/ping").status_code == 200
    assert auth(api, token).get("/api/t/track/ping").status_code == 403


def test_foundation_is_always_available(api, make_tenant, tenant_token):
    """Catalog/parties are Foundation — every package can use them."""
    tenant, _ = make_tenant(package_code="P1")
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/catalog/").status_code == 200
    assert auth(api, token).get("/api/t/parties/").status_code == 200


def test_superadmin_module_override_unlocks_immediately(api, make_tenant, tenant_token, admin_token):
    """SA-4 entitlements tab: add BOOKS to a P2 tenant -> works on next request."""
    tenant, _ = make_tenant(package_code="P2")
    user_token = tenant_token(tenant)["access"]
    assert auth(api, user_token).get("/api/t/books/ping").status_code == 403

    response = auth(api, admin_token).post(
        f"/api/sa/tenants/{tenant.pk}/set-modules/", {"modules": ["FIELD", "BOOKS"]}
    )
    assert response.status_code == 200
    assert response.data["modules"] == ["BOOKS", "FIELD"]

    assert auth(api, user_token).get("/api/t/books/ping").status_code == 200

    # Role templates for the new module were created in the tenant DB.
    from apps.foundation.models import Role
    from apps.tenancy.context import use_tenant

    with use_tenant(tenant):
        assert Role.objects.filter(slug="accounts_officer").exists()


def test_module_can_be_removed(api, make_tenant, tenant_token, admin_token):
    tenant, _ = make_tenant(package_code="P3")  # TRACK+FIELD+CRM
    user_token = tenant_token(tenant)["access"]
    assert auth(api, user_token).get("/api/t/track/ping").status_code == 200

    auth(api, admin_token).post(
        f"/api/sa/tenants/{tenant.pk}/set-modules/", {"modules": ["FIELD", "CRM"]}
    )
    assert auth(api, user_token).get("/api/t/track/ping").status_code == 403

    assert (
        auth(api, admin_token)
        .post(f"/api/sa/tenants/{tenant.pk}/set-modules/", {"modules": ["NOPE"]})
        .status_code
        == 400
    )
