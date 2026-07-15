"""The tests that prove the #1 SaaS promise: tenants cannot see each other."""
import pytest

from apps.tenancy.context import TenantContextError, use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def test_data_is_isolated_between_tenants(api, make_tenant, tenant_token):
    tenant_a, _ = make_tenant(company="Alpha Traders")
    tenant_b, _ = make_tenant(company="Beta Insurance")

    token_a = tenant_token(tenant_a)["access"]
    token_b = tenant_token(tenant_b)["access"]

    created = auth(api, token_a).post(
        "/api/t/catalog/", {"name": "Amul Butter 500g", "price": "275.00", "tax_rate": "12"}
    )
    assert created.status_code == 201

    list_a = auth(api, token_a).get("/api/t/catalog/")
    assert list_a.data["count"] == 1

    list_b = auth(api, token_b).get("/api/t/catalog/")
    assert list_b.data["count"] == 0

    # Users are isolated too: owner A does not exist inside tenant B.
    from apps.foundation.models import TenantUser

    with use_tenant(tenant_b):
        assert not TenantUser.objects.filter(email=tenant_a.owner_email).exists()


def test_same_email_can_exist_in_two_tenants(api, make_tenant, tenant_token):
    """DB-per-tenant means no global unique constraints across businesses."""
    tenant_a, _ = make_tenant(email="shared@company.test")
    tenant_b, _ = make_tenant(email="shared@company.test")
    assert tenant_token(tenant_a, email="shared@company.test")["org"]["org_code"] == tenant_a.org_code
    assert tenant_token(tenant_b, email="shared@company.test")["org"]["org_code"] == tenant_b.org_code


def test_tenant_models_require_context(make_tenant):
    """The router hard-fails when tenant data is touched with no tenant set."""
    make_tenant()
    from apps.foundation.models import CatalogItem

    with pytest.raises(TenantContextError):
        CatalogItem.objects.count()


def test_tenant_token_of_a_cannot_reach_b(api, make_tenant, tenant_token):
    """A token always carries its own tenant; there is no header/param that
    can point it at another tenant's data."""
    tenant_a, _ = make_tenant()
    tenant_b, _ = make_tenant()
    token_a = tenant_token(tenant_a)["access"]

    auth(api, token_a).post("/api/t/parties/", {"name": "Sharma Kirana", "kind": "customer"})

    # Even sending B's org code header alongside A's token must not switch DBs:
    response = api.get("/api/t/parties/", HTTP_X_ORG_CODE=tenant_b.org_code)
    assert response.data["count"] == 1  # still A's data (token wins)
