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
