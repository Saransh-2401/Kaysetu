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


def _stub_geoip(monkeypatch, answers, calls=None):
    """Stand in for ip-api's batch endpoint. `answers` maps IP -> city or None
    (None meaning the provider has no data for a real address)."""
    import requests

    class _Response:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            pass

        def json(self):
            return self._payload

    def _post(url, json=None, timeout=None):
        queried = [item["query"] for item in json]
        if calls is not None:
            calls.append(queried)
        return _Response([
            {"query": ip, "status": "success", "city": answers[ip],
             "regionName": "Rajasthan", "country": "India"}
            if answers.get(ip) else {"query": ip, "status": "fail", "message": "reserved range"}
            for ip in queried
        ])

    monkeypatch.setattr(requests, "post", _post)


def test_login_locations_are_resolved_from_the_ip(api, make_tenant, tenant_token,
                                                  monkeypatch, settings):
    """The log stores an IP at sign-in and resolves it afterwards. Until this
    ran, the Location column showed 'Resolving…' on every row forever."""
    from django.core.management import call_command

    from apps.foundation.models import LoginActivity
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P2")
    owner = tenant_token(tenant)["access"]

    with use_tenant(tenant):
        # three rows from two addresses, plus one from inside the network
        LoginActivity.objects.all().update(ip_address="103.59.75.103")
        LoginActivity.objects.create(user_name="Second", ip_address="103.59.75.103")
        LoginActivity.objects.create(user_name="Elsewhere", ip_address="49.36.10.1")
        LoginActivity.objects.create(user_name="On the LAN", ip_address="127.0.0.1")
        assert LoginActivity.objects.filter(location_resolved=False).count() >= 4

    settings.GEOIP_LOOKUP_ENABLED = True
    calls = []
    _stub_geoip(monkeypatch, {"103.59.75.103": "Jaipur", "49.36.10.1": None}, calls)
    # driven through the scheduler, because the registration is the half that
    # makes this happen in production
    call_command("run_scheduler", once=True, only=["resolve_login_locations"], verbosity=0)

    # one batch, and each address looked up ONCE however many rows carry it
    assert len(calls) == 1 and sorted(calls[0]) == ["103.59.75.103", "49.36.10.1"]

    with use_tenant(tenant):
        rows = {r.user_name: r for r in LoginActivity.objects.all()}
        assert rows["Second"].location == "Jaipur, Rajasthan, India"
        assert rows["On the LAN"].location == "Local / Private network"
        # a real address the provider knows nothing about is still ANSWERED —
        # otherwise it would be re-looked-up on every sweep until the heat death
        elsewhere = rows["Elsewhere"]
        assert elsewhere.location == "" and elsewhere.location_resolved is True
        assert not LoginActivity.objects.filter(location_resolved=False).exists()

    # ...and the admin log now serves it
    row = next(r for r in auth(api, owner).get("/api/admin/login-activity/").data["results"]
               if r["user_name"] == "Second")
    assert row["location"] == "Jaipur, Rajasthan, India" and row["location_resolved"] is True

    # a second sweep has nothing left to do — no repeat calls to the provider
    calls.clear()
    call_command("resolve_login_locations", verbosity=0)
    assert calls == []


def test_geoip_failure_leaves_rows_for_the_next_sweep(api, make_tenant, tenant_token,
                                                     monkeypatch, settings):
    """A provider outage must not mark rows resolved-with-no-location — that
    would burn the answer in permanently for a row that never got looked up."""
    import requests
    from django.core.management import call_command

    from apps.foundation.models import LoginActivity
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P2")
    tenant_token(tenant)
    with use_tenant(tenant):
        LoginActivity.objects.all().update(ip_address="103.59.75.103")

    settings.GEOIP_LOOKUP_ENABLED = True

    def _boom(*args, **kwargs):
        raise requests.RequestException("provider down")

    monkeypatch.setattr(requests, "post", _boom)
    call_command("resolve_login_locations", verbosity=0)      # must not raise

    with use_tenant(tenant):
        assert LoginActivity.objects.filter(location_resolved=False).exists()

    # the next sweep, once the provider is back, settles them
    _stub_geoip(monkeypatch, {"103.59.75.103": "Jaipur"})
    call_command("resolve_login_locations", verbosity=0)
    with use_tenant(tenant):
        assert not LoginActivity.objects.filter(location_resolved=False).exists()
        assert LoginActivity.objects.first().location == "Jaipur, Rajasthan, India"


def test_geoip_lookups_can_be_switched_off(make_tenant, tenant_token, monkeypatch, settings):
    """Deployments that will not send user IPs to a third party keep the column
    empty rather than having it silently resolve anyway."""
    import requests
    from django.core.management import call_command

    from apps.foundation.models import LoginActivity
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P2")
    tenant_token(tenant)
    with use_tenant(tenant):
        LoginActivity.objects.all().update(ip_address="103.59.75.103")

    def _never(*args, **kwargs):
        raise AssertionError("no lookup may be made when GEOIP_LOOKUP_ENABLED is off")

    monkeypatch.setattr(requests, "post", _never)
    settings.GEOIP_LOOKUP_ENABLED = False
    call_command("resolve_login_locations", verbosity=0)


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
