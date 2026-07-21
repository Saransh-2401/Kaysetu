"""Login Activity + Route History logs — the two admin-log tabs with real data.

Login activity records every tenant login attempt (success AND failure) into the
tenant's own audit; route history is the nightly GPS rollup surfaced in the
{results,count} shape the log table reads.
"""
import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _staff(api, tenant, tenant_token, role_slug, email):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": "Staff", "role_slug": role_slug,
        "password": "staff-pass-123", "password_confirm": "staff-pass-123"})
    return api.post("/api/auth/tenant/login",
                    {"org_code": tenant.org_code, "email": email,
                     "password": "staff-pass-123"}).data["access"]


def test_logins_and_failures_are_recorded_and_visible_to_admin(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    owner = tenant_token(tenant)["access"]      # a successful owner login happened here

    # a failed attempt with the wrong password
    bad = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": tenant.owner_email, "password": "WRONG"})
    assert bad.status_code == 401

    log = auth(api, owner).get("/api/admin/login-activity/")
    assert log.status_code == 200
    rows = log.data["results"]
    assert log.data["count"] >= 2

    ok = next(r for r in rows if r["success"])
    assert ok["event"] == "login" and ok["method"] == "password"
    fail = next(r for r in rows if not r["success"])
    assert fail["event"] == "failed_login" and fail["detail"] == "invalid_credentials"
    # a failed attempt keeps no user but records what was tried
    assert fail["user"] is None and fail["username_attempted"] == tenant.owner_email


def test_login_activity_filters(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    owner = tenant_token(tenant)["access"]
    api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": tenant.owner_email, "password": "nope"})

    client = auth(api, owner)
    only_fail = client.get("/api/admin/login-activity/?success=false").data["results"]
    assert only_fail and all(r["success"] is False for r in only_fail)
    only_ok = client.get("/api/admin/login-activity/?event=login").data["results"]
    assert only_ok and all(r["event"] == "login" for r in only_ok)


def test_login_activity_is_admin_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    agent = _staff(api, tenant, tenant_token, "sales_agent", "agent@la.test")
    # the audit exposes every user's IPs — a plain agent cannot read it
    assert auth(api, agent).get("/api/admin/login-activity/").status_code == 403


def test_route_history_log_serves_paginated_and_is_track_gated(api, make_tenant, tenant_token):
    # TRACK tenant: the log is served (empty until a nightly rollup runs)
    tracking, _ = make_tenant(package_code="P1")
    ttoken = tenant_token(tracking)["access"]
    served = auth(api, ttoken).get("/api/admin/route-history/")
    assert served.status_code == 200 and "results" in served.data and "count" in served.data

    # a seeded rollup shows up in the log shape the table reads
    from apps.tenancy.context import use_tenant
    with use_tenant(tracking):
        from apps.foundation.models import TenantUser
        from apps.tracking.models import RouteHistory
        agent = TenantUser.objects.filter(is_owner=True).first()
        RouteHistory.objects.create(
            agent=agent, date="2026-07-20", distance_km="12.5", visit_count=3,
            routes=[{"lat": 1, "lng": 2}, {"lat": 3, "lng": 4}], status="completed")
    row = auth(api, ttoken).get("/api/admin/route-history/").data["results"][0]
    assert str(row["distance_km"]) == "12.50" and row["visit_count"] == 3
    assert row["route_points"] == 2 and row["agent_name"]

    # a NON-TRACK tenant gets 403 (the log page then shows a calm empty state)
    other, _ = make_tenant(package_code="P6")   # PURCH only
    assert auth(api, tenant_token(other)["access"]).get(
        "/api/admin/route-history/").status_code == 403
