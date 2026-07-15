import pytest
from rest_framework.test import APIClient

from django.core.cache import cache
from django.db import connections
from django.test import SimpleTestCase


class _AllowTenantAliases(frozenset):
    """Django freezes TestCase.databases at class-setup, but tenant DB aliases
    (t_<slug>) are registered mid-test by provisioning — a fixed set can never
    contain them. Membership is what the ensure_connection guard checks, so we
    make membership dynamic for tenant aliases only."""

    def __contains__(self, alias):
        return (isinstance(alias, str) and alias.startswith("t_")) or super().__contains__(alias)


_orig_validate_databases = SimpleTestCase._validate_databases.__func__


@classmethod
def _validate_databases_allowing_tenants(cls):
    return _AllowTenantAliases(_orig_validate_databases(cls))


SimpleTestCase._validate_databases = _validate_databases_allowing_tenants


@pytest.fixture(autouse=True)
def tenant_db_sandbox(tmp_path, settings):
    """Point tenant sqlite files at a per-test temp dir and drop any dynamic
    aliases afterwards so tests never see each other's tenant databases."""
    settings.TENANCY = {**settings.TENANCY, "SQLITE_DIR": tmp_path / "tenants"}
    cache.clear()  # reset throttle counters between tests
    yield
    from apps.tenancy.db import forget_alias

    for alias in [a for a in list(connections.databases.keys()) if a.startswith("t_")]:
        forget_alias(alias)


@pytest.fixture()
def api():
    return APIClient()


@pytest.fixture()
def superadmin(db):
    from apps.control.models import AdminUser

    return AdminUser.objects.create_superuser(
        email="root@salexa.com", password="root-pass-123", full_name="Root"
    )


@pytest.fixture()
def admin_token(api, superadmin):
    response = api.post(
        "/api/auth/admin/login", {"email": "root@salexa.com", "password": "root-pass-123"}
    )
    assert response.status_code == 200, response.data
    return response.data["access"]


@pytest.fixture()
def make_tenant(api, db):
    """Signup through the real public API; returns (tenant, owner_password)."""
    counter = {"n": 0}

    def _make(package_code="P2", company=None, industry="generic", email=None):
        from apps.control.models import Tenant

        counter["n"] += 1
        n = counter["n"]
        payload = {
            "company_name": company or f"Acme {package_code} {n}",
            "owner_name": "Owner One",
            "owner_email": email or f"owner{n}@acme.test",
            "owner_phone": "9999999999",
            "password": "owner-pass-123",
            "package_code": package_code,
            "industry": industry,
        }
        response = api.post("/api/public/signup", payload)
        assert response.status_code == 201, getattr(response, "data", response)
        tenant = Tenant.objects.get(org_code=response.data["org_code"])
        return tenant, "owner-pass-123"

    return _make


@pytest.fixture()
def tenant_token(api, make_tenant):
    def _login(tenant, password="owner-pass-123", email=None):
        response = api.post(
            "/api/auth/tenant/login",
            {
                "org_code": tenant.org_code,
                "email": email or tenant.owner_email,
                "password": password,
            },
        )
        assert response.status_code == 200, response.data
        return response.data

    return _login


def auth(client, token):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client
