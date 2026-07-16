"""Org settings API — powers the setup wizard, terminology and Appearance."""
import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def test_org_settings_read_and_update(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2", industry="services")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    current = client.get("/api/t/org")
    assert current.status_code == 200
    assert current.data["company_name"] == tenant.name
    assert current.data["labels"]["catalog_item"] == "Service"

    updated = client.patch(
        "/api/t/org",
        {
            "legal_name": "Acme Insurance Pvt Ltd",
            "gstin": "22AAAAA0000A1Z5",
            "labels": {**current.data["labels"], "catalog_item": "Policy", "catalog": "Policies"},
            "appearance": {"scheme": "emerald-fresh"},
            "setup_state": {"done": ["company", "industry", "appearance"], "completed": False},
        },
    )
    assert updated.status_code == 200, updated.data
    assert updated.data["labels"]["catalog_item"] == "Policy"
    assert updated.data["appearance"] == {"scheme": "emerald-fresh"}

    # Login payload carries the new appearance + labels + setup state
    relogin = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": tenant.owner_email, "password": "owner-pass-123"},
    )
    assert relogin.data["org"]["appearance"] == {"scheme": "emerald-fresh"}
    assert relogin.data["org"]["labels"]["catalog_item"] == "Policy"
    assert relogin.data["org"]["setup_state"]["done"] == ["company", "industry", "appearance"]


def test_org_settings_writes_are_admin_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    owner_token = tenant_token(tenant)["access"]

    auth(api, owner_token).post(
        "/api/t/users/",
        {"email": "agent2@acme.test", "full_name": "Agent Two",
         "role_slug": "sales_agent", "password": "agent-pass-123"},
    )
    agent_login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": "agent2@acme.test", "password": "agent-pass-123"},
    )
    agent_client = auth(api, agent_login.data["access"])

    assert agent_client.get("/api/t/org").status_code == 200  # read ok
    assert agent_client.patch("/api/t/org", {"company_name": "Hacked"}).status_code == 403


def test_org_settings_isolated_between_tenants(api, make_tenant, tenant_token):
    tenant_a, _ = make_tenant(company="Org A")
    tenant_b, _ = make_tenant(company="Org B")

    auth(api, tenant_token(tenant_a)["access"]).patch(
        "/api/t/org", {"appearance": {"scheme": "royal-indigo"}}
    )
    b_settings = auth(api, tenant_token(tenant_b)["access"]).get("/api/t/org")
    assert b_settings.data["appearance"] == {}
