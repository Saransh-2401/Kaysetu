"""MOD-TRACK: standalone agent live tracking + dependency-free integration.

Proves TRACK works ALONE (a P1 tenant), is package-gated, keeps GPS logic
faithful, and is consumable by other modules ONLY through the capability
registry (never by import).
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.foundation.integration import capabilities
from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _agent(api, tenant, tenant_token, email="agent@track.test"):
    """Create a field_agent in the tenant and return their access token."""
    owner = tenant_token(tenant)["access"]
    created = auth(api, owner).post(
        "/api/t/users/",
        {"email": email, "full_name": "Track Agent", "role_slug": "field_agent",
         "password": "agent-pass-123", "password_confirm": "agent-pass-123"},
    )
    assert created.status_code == 201, created.data
    login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": email, "password": "agent-pass-123"},
    )
    return login.data["access"], login.data["user"]["id"]


def test_track_standalone_punch_and_gps_flow(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")  # Agent Live Tracking ALONE
    token, agent_id = _agent(api, tenant, tenant_token)
    client = auth(api, token)

    # not punched in yet
    assert client.get("/api/t/track/status").data["isPunchedIn"] is False

    punch = client.post("/api/t/track/punch-in", {"lat": 26.9124, "lng": 75.7873, "address": "Jaipur"})
    assert punch.status_code == 200 and punch.data["success"] is True
    assert client.get("/api/t/track/status").data["isPunchedIn"] is True

    # batch of GPS points (one flagged as mocked)
    now = timezone.now()
    points = [
        {"lat": 26.9124, "lng": 75.7873, "recorded_at": (now - timedelta(minutes=10)).isoformat(), "accuracy": 8},
        {"lat": 26.9200, "lng": 75.8000, "recorded_at": (now - timedelta(minutes=5)).isoformat(), "accuracy": 6},
        {"lat": 27.5000, "lng": 76.5000, "recorded_at": (now - timedelta(minutes=4)).isoformat(), "is_mocked": True},
    ]
    track = client.post("/api/t/track/track-location", {"points": points})
    assert track.status_code == 200
    assert track.data["accepted_points"] == 3
    assert track.data["session_closed"] is False  # still on duty

    route = client.get(f"/api/t/track/day-route?agent_id={agent_id}&date={timezone.localdate()}")
    assert route.status_code == 200
    assert route.data["mock_detected"] is True  # mocked point flagged
    assert route.data["total_points"] >= 1

    out = client.post("/api/t/track/punch-out", {"lat": 26.92, "lng": 75.80})
    assert out.status_code == 200
    assert float(out.data["working_hours"]) >= 0
    assert client.get("/api/t/track/status").data["isPunchedIn"] is False


def test_track_accuracy_gate_drops_imprecise_points(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    token, agent_id = _agent(api, tenant, tenant_token)
    client = auth(api, token)
    client.post("/api/t/track/punch-in", {"lat": 26.9, "lng": 75.8})
    resp = client.post("/api/t/track/track-location", {"points": [
        {"lat": 26.9, "lng": 75.8, "recorded_at": timezone.now().isoformat(), "accuracy": 200},  # too imprecise -> drop
        {"lat": 26.9, "lng": 75.8, "recorded_at": timezone.now().isoformat(), "accuracy": 5},
    ]})
    assert resp.data["accepted_points"] == 1
    assert resp.data["skipped_points"] == 1


def test_track_is_package_gated(api, make_tenant, tenant_token):
    # P2 = Sales Management = FIELD only, NO TRACK
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    for path in ["/api/t/track/status", "/api/t/track/tracking-health", "/api/t/track/settings"]:
        assert auth(api, token).get(path).status_code == 403
    assert auth(api, token).post("/api/t/track/punch-in", {"lat": 1, "lng": 1}).status_code == 403


def test_track_settings_provisioned_and_editable(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    token = tenant_token(tenant)["access"]  # owner/admin
    settings = auth(api, token).get("/api/t/track/settings")
    assert settings.status_code == 200
    assert settings.data["offline_threshold_min"] == 15
    updated = auth(api, token).patch("/api/t/track/settings", {"offline_threshold_min": 30})
    assert updated.status_code == 200 and updated.data["offline_threshold_min"] == 30


def test_track_data_isolated_between_tenants(api, make_tenant, tenant_token):
    tenant_a, _ = make_tenant(package_code="P1", company="Track A")
    tenant_b, _ = make_tenant(package_code="P1", company="Track B")
    token_a, _ = _agent(api, tenant_a, tenant_token, email="a@track.test")
    auth(api, token_a).post("/api/t/track/punch-in", {"lat": 1, "lng": 1})

    token_b, _ = _agent(api, tenant_b, tenant_token, email="b@track.test")
    # B's tracking-health must not show A's punched-in agent
    health_b = auth(api, token_b).get("/api/t/track/tracking-health")
    assert health_b.data["count"] == 0


def test_capability_integrability(api, make_tenant, tenant_token):
    """A consumer (e.g. Travel Allowance) reads TRACK distance via the registry —
    real value when TRACK entitled, degraded default when not — WITHOUT importing tracking."""
    tenant, _ = make_tenant(package_code="P1")
    token, agent_id = _agent(api, tenant, tenant_token)
    client = auth(api, token)
    client.post("/api/t/track/punch-in", {"lat": 26.9124, "lng": 75.7873})
    now = timezone.now()
    client.post("/api/t/track/track-location", {"points": [
        {"lat": 26.9124, "lng": 75.7873, "recorded_at": (now - timedelta(minutes=6)).isoformat(), "accuracy": 5},
        {"lat": 26.9500, "lng": 75.8200, "recorded_at": now.isoformat(), "accuracy": 5},
    ]})

    with use_tenant(tenant):
        # TRACK entitled -> real distance (> 0, the two points are ~5km apart)
        km = capabilities.call("tracking.distance_for", agent_id, timezone.localdate(),
                               default=0.0, entitled_modules=["TRACK"])
        assert km > 0
        # module NOT entitled -> degraded default (this is how TA falls back)
        assert capabilities.call("tracking.distance_for", agent_id, timezone.localdate(),
                                 default=0.0, entitled_modules=["FIELD"]) == 0.0
        assert capabilities.call("tracking.is_on_duty", agent_id,
                                 default=False, entitled_modules=["TRACK"]) is True


def test_distance_excludes_mocked_and_teleport_segments():
    """Review fix: spoofed / teleport segments must not inflate travel distance
    (it feeds Travel Allowance reimbursement)."""
    from apps.tracking import gps

    # Two real points ~1.5km apart, plus a mocked point far away.
    clean = [
        {"lat": 26.9124, "lng": 75.7873, "is_mocked": False, "suspect": False},
        {"lat": 26.9250, "lng": 75.7900, "is_mocked": False, "suspect": False},
        {"lat": 28.6139, "lng": 77.2090, "is_mocked": True, "suspect": False},  # Delhi — spoofed
    ]
    honest = gps.route_distance_km(clean[:2])
    with_mock = gps.route_distance_km(clean)
    assert with_mock == honest  # the mocked jump adds nothing


def test_stale_batch_does_not_clear_offline(api, make_tenant, tenant_token):
    """Review fix: a stale offline-buffer flush must NOT re-arm the offline flag
    or fire back-online."""
    from datetime import timedelta
    from apps.tracking.models import DutyDay

    tenant, _ = make_tenant(package_code="P1")
    token, agent_id = _agent(api, tenant, tenant_token)
    client = auth(api, token)
    client.post("/api/t/track/punch-in", {"lat": 26.9, "lng": 75.8})

    with use_tenant(tenant):
        report = DutyDay.objects.get(agent_id=agent_id, date=timezone.localdate())
        report.offline_alert_sent_at = timezone.now() - timedelta(minutes=30)  # was flagged offline
        report.save()

    # upload OLD points (2h ago) — a delayed buffer flush
    old = (timezone.now() - timedelta(hours=2)).isoformat()
    client.post("/api/t/track/track-location", {"points": [
        {"lat": 26.9, "lng": 75.8, "recorded_at": old, "accuracy": 5},
    ]})
    with use_tenant(tenant):
        report.refresh_from_db()
        assert report.offline_alert_sent_at is not None  # still deduped (not re-armed)


def test_rbac_dead_slugs_removed():
    """Review fix: 'mdo'/'executive' no longer grant admin in tracking RBAC."""
    from apps.tracking.views import MANAGER_ROLES

    assert "mdo" not in MANAGER_ROLES
    assert "executive" not in MANAGER_ROLES
    assert MANAGER_ROLES == {"admin", "field_manager", "sales_manager"}


def test_upgrade_to_track_later_migrates_and_provisions(api, make_tenant, tenant_token, admin_token):
    """Review fix + user requirement: enabling TRACK on an existing non-TRACK
    tenant must migrate its DB, create TrackingSettings, and work immediately."""
    tenant, _ = make_tenant(package_code="P2")  # FIELD only, NO TRACK
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/track/settings").status_code == 403  # gated off

    # SuperAdmin adds TRACK
    resp = auth(api, admin_token).post(
        f"/api/sa/tenants/{tenant.pk}/set-modules/", {"modules": ["FIELD", "TRACK"]}
    )
    assert resp.status_code == 200

    # TRACK now works end-to-end (settings provisioned, endpoints reachable)
    settings = auth(api, token).get("/api/t/track/settings")
    assert settings.status_code == 200
    assert settings.data["offline_threshold_min"] == 15
    assert auth(api, token).get("/api/t/track/tracking-health").status_code == 200


def test_maintenance_offline_autocheckout_rollup(api, make_tenant, tenant_token):
    from apps.foundation.integration import events
    from apps.tracking import services
    from apps.tracking.models import DutyDay, RouteHistory

    tenant, _ = make_tenant(package_code="P1")
    token, agent_id = _agent(api, tenant, tenant_token)
    client = auth(api, token)
    client.post("/api/t/track/punch-in", {"lat": 26.9, "lng": 75.8})
    client.post("/api/t/track/track-location", {"points": [
        {"lat": 26.9, "lng": 75.8, "recorded_at": timezone.now().isoformat(), "accuracy": 5},
    ]})

    fired = []
    events.subscribe("track.went_offline", lambda **p: fired.append(p))

    with use_tenant(tenant):
        report = DutyDay.objects.get(agent_id=agent_id, date=timezone.localdate())
        # Make it stale (last point long ago) so offline detection fires.
        report.last_location_at = timezone.now() - timedelta(hours=2)
        report.save()
        flagged = services.flag_offline_agents()
        assert agent_id in flagged
        assert fired and fired[0]["agent_id"] == agent_id  # event emitted (no hard notify import)

        # auto punch-out yesterday's open report
        report.date = timezone.localdate() - timedelta(days=1)
        report.punch_out_time = None
        report.save()
        assert services.auto_punch_out() >= 1
        report.refresh_from_db()
        assert report.punch_out_type == "auto"

        # route rollup builds RouteHistory (visit_count 0 since FIELD absent)
        assert services.build_route_histories() >= 1
        rh = RouteHistory.objects.get(agent_id=agent_id, date=report.date)
        assert rh.visit_count == 0
