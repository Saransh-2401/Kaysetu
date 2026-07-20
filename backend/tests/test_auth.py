import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def test_tenant_login_returns_context(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2", industry="services")
    data = tenant_token(tenant)

    assert data["user"]["is_owner"] is True
    assert data["user"]["role"] == "admin"
    assert data["org"]["org_code"] == tenant.org_code
    assert data["org"]["modules"] == ["FIELD"]
    assert data["org"]["labels"]["catalog_item"] == "Service"

    me = auth(api, data["access"]).get("/api/me")
    assert me.status_code == 200
    assert me.data["scope"] == "tenant"
    assert me.data["org"]["org_code"] == tenant.org_code


def test_login_rejects_bad_credentials(api, make_tenant):
    tenant, _ = make_tenant()
    bad_pw = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": tenant.owner_email, "password": "wrong-pass"},
    )
    assert bad_pw.status_code == 401

    bad_org = api.post(
        "/api/auth/tenant/login",
        {"org_code": "KST-NOPE99", "email": tenant.owner_email, "password": "owner-pass-123"},
    )
    assert bad_org.status_code == 401


def test_refresh_rotates_tokens(api, make_tenant, tenant_token):
    tenant, _ = make_tenant()
    data = tenant_token(tenant)
    response = api.post("/api/auth/refresh", {"refresh": data["refresh"]})
    assert response.status_code == 200
    assert auth(api, response.data["access"]).get("/api/me").status_code == 200


def test_access_token_cannot_be_used_as_refresh(api, make_tenant, tenant_token):
    tenant, _ = make_tenant()
    data = tenant_token(tenant)
    response = api.post("/api/auth/refresh", {"refresh": data["access"]})
    assert response.status_code == 401


def test_admin_login_and_me(api, admin_token):
    me = auth(api, admin_token).get("/api/me")
    assert me.status_code == 200
    assert me.data["scope"] == "control"
    assert me.data["user"]["admin_role"] == "super"


def test_anonymous_is_rejected(api, db):
    assert api.get("/api/me").status_code == 401
    assert api.get("/api/t/catalog/").status_code == 401
