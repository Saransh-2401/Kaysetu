"""Platform-owned message catalog.

KaySetu authors the templates and pays for delivery, so they live in the CONTROL
database as one shared copy: Ops rewords them, every tenant sees the change at
once, and no tenant can edit them or point sending at its own account.
"""
import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")

OPS_TEMPLATES = "/api/sa/message-templates/"
OPS_CONFIG = "/api/sa/messaging-config"
TENANT_TEMPLATES = "/api/core/message-templates/"


def test_catalog_is_seeded_with_email_and_sms(api, admin_token):
    client = auth(api, admin_token)
    rows = client.get(OPS_TEMPLATES).data
    assert len(rows) > 0

    keys = {(r["channel"], r["trigger_key"]) for r in rows}
    # The two the platform actually sends today.
    assert ("email", "OTP_LOGIN") in keys
    assert ("email", "USER_CREDENTIALS") in keys
    assert ("sms", "OTP_LOGIN") in keys

    otp = next(r for r in rows if r["channel"] == "email" and r["trigger_key"] == "OTP_LOGIN")
    assert "{otp}" in otp["body"]
    # Designed HTML, not a bare string — must survive mail clients that strip
    # <style> blocks, so the styling has to be inline.
    assert "<table" in otp["body"] and "style=" in otp["body"]
    assert "<style>" not in otp["body"]


def test_ops_can_reword_but_not_create_or_delete(api, admin_token):
    client = auth(api, admin_token)
    rows = client.get(OPS_TEMPLATES).data
    target = next(r for r in rows if r["trigger_key"] == "OTP_LOGIN" and r["channel"] == "email")

    edited = client.patch(f"{OPS_TEMPLATES}{target['id']}/",
                          {"subject": "Your code", "body": "<p>{otp}</p>"})
    assert edited.status_code == 200
    assert edited.data["subject"] == "Your code"

    # The contract with the sending code is not editable.
    locked = client.patch(f"{OPS_TEMPLATES}{target['id']}/", {"trigger_key": "SOMETHING_ELSE"})
    assert locked.status_code == 200
    assert locked.data["trigger_key"] == "OTP_LOGIN"

    # The catalog ships with the code: Ops rewords, engineering adds/removes.
    assert client.post(OPS_TEMPLATES, {"channel": "email", "trigger_key": "X",
                                       "name": "X"}).status_code == 405
    assert client.delete(f"{OPS_TEMPLATES}{target['id']}/").status_code == 405


def test_tenants_see_every_template_but_cannot_change_any(api, admin_token, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    tenant_client = auth(api, tenant_token(tenant)["access"])

    rows = tenant_client.get(TENANT_TEMPLATES).data
    assert len(rows) > 0
    assert all(r["editable"] is False for r in rows)
    assert all(r["managed_by"] == "KaySetu" for r in rows)
    # A TRACK-only tenant still SEES the whole catalog — the ask was visibility,
    # not entitlement filtering.
    assert {r["module_code"] for r in rows} - {""} != set()

    # Read-only: there is no tenant write route at all.
    assert tenant_client.post(TENANT_TEMPLATES, {"name": "nope"}).status_code in (403, 405)
    # And the SuperAdmin console is off-limits to a tenant token.
    assert tenant_client.get(OPS_TEMPLATES).status_code in (401, 403)
    assert tenant_client.patch(OPS_CONFIG, {"smtp_host": "evil.example.com"}).status_code in (401, 403)


def test_an_ops_edit_is_visible_to_tenants_immediately(api, admin_token, make_tenant, tenant_token):
    """One central copy — no per-tenant sync step to forget."""
    tenant, _ = make_tenant(package_code="P1")
    ops = auth(api, admin_token)
    rows = ops.get(OPS_TEMPLATES).data
    target = next(r for r in rows if r["trigger_key"] == "USER_CREDENTIALS")
    assert ops.patch(f"{OPS_TEMPLATES}{target['id']}/",
                     {"subject": "Welcome to KaySetu!"}).status_code == 200

    tenant_client = auth(api, tenant_token(tenant)["access"])
    seen = next(r for r in tenant_client.get(TENANT_TEMPLATES).data
                if r["trigger_key"] == "USER_CREDENTIALS")
    assert seen["subject"] == "Welcome to KaySetu!"


def test_platform_credentials_are_write_only_and_survive_a_blank_save(api, admin_token):
    client = auth(api, admin_token)

    saved = client.patch(OPS_CONFIG, {
        "smtp_host": "smtp.kaysetu.in", "smtp_username": "no-reply@kaysetu.in",
        "smtp_password": "platform-secret", "from_email": "no-reply@kaysetu.in",
    }).data
    assert saved["has_smtp_password"] is True
    assert "smtp_password" not in saved        # never echoed back
    assert saved["email_ready"] is True

    # Editing the from-name must not wipe the password for every tenant.
    again = client.patch(OPS_CONFIG, {"from_name": "KaySetu"}).data
    assert again["has_smtp_password"] is True
    assert again["email_ready"] is True


def test_rendering_leaves_html_braces_alone(api):
    """Bodies are CSS-heavy HTML; str.format() would raise on a stray brace."""
    from apps.control import messaging

    out = messaging.render(
        "<div style=\"color:#fff\">Hi {full_name}, code {otp}</div>",
        {"full_name": "Asha", "otp": "123456"},
    )
    assert out == "<div style=\"color:#fff\">Hi Asha, code 123456</div>"
    # An unsupplied placeholder stays visible instead of silently blanking.
    assert "{missing}" in messaging.render("x {missing}", {"other": 1})


# ── Notification delivery now uses the platform templates ────────────────

def test_event_template_is_used_only_when_every_placeholder_can_be_filled():
    """The guard that keeps '{order_number}' out of a customer's inbox."""
    from apps.control import messaging

    assert messaging.unfilled("Order {order_number} for {customer_name}") == [
        "{order_number}", "{customer_name}"]
    assert messaging.unfilled("Order SO-1024 booked") == []
    # Real CSS/HTML braces must never be mistaken for a placeholder: the pattern
    # only matches lower_snake identifiers, so selectors, spaces and capitals
    # are all ignored.
    assert messaging.unfilled("@media screen { .card { color: red } }") == []
    assert messaging.unfilled("<div style='color:#fff'>{Name} {} {a-b}</div>") == []
    # A bare {a} is genuinely placeholder-shaped and IS reported — the catalog
    # keeps to descriptive names, so that is the safe way round.
    assert messaging.unfilled("{a}") == ["{a}"]


def test_notify_event_sends_email_via_the_platform_account(api, make_tenant, tenant_token, monkeypatch):
    from apps.control import messaging
    from apps.notifications.services import notify_event
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P1")
    sent = []
    monkeypatch.setattr(messaging, "send_email",
                        lambda to, subject, body: (sent.append((to, subject, body)), (True, ""))[1])

    with use_tenant(tenant):
        from apps.foundation.models import TenantUser
        from apps.notifications.models import UserNotificationSetting

        owner = TenantUser.objects.filter(is_active=True).first()
        # Opt this user into email for the event.
        UserNotificationSetting.objects.update_or_create(
            user=owner, event_key="announcement",
            defaults={"channels": {"in_app": True, "email": True}},
        )
        result = notify_event("announcement", subject="Diwali holiday",
                              message="Office closed Monday.", users=[owner])

    assert result["delivered_email"] == 1
    to, subject, body = sent[0]
    assert to == owner.email
    assert "Diwali holiday" in subject or "Diwali holiday" in body
    # Rendered through a designed template, not raw text.
    assert "<table" in body
    # And nothing unfilled leaked through.
    assert messaging.unfilled(body) == []


def test_delivery_failures_never_break_the_notification(api, make_tenant, tenant_token, monkeypatch):
    """A mail outage must not stop the in-app feed item being created."""
    from apps.control import messaging
    from apps.notifications.services import notify_event
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P1")

    def boom(*a, **k):
        raise RuntimeError("smtp is down")

    monkeypatch.setattr(messaging, "send_email", boom)

    with use_tenant(tenant):
        from apps.foundation.models import TenantUser
        from apps.notifications.models import Notification, UserNotificationSetting

        owner = TenantUser.objects.filter(is_active=True).first()
        UserNotificationSetting.objects.update_or_create(
            user=owner, event_key="announcement",
            defaults={"channels": {"in_app": True, "email": True}},
        )
        result = notify_event("announcement", subject="Still works",
                              message="body", users=[owner])
        assert Notification.objects.filter(subject="Still works").exists()

    assert result["delivered_in_app"] == 1
    assert result["delivered_email"] == 0     # reported honestly, not pretended


def test_org_setting_switches_an_event_off_for_everyone(api, make_tenant, tenant_token):
    """System Alerts is the widest layer: catalog -> ORG -> role -> user.

    Before this existed the screen toggled message templates, which are
    platform-owned and drive nothing tenant-side — the switches changed nothing.
    """
    from apps.notifications.services import effective_channels, notify_event
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P1")

    with use_tenant(tenant):
        from apps.foundation.models import TenantUser
        from apps.notifications.models import Notification, OrgNotificationSetting

        owner = TenantUser.objects.filter(is_active=True).first()

        # On by default (announcement is mandatory -> in_app always lands).
        assert effective_channels("announcement")["in_app"] is True

        # Switch the noisy channels off org-wide.
        OrgNotificationSetting.objects.update_or_create(
            event_key="visit_assigned",
            defaults={"channels": {"in_app": False, "email": False, "sms": False}},
        )
        resolved = effective_channels(
            "visit_assigned",
            org_overrides={"in_app": False, "email": False, "sms": False},
        )
        assert resolved["in_app"] is False and resolved["email"] is False

        before = Notification.objects.filter(event_key="visit_assigned").count()
        result = notify_event("visit_assigned", subject="Visit", message="x", users=[owner])
        after = Notification.objects.filter(event_key="visit_assigned").count()

    # Nothing delivered on any channel once the org switched it off.
    assert result["delivered_in_app"] == 0
    assert result["delivered_email"] == 0
    assert after == before


def test_org_alerts_endpoint_is_admin_only_and_persists(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])

    payload = client.get("/api/notifications/org-alerts/")
    assert payload.status_code == 200, payload.data
    assert payload.data["events"] and payload.data["channels"]

    saved = client.patch("/api/notifications/org-alerts/",
                         {"overrides": {"visit_assigned": {"email": False, "in_app": False}}},
                         format="json")
    assert saved.status_code == 200
    row = next(e for e in saved.data["events"] if e["key"] == "visit_assigned")
    assert row["effective"]["email"] is False
    assert row["effective"]["in_app"] is False

    # And it survives a reload — this is what "the switch does nothing" looked like.
    again = next(e for e in client.get("/api/notifications/org-alerts/").data["events"]
                 if e["key"] == "visit_assigned")
    assert again["effective"]["in_app"] is False
