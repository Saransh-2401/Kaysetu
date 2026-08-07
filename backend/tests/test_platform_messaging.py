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


def test_broadcast_honours_the_channels_the_admin_ticked(api, make_tenant, tenant_token, monkeypatch):
    """Ticking "Email" on Send Notification must actually send email.

    The channel list was stored on the broadcast row but never passed to
    delivery, so it fell back to the `announcement` catalog default
    (in_app + push, email OFF) and no mail ever went out.
    """
    from apps.control import messaging
    from apps.notifications.services import broadcast
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P1")
    sent = []
    monkeypatch.setattr(messaging, "send_email",
                        lambda to, subject, body: (sent.append(to), (True, ""))[1])

    with use_tenant(tenant):
        _record, _warnings, result = broadcast(
            title="Server maintenance", body="Sunday 2am.",
            audience_type="all", channels=["email"],
        )

    assert result["delivered_email"] >= 1, result
    assert sent, "no email was dispatched"
    # announcement is mandatory, so the in-app copy still lands regardless.
    assert result["delivered_in_app"] >= 1


def test_broadcast_without_email_ticked_sends_no_email(api, make_tenant, tenant_token, monkeypatch):
    from apps.control import messaging
    from apps.notifications.services import broadcast
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P1")
    sent = []
    monkeypatch.setattr(messaging, "send_email",
                        lambda to, subject, body: (sent.append(to), (True, ""))[1])

    with use_tenant(tenant):
        _r, _w, result = broadcast(title="In-app only", body="x",
                                   audience_type="all", channels=["in_app"])

    assert sent == []
    assert result["delivered_email"] == 0
    assert result["delivered_in_app"] >= 1


# ── Every shipped template must actually render ──────────────────────────

def test_every_template_renders_with_its_declared_variables(api, admin_token):
    """Each template must be fillable from the variables it advertises.

    A body referencing {customer_name} while declaring only {order_number} would
    ship a literal placeholder to a customer — this catches that at build time
    instead of in someone's inbox.
    """
    from apps.control import messaging
    from apps.control.models import MessageTemplate

    broken = []
    for tpl in MessageTemplate.objects.all():
        context = {v: f"TEST_{v.upper()}" for v in (tpl.available_variables or [])}
        for field in ("subject", "body", "content"):
            raw = getattr(tpl, field) or ""
            if not raw:
                continue
            leftovers = messaging.unfilled(messaging.render(raw, context))
            if leftovers:
                broken.append(f"{tpl.channel}/{tpl.trigger_key}.{field} -> {leftovers}")

    assert not broken, "templates reference variables they do not declare:\n" + "\n".join(broken)


def test_every_declared_variable_is_actually_used(api, admin_token):
    """The reverse check: a variable advertised but never used is misleading,
    because Ops sees a chip for something the message will not show."""
    from apps.control.models import MessageTemplate

    unused = []
    for tpl in MessageTemplate.objects.all():
        blob = " ".join([tpl.subject or "", tpl.body or "", tpl.content or ""])
        for variable in (tpl.available_variables or []):
            if "{%s}" % variable not in blob:
                unused.append(f"{tpl.channel}/{tpl.trigger_key} declares unused {{{variable}}}")

    assert not unused, "\n".join(unused)


def test_every_email_template_is_wellformed_html(api, admin_token):
    """Mail clients strip <style> blocks, so styling must be inline, and the
    document has to be balanced or Gmail renders it as plain text."""
    from apps.control.models import MessageTemplate

    problems = []
    for tpl in MessageTemplate.objects.filter(channel="email"):
        body = tpl.body or ""
        if "<style>" in body.lower():
            problems.append(f"{tpl.trigger_key}: uses a <style> block")
        if body.count("<table") != body.count("</table>"):
            problems.append(f"{tpl.trigger_key}: unbalanced <table>")
        if body.count("<html") and not body.count("</html>"):
            problems.append(f"{tpl.trigger_key}: unclosed <html>")
        if "style=" not in body:
            problems.append(f"{tpl.trigger_key}: no inline styling at all")
    assert not problems, "\n".join(problems)


def test_sms_templates_are_short_enough_to_send(api, admin_token):
    """A rendered SMS over 320 chars costs three segments and often truncates."""
    from apps.control import messaging
    from apps.control.models import MessageTemplate

    too_long = []
    for tpl in MessageTemplate.objects.filter(channel="sms"):
        context = {v: f"TEST_{v.upper()}" for v in (tpl.available_variables or [])}
        rendered = messaging.render(tpl.content or "", context)
        if len(rendered) > 320:
            too_long.append(f"{tpl.trigger_key}: {len(rendered)} chars")
    assert not too_long, "\n".join(too_long)


def test_send_notification_endpoint_delivers_on_the_chosen_channels(
        api, make_tenant, tenant_token, monkeypatch):
    """The Send Notification screen, end to end over HTTP."""
    from apps.control import messaging

    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])
    sent = []
    monkeypatch.setattr(messaging, "send_email",
                        lambda to, subject, body: (sent.append((to, subject)), (True, ""))[1])

    resp = client.post("/api/notifications/broadcast/", {
        "title": "Payroll day", "body": "Salaries credited.",
        "audience_type": "all", "channels": ["email"],
    }, format="json")
    assert resp.status_code in (200, 201), resp.data
    assert sent, f"no email dispatched; response was {resp.data}"
    assert "Payroll day" in sent[0][1] or "Payroll day" in str(resp.data)


# ── SMS + Push transports ────────────────────────────────────────────────

def test_sms_refuses_to_send_without_provider_dlt_or_valid_number(api, admin_token):
    """Every refusal is explicit — a silent carrier-side drop is worse."""
    from apps.control import messaging
    from apps.control.models import PlatformMessagingConfig

    config, _ = PlatformMessagingConfig.objects.get_or_create(pk=1)
    config.sms_provider = ""
    config.sms_api_key = ""
    config.sms_entity_id = ""
    config.save()

    ok, err = messaging.send_sms("9876500011", "hi", "1234")
    assert not ok and "not configured" in err.lower()

    # Key + entity but no provider selected must NOT report ready.
    config.sms_api_key = "k"
    config.sms_entity_id = "e"
    config.save()
    assert config.sms_ready() is False
    ok, err = messaging.send_sms("9876500011", "hi", "1234")
    assert not ok

    config.sms_provider = "msg91"
    config.save()
    assert config.sms_ready() is True
    # DLT id is mandatory in India.
    ok, err = messaging.send_sms("9876500011", "hi", "")
    assert not ok and "dlt" in err.lower()
    # And the number has to be a real 10-digit mobile.
    ok, err = messaging.send_sms("123", "hi", "1234")
    assert not ok and "valid" in err.lower()


def test_msisdn_normalisation_accepts_the_formats_admins_type():
    from apps.control.messaging import normalise_msisdn

    for raw in ("9876500011", "+919876500011", "09876500011", "+91 98765 00011"):
        assert normalise_msisdn(raw) == "919876500011", raw


def test_sms_reports_a_gateway_error_body_as_failure(api, admin_token, monkeypatch):
    """Gateways answer 200 with an error body — a 200 is not proof of delivery."""
    import requests

    from apps.control import messaging
    from apps.control.models import PlatformMessagingConfig

    config, _ = PlatformMessagingConfig.objects.get_or_create(pk=1)
    config.sms_provider = "msg91"
    config.sms_api_key = "k"
    config.sms_entity_id = "e"
    config.sms_sender_id = "KAYSTU"
    config.save()

    class Resp:
        status_code = 200
        text = '{"type":"error","message":"invalid authkey"}'

    monkeypatch.setattr(requests, "get", lambda *a, **k: Resp())
    ok, err = messaging.send_sms("9876500011", "hi", "1234")
    assert not ok and "rejected" in err.lower()

    class Good:
        status_code = 200
        text = "3ac1f0b8"          # msg91 returns a message id on success

    monkeypatch.setattr(requests, "get", lambda *a, **k: Good())
    ok, err = messaging.send_sms("9876500011", "hi", "1234")
    assert ok, err


def test_push_requires_a_key_and_tokens(api, admin_token):
    from apps.control import messaging
    from apps.control.models import PlatformMessagingConfig

    config, _ = PlatformMessagingConfig.objects.get_or_create(pk=1)
    config.fcm_service_account = ""
    config.save()
    count, err = messaging.send_push(["tok"], "t", "b")
    assert count == 0 and "not configured" in err.lower()

    config.fcm_service_account = "{\"type\":\"service_account\"}"
    config.save()
    count, err = messaging.send_push([], "t", "b")
    assert count == 0 and "no registered devices" in err.lower()


def test_device_token_registration_and_push_delivery(api, make_tenant, tenant_token, monkeypatch):
    """A device registers, then a push-enabled event reaches it."""
    from apps.control import messaging
    from apps.control.models import PlatformMessagingConfig

    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])

    registered = client.post("/api/notifications/device-tokens/",
                             {"token": "fcm-token-abc", "platform": "android"})
    assert registered.status_code == 201, registered.data

    config, _ = PlatformMessagingConfig.objects.get_or_create(pk=1)
    config.fcm_service_account = "{\"type\":\"service_account\"}"
    config.save()

    pushed = {}
    monkeypatch.setattr(messaging, "send_push",
                        lambda tokens, title, body, data=None: (pushed.update(
                            {"tokens": tokens, "title": title}), (len(tokens), ""))[1])

    from apps.notifications.services import broadcast
    from apps.tenancy.context import use_tenant

    with use_tenant(tenant):
        _r, _w, result = broadcast(title="Cyclone alert", body="Stay safe.",
                                   audience_type="all", channels=["push"])

    assert result["delivered_push"] >= 1, result
    assert pushed["tokens"] == ["fcm-token-abc"]
    assert pushed["title"] == "Cyclone alert"

    # Signing out retires the token, so it stops receiving.
    assert client.delete("/api/notifications/device-tokens/",
                         {"token": "fcm-token-abc"}, format="json").status_code == 200


def test_smsgatewayhub_matches_the_old_platforms_contract(api, admin_token, monkeypatch):
    """Same gateway, same account, same approved DLT templates as before.

    SMSGatewayHub answers HTTP 200 even when it rejects a message — only
    ErrorCode "000" means it was accepted.
    """
    import requests

    from apps.control import messaging
    from apps.control.models import PlatformMessagingConfig

    config, _ = PlatformMessagingConfig.objects.get_or_create(pk=1)
    config.sms_provider = "smsgatewayhub"
    config.sms_api_key = "key"
    config.sms_sender_id = "KAYSTU"
    config.sms_entity_id = "entity"
    config.save()

    captured = {}

    class Resp:
        status_code = 200
        def __init__(self, payload): self._payload = payload
        def json(self): return self._payload

    def fake_get(url, params=None, timeout=None):
        captured["url"] = url
        captured["params"] = params
        return Resp({"ErrorCode": "000", "ErrorMessage": "Success", "JobId": "1"})

    monkeypatch.setattr(requests, "get", fake_get)
    ok, err = messaging.send_sms("+91 98765 00011", "Your code is 123456", "170199")
    assert ok, err
    assert captured["url"] == "https://www.smsgatewayhub.com/api/mt/SendSMS"
    p = captured["params"]
    # The exact parameter contract the old platform used.
    assert p["APIKey"] == "key" and p["senderid"] == "KAYSTU"
    assert p["EntityId"] == "entity" and p["dlttemplateid"] == "170199"
    assert p["channel"] == "2" and p["route"] == "clickhere"
    assert p["number"] == "919876500011"          # normalised from a spaced +91

    # A rejection arrives as HTTP 200 with a non-000 code and must NOT count.
    monkeypatch.setattr(requests, "get",
                        lambda *a, **k: Resp({"ErrorCode": "005",
                                              "ErrorMessage": "Invalid Template"}))
    ok, err = messaging.send_sms("9876500011", "hi", "170199")
    assert not ok and "005" in err and "Invalid Template" in err


def test_broadcast_reports_per_channel_delivery_counts(api, make_tenant, tenant_token, monkeypatch):
    """An admin who ticks Email must be told whether it actually sent.

    The endpoint used to report only the in-app count, so a failed email looked
    exactly like a successful send.
    """
    from apps.control import messaging

    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])
    monkeypatch.setattr(messaging, "send_email", lambda *a, **k: (True, ""))

    resp = client.post("/api/notifications/broadcast/", {
        "title": "Counts", "body": "b", "audience_type": "all", "channels": ["email"],
    }, format="json")
    assert resp.status_code == 201, resp.data
    for key in ("delivered_in_app", "delivered_email", "delivered_sms", "delivered_push"):
        assert key in resp.data, f"{key} missing from the broadcast response"
    assert resp.data["delivered_email"] >= 1
