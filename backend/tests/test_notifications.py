"""NOTIFY: the notification system (CORE — every tenant, every package).

Headline: the eleven modules already announce what happens, so notifications are
wired by SUBSCRIBING to those events — no module changed a line. Who hears what
resolves through three layers: catalog default -> role default -> user override.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _staff(api, tenant, tenant_token, role_slug, email):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": f"{role_slug} user", "role_slug": role_slug,
        "password": "staff-pass-123", "password_confirm": "staff-pass-123"})
    login = api.post("/api/auth/tenant/login",
                     {"org_code": tenant.org_code, "email": email, "password": "staff-pass-123"})
    return login.data["access"], login.data["user"]["id"]


def test_catalog_is_served(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    cat = auth(api, token).get("/api/notifications/events/").data
    assert cat["channels"] == ["in_app", "push", "email", "sms"]
    keys = {e["key"] for e in cat["events"]}
    assert {"order_placed", "agent_offline", "announcement"} <= keys
    assert next(e for e in cat["events"] if e["key"] == "agent_offline")["critical"] is True
    assert next(e for e in cat["events"] if e["key"] == "announcement")["mandatory"] is True
    assert "Field & Visits" in cat["categories"]


def test_notifications_are_core_not_package_gated(api, make_tenant, tenant_token):
    """A tenant on the smallest package still gets a feed."""
    tenant, _ = make_tenant(package_code="P1")   # TRACK only
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/notifications/feed/").status_code == 200
    assert auth(api, token).get("/api/notifications/events/").status_code == 200
    assert auth(api, token).get("/api/notifications/my-preferences/").status_code == 200


# ------------------------------------------------------------- THE HEADLINE
def test_module_events_produce_notifications(api, make_tenant, tenant_token):
    """Placing an order notifies the sales manager — via the existing event bus,
    with ORDERS entirely unaware that notifications exist."""
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    mgr_token, mgr_id = _staff(api, tenant, tenant_token, "sales_manager", "mgr@n.test")
    client = auth(api, owner)
    item = client.post("/api/t/catalog/", {"name": "Widget", "price": "100", "tax_rate": "0"}).data["id"]
    party = client.post("/api/t/parties/", {"name": "Buyer", "kind": "customer"}).data["id"]

    client.post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "Widget",
                                      "quantity": 2, "rate": "100"}]})

    feed = auth(api, mgr_token).get("/api/notifications/feed/").data
    assert feed["unread"] >= 1
    assert any(f["event_key"] == "order_placed" for f in feed["results"])
    row = next(f for f in feed["results"] if f["event_key"] == "order_placed")
    assert row["is_read"] is False and row["reference_doctype"] == "sales_order"


def test_feed_is_private_and_readable(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    mgr_token, _ = _staff(api, tenant, tenant_token, "sales_manager", "mgr2@n.test")
    other_token, _ = _staff(api, tenant, tenant_token, "sales_agent", "agent2@n.test")
    client = auth(api, owner)
    item = client.post("/api/t/catalog/", {"name": "W", "price": "10", "tax_rate": "0"}).data["id"]
    party = client.post("/api/t/parties/", {"name": "B", "kind": "customer"}).data["id"]
    client.post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "W", "quantity": 1, "rate": "10"}]})

    # NOTE: auth() rebinds credentials on the SHARED client, so re-auth before
    # every request whenever two identities are interleaved.
    feed = auth(api, mgr_token).get("/api/notifications/feed/").data
    assert feed["unread"] >= 1
    # the sales_agent is NOT in this event's audience -> sees nothing
    assert auth(api, other_token).get("/api/notifications/feed/").data["unread"] == 0

    nid = feed["results"][0]["id"]
    assert auth(api, mgr_token).post(f"/api/notifications/feed/{nid}/read/").data["is_read"] is True
    assert auth(api, mgr_token).get(
        "/api/notifications/feed/summary/").data["unread"] == feed["unread"] - 1
    auth(api, mgr_token).post("/api/notifications/feed/read-all/")
    assert auth(api, mgr_token).get("/api/notifications/feed/summary/").data["unread"] == 0
    # one person's feed item is not reachable from another account
    assert auth(api, other_token).post(f"/api/notifications/feed/{nid}/read/").status_code == 404


def test_preferences_resolve_through_three_layers(api, make_tenant, tenant_token):
    """catalog default -> role default -> user override, each layer sparse."""
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    mgr_token, _ = _staff(api, tenant, tenant_token, "sales_manager", "mgr3@n.test")

    def mgr_view():
        # re-auth each time: auth() rebinds the shared client's credentials
        return next(e for e in auth(api, mgr_token).get(
            "/api/notifications/my-preferences/").data["events"] if e["key"] == "order_placed")

    order = mgr_view()
    assert order["effective"] == {"in_app": True, "push": True, "email": False, "sms": False}
    assert order["relevant"] is True     # sales_manager is in the audience

    # admin turns push OFF for the whole role
    assert auth(api, owner).patch("/api/notifications/role-defaults/", {
        "role": "sales_manager",
        "overrides": {"order_placed": {"push": False}}}).status_code == 200
    order = mgr_view()
    assert order["effective"]["push"] is False and order["effective"]["in_app"] is True

    # the individual turns push back on for themselves — user beats role
    auth(api, mgr_token).patch("/api/notifications/my-preferences/", {
        "overrides": {"order_placed": {"push": True}}})
    order = mgr_view()
    assert order["effective"]["push"] is True and order["override"] == {"push": True}

    # clearing the override falls back to the role again
    auth(api, mgr_token).patch("/api/notifications/my-preferences/",
                               {"overrides": {"order_placed": {}}})
    order = mgr_view()
    assert order["effective"]["push"] is False and order["override"] == {}


def test_muting_suppresses_normal_events_but_not_critical(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    mgr_token, mgr_id = _staff(api, tenant, tenant_token, "sales_manager", "mgr4@n.test")
    mgr = auth(api, mgr_token)
    assert mgr.patch("/api/notifications/my-preferences/", {"muted": True}).data["muted"] is True

    with use_tenant(tenant):
        from apps.notifications.services import notify_event
        from apps.notifications.models import Notification

        notify_event("order_placed", subject="An order")           # normal -> muted
        assert Notification.objects.filter(user_id=mgr_id).count() == 0
        notify_event("agent_offline", subject="Agent offline")     # critical -> gets through
        assert Notification.objects.filter(user_id=mgr_id, event_key="agent_offline").count() == 1


def test_unknown_event_key_is_refused(api, make_tenant, tenant_token):
    """A typo'd key would otherwise notify nobody, forever, silently."""
    tenant, _ = make_tenant(package_code="P8")
    tenant_token(tenant)
    with use_tenant(tenant):
        from apps.notifications.services import notify_event

        with pytest.raises(ValueError):
            notify_event("no_such_event", subject="nope")
    # ...and the API refuses to store preferences for one
    token = tenant_token(tenant)["access"]
    assert auth(api, token).patch("/api/notifications/my-preferences/", {
        "overrides": {"no_such_event": {"push": True}}}).status_code == 400


def test_broadcast_reaches_the_selected_audience(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    mgr_token, _ = _staff(api, tenant, tenant_token, "sales_manager", "mgr5@n.test")
    agent_token, _ = _staff(api, tenant, tenant_token, "sales_agent", "agent5@n.test")

    sent = auth(api, owner).post("/api/notifications/broadcast/", {
        "title": "Holiday notice", "body": "Office closed Friday.",
        "audience_type": "roles", "roles": ["sales_agent"]})
    assert sent.status_code == 201 and sent.data["recipient_count"] == 1
    assert auth(api, agent_token).get("/api/notifications/feed/").data["unread"] == 1
    assert auth(api, mgr_token).get("/api/notifications/feed/").data["unread"] == 0

    # a role nobody holds is reported rather than silently doing nothing
    warned = auth(api, owner).post("/api/notifications/broadcast/", {
        "title": "Ping", "audience_type": "roles", "roles": ["production_manager"]})
    assert warned.data["recipient_count"] == 0 and warned.data["warnings"]

    # an announcement is mandatory: muting cannot suppress the in-app copy
    auth(api, agent_token).patch("/api/notifications/my-preferences/", {"muted": True})
    auth(api, owner).post("/api/notifications/broadcast/", {
        "title": "Critical", "audience_type": "roles", "roles": ["sales_agent"]})
    assert auth(api, agent_token).get("/api/notifications/feed/").data["unread"] == 2


def test_broadcast_and_role_defaults_are_admin_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    agent_token, _ = _staff(api, tenant, tenant_token, "sales_agent", "agent6@n.test")
    agent = auth(api, agent_token)

    assert agent.post("/api/notifications/broadcast/", {"title": "hi"}).status_code == 403
    assert agent.get("/api/notifications/role-defaults/").status_code == 403
    assert agent.patch("/api/notifications/role-defaults/", {
        "role": "sales_agent", "overrides": {}}).status_code == 403
    assert agent.get("/api/notifications/broadcast/recipients/").status_code == 403
    # ...but an agent can still read what was broadcast, and set their own prefs
    assert agent.get("/api/notifications/broadcast/").status_code == 200
    assert agent.patch("/api/notifications/my-preferences/", {"muted": True}).status_code == 200
    assert auth(api, owner).get("/api/notifications/role-defaults/?role=sales_agent").status_code == 200
