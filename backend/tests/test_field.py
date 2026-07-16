"""MOD-FIELD: standalone field sales + BIDIRECTIONAL integration with TRACK.

The headline: FIELD and TRACK exchange data through the capability registry
and event bus WITHOUT importing each other — TRACK's route rollup pulls FIELD's
visit_count, FIELD's target performance pulls TRACK's month_hours, and FIELD's
visit check-in is GPS-verified against TRACK's live location.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.foundation.integration import events
from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _party(api, token, name="Sharma Kirana", city="Jaipur"):
    resp = auth(api, token).post(
        "/api/t/parties/", {"name": name, "kind": "customer", "address": {"city": city}}
    )
    assert resp.status_code == 201, resp.data
    return resp.data["id"]


def _agent(api, tenant, tenant_token, email="agent@field.test"):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post(
        "/api/t/users/",
        {"email": email, "full_name": "Field Agent", "role_slug": "sales_agent",
         "password": "agent-pass-123", "password_confirm": "agent-pass-123"},
    )
    login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": email, "password": "agent-pass-123"},
    )
    return login.data["access"], login.data["user"]["id"]


# ------------------------------------------------------------- standalone
def test_field_standalone_visit_flow(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # Sales Management = FIELD alone
    token, agent_id = _agent(api, tenant, tenant_token)
    owner = tenant_token(tenant)["access"]
    party_id = _party(api, owner)
    client = auth(api, token)

    created = client.post("/api/t/field/visits/", {
        "party": party_id, "visit_date": str(timezone.localdate()),
        "scheduled_time": "10:00", "purpose": "Order collection",
    })
    assert created.status_code == 201, created.data
    vid = created.data["id"]
    assert created.data["status"] == "scheduled"

    # check-in (no TRACK entitled -> gps_verified False, but visit works)
    checkin = client.post(f"/api/t/field/visits/{vid}/checkin/",
                          {"location": {"latitude": 26.9124, "longitude": 75.7873}})
    assert checkin.status_code == 200 and checkin.data["status"] == "in_progress"
    assert checkin.data["gps_verified"] is False

    checkout = client.post(f"/api/t/field/visits/{vid}/checkout/",
                           {"outcome": "Order booked", "notes": "Paid partial"})
    assert checkout.status_code == 200 and checkout.data["status"] == "completed"


def test_field_order_booking_emits_event(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token, agent_id = _agent(api, tenant, tenant_token)
    owner = tenant_token(tenant)["access"]
    party_id = _party(api, owner)
    item = auth(api, owner).post("/api/t/catalog/", {"name": "Amul Butter", "price": "275", "tax_rate": "12"}).data

    fired = []
    events.subscribe("field.order_booked", lambda **p: fired.append(p))

    order = auth(api, token).post("/api/t/field/orders/", {
        "party": party_id, "order_date": str(timezone.localdate()),
        "items": [{"item": item["id"], "item_name": "Amul Butter", "quantity": 4, "rate": "275", "tax_rate": "12"}],
    })
    assert order.status_code == 201
    assert str(order.data["subtotal"]) == "1100.00"  # 4 x 275
    assert str(order.data["total"]) == "1232.00"      # + 12% tax
    assert fired and fired[-1]["order_number"] == order.data["order_number"]  # event for ORDERS module


def test_field_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")  # TRACK only, NO FIELD
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/field/visits/").status_code == 403
    assert auth(api, token).get("/api/t/field/targets/").status_code == 403


# ------------------------------------------------------------- integration
def test_track_rollup_pulls_field_visit_count(api, make_tenant, tenant_token):
    """TRACK's nightly route rollup reads FIELD's visit_count via the registry —
    real count when FIELD present (P3), zero when FIELD absent (P1)."""
    from apps.tracking import services as track_services
    from apps.tracking.models import DutyDay, RouteHistory

    # P3 = TRACK + FIELD + CRM
    tenant, _ = make_tenant(package_code="P3")
    token, agent_id = _agent(api, tenant, tenant_token)
    owner = tenant_token(tenant)["access"]
    party_id = _party(api, owner)
    client = auth(api, token)

    # agent punches in, tracks a point, and completes a visit today
    client.post("/api/t/track/punch-in", {"lat": 26.9124, "lng": 75.7873})
    client.post("/api/t/track/track-location", {"points": [
        {"lat": 26.9124, "lng": 75.7873, "recorded_at": timezone.now().isoformat(), "accuracy": 5},
    ]})
    v = client.post("/api/t/field/visits/", {
        "party": party_id, "visit_date": str(timezone.localdate()), "scheduled_time": "10:00",
    }).data
    client.post(f"/api/t/field/visits/{v['id']}/checkin/", {"location": {"latitude": 26.9124, "longitude": 75.7873}})
    client.post(f"/api/t/field/visits/{v['id']}/checkout/", {"outcome": "done"})

    with use_tenant(tenant):
        # move duty day + visit to yesterday and roll up
        report = DutyDay.objects.get(agent_id=agent_id, date=timezone.localdate())
        yday = timezone.localdate() - timedelta(days=1)
        report.date = yday
        report.save()
        from apps.field.models import Visit
        Visit.objects.filter(agent_id=agent_id).update(visit_date=yday)

        built = track_services.build_route_histories(yday)
        assert built >= 1
        rh = RouteHistory.objects.get(agent_id=agent_id, date=yday)
        assert rh.visit_count == 1  # ← FIELD's visit_count, pulled with NO import


def test_field_performance_pulls_track_hours(api, make_tenant, tenant_token):
    """FIELD target performance reads login-hours from TRACK via capability —
    real hours when TRACK present, 0 when absent."""
    from apps.field.services import target_performance
    from apps.tracking.models import DutyDay

    tenant, _ = make_tenant(package_code="P3")  # TRACK + FIELD
    token, agent_id = _agent(api, tenant, tenant_token)
    now = timezone.localdate()

    with use_tenant(tenant):
        DutyDay.objects.create(
            agent_id=agent_id, date=now,
            punch_in_time=timezone.now() - timedelta(hours=8),
            punch_out_time=timezone.now(), working_hours=8,
        )
        perf = target_performance(agent_id, now.month, now.year)
        assert perf["actuals"]["login_hours"] == 8.0  # ← from TRACK, no import

    # A FIELD-only tenant (no TRACK) degrades to 0 login-hours.
    field_only, _ = make_tenant(package_code="P2")
    ftoken, fid = _agent(api, field_only, tenant_token, email="a2@field.test")
    with use_tenant(field_only):
        perf2 = target_performance(fid, now.month, now.year)
        assert perf2["actuals"]["login_hours"] == 0.0


def test_visit_checkin_gps_verified_via_track(api, make_tenant, tenant_token):
    """A visit check-in is GPS-verified against TRACK's live location."""
    tenant, _ = make_tenant(package_code="P3")  # TRACK + FIELD
    token, agent_id = _agent(api, tenant, tenant_token)
    owner = tenant_token(tenant)["access"]
    party_id = _party(api, owner)
    client = auth(api, token)

    client.post("/api/t/track/punch-in", {"lat": 26.9124, "lng": 75.7873})
    client.post("/api/t/track/track-location", {"points": [
        {"lat": 26.9124, "lng": 75.7873, "recorded_at": timezone.now().isoformat(), "accuracy": 5},
    ]})
    v = client.post("/api/t/field/visits/", {
        "party": party_id, "visit_date": str(timezone.localdate()), "scheduled_time": "10:00",
    }).data
    # check-in AT the tracked location -> verified
    near = client.post(f"/api/t/field/visits/{v['id']}/checkin/",
                       {"location": {"latitude": 26.9125, "longitude": 75.7874}})
    assert near.data["gps_verified"] is True  # ← TRACK confirmed the agent is there
