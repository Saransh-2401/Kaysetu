import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def test_catalog_supports_products_and_services(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(industry="services")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    product = client.post("/api/t/catalog/", {"name": "Steel Rod 12mm", "kind": "product", "price": "450"})
    service = client.post(
        "/api/t/catalog/",
        {"name": "Term Life Policy", "kind": "service", "price": "12000", "hsn_sac": "997132", "unit": "policy"},
    )
    assert product.status_code == 201 and service.status_code == 201

    services_only = client.get("/api/t/catalog/", {"kind": "service"})
    assert services_only.data["count"] == 1
    assert services_only.data["results"][0]["name"] == "Term Life Policy"


def test_team_management_and_role_guard(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    owner_token = tenant_token(tenant)["access"]
    client = auth(api, owner_token)

    created = client.post(
        "/api/t/users/",
        {
            "email": "agent@acme.test",
            "full_name": "Agent Kumar",
            "role_slug": "sales_agent",
            "password": "agent-pass-123",
        },
    )
    assert created.status_code == 201, created.data

    # The new agent can log in to the same org
    login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": "agent@acme.test", "password": "agent-pass-123"},
    )
    assert login.status_code == 200
    assert login.data["user"]["role"] == "sales_agent"

    # A non-admin cannot create users (owner/admin-only writes)
    agent_client = auth(api, login.data["access"])
    denied = agent_client.post(
        "/api/t/users/",
        {"email": "x@acme.test", "full_name": "X", "password": "whatever-123"},
    )
    assert denied.status_code == 403

    # ...but can read the team
    assert agent_client.get("/api/t/users/").status_code == 200


def test_system_roles_cannot_be_deleted(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    client = auth(api, tenant_token(tenant)["access"])
    roles = client.get("/api/t/roles/").data["results"]
    admin_role = next(r for r in roles if r["slug"] == "admin")
    assert client.delete(f"/api/t/roles/{admin_role['id']}/").status_code == 400

    created = client.post("/api/t/roles/", {"name": "Auditor", "slug": "auditor"})
    assert created.status_code == 201
    assert client.delete(f"/api/t/roles/{created.data['id']}/").status_code == 204


def test_user_created_without_a_password_can_never_sign_in(api, make_tenant, tenant_token):
    """A user created with no password gets set_unusable_password().

    There is no invite mail, no reset route and change_password is self-only, so
    such an account is permanently unreachable. The portal's Add-User form
    therefore requires the admin to set one (and mails it to the user).
    """
    tenant, _ = make_tenant(package_code="P2")
    client = auth(api, tenant_token(tenant)["access"])

    created = client.post(
        "/api/t/users/",
        {"email": "nopass@acme.test", "full_name": "No Pass", "role_slug": "sales_agent"},
    )
    assert created.status_code == 201, created.data
    # The hash is never echoed back.
    assert "password" not in created.data

    login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": "nopass@acme.test", "password": "anything-at-all"},
    )
    assert login.status_code == 401


def test_deactivation_must_use_is_active_not_status(api, make_tenant, tenant_token):
    """`status` is a read-only computed field derived from is_active.

    The portal used to "archive" a user by PATCHing {status: "Archived"}. DRF
    discarded it and answered 200, so the user stayed active and kept consuming
    a paid seat. Deactivation has to go through is_active.
    """
    tenant, _ = make_tenant(package_code="P2")
    client = auth(api, tenant_token(tenant)["access"])

    created = client.post(
        "/api/t/users/",
        {"email": "archive-me@acme.test", "full_name": "Archive Me",
         "role_slug": "sales_agent", "password": "agent-pass-123"},
    )
    assert created.status_code == 201, created.data
    user_id = created.data["id"]

    # Sending `status` looks successful but must NOT deactivate anyone.
    ignored = client.patch(f"/api/t/users/{user_id}/", {"status": "Archived"})
    assert ignored.status_code == 200
    assert ignored.data["is_active"] is True
    assert ignored.data["status"] == "Active"

    # `is_active` is the field that actually works.
    deactivated = client.patch(f"/api/t/users/{user_id}/", {"is_active": False})
    assert deactivated.status_code == 200
    assert deactivated.data["is_active"] is False
    assert deactivated.data["status"] == "Inactive"

    # A deactivated user cannot sign in.
    login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": "archive-me@acme.test", "password": "agent-pass-123"},
    )
    assert login.status_code == 401
