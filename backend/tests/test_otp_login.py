"""Phone/OTP sign-in — parity with the Old Project's send-otp / verify-otp.

Unlike the Old Project (single-tenant, cache-backed), these are ORG-SCOPED and
DB-backed: a phone number alone cannot identify a tenant here, and no CACHES
backend is configured so a per-process cache would lose codes between workers.
"""
import pytest
from django.test import override_settings

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")

SEND = "/api/auth/tenant/send-otp"
VERIFY = "/api/auth/tenant/verify-otp"
PHONE = "9876500011"


def _make_agent(api, tenant, tenant_token, phone=PHONE):
    client = auth(api, tenant_token(tenant)["access"])
    created = client.post(
        "/api/t/users/",
        {"email": "otp-agent@acme.test", "full_name": "OTP Agent",
         "phone": phone, "password": "agent-pass-123"},
    )
    assert created.status_code == 201, created.data
    return created.data


@override_settings(DEBUG=True)
def test_otp_round_trip_issues_a_session(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    _make_agent(api, tenant, tenant_token)

    sent = api.post(SEND, {"org_code": tenant.org_code, "phone": PHONE})
    assert sent.status_code == 200, sent.data
    code = sent.data["debug_otp"]          # exposed only under DEBUG

    verified = api.post(VERIFY, {"org_code": tenant.org_code, "phone": PHONE, "otp": code})
    assert verified.status_code == 200, verified.data
    assert verified.data["user"]["email"] == "otp-agent@acme.test"
    assert verified.data["access"] and verified.data["refresh"]
    assert verified.data["org"]["org_code"] == tenant.org_code


@override_settings(DEBUG=True)
def test_otp_is_single_use(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    _make_agent(api, tenant, tenant_token)
    code = api.post(SEND, {"org_code": tenant.org_code, "phone": PHONE}).data["debug_otp"]

    assert api.post(VERIFY, {"org_code": tenant.org_code, "phone": PHONE, "otp": code}).status_code == 200
    # Replaying the same code must not mint a second session.
    assert api.post(VERIFY, {"org_code": tenant.org_code, "phone": PHONE, "otp": code}).status_code == 401


@override_settings(DEBUG=True)
def test_wrong_code_is_rejected_and_attempts_are_capped(api, make_tenant, tenant_token):
    from apps.foundation.models import LoginOTP
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P1")
    _make_agent(api, tenant, tenant_token)
    real = api.post(SEND, {"org_code": tenant.org_code, "phone": PHONE}).data["debug_otp"]

    wrong = "000000" if real != "000000" else "111111"
    for _ in range(LoginOTP.MAX_ATTEMPTS):
        assert api.post(VERIFY, {"org_code": tenant.org_code, "phone": PHONE, "otp": wrong}).status_code == 401

    # Burned by brute-force protection — even the real code no longer works.
    assert api.post(VERIFY, {"org_code": tenant.org_code, "phone": PHONE, "otp": real}).status_code == 401
    with use_tenant(tenant):
        assert LoginOTP.objects.filter(phone=PHONE).first().attempts >= LoginOTP.MAX_ATTEMPTS


@override_settings(DEBUG=True)
def test_phone_formats_are_interchangeable(api, make_tenant, tenant_token):
    """+91 / leading-0 / bare must all resolve to the same user."""
    tenant, _ = make_tenant(package_code="P1")
    _make_agent(api, tenant, tenant_token, phone=f"+91{PHONE}")

    code = api.post(SEND, {"org_code": tenant.org_code, "phone": f"0{PHONE}"}).data["debug_otp"]
    ok = api.post(VERIFY, {"org_code": tenant.org_code, "phone": PHONE, "otp": code})
    assert ok.status_code == 200, ok.data


@override_settings(DEBUG=True)
def test_unknown_phone_does_not_leak_and_issues_nothing(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    _make_agent(api, tenant, tenant_token)

    other = api.post(SEND, {"org_code": tenant.org_code, "phone": "9000000000"})
    # Same 200 + wording as a real send, so this can't be used to enumerate phones.
    assert other.status_code == 200
    assert "debug_otp" not in other.data
    assert api.post(
        VERIFY, {"org_code": tenant.org_code, "phone": "9000000000", "otp": "123456"}
    ).status_code == 401


def test_bad_org_code_and_missing_fields_are_rejected(api, make_tenant):
    tenant, _ = make_tenant(package_code="P1")
    assert api.post(SEND, {"org_code": "KST-NOPE", "phone": PHONE}).status_code == 401
    assert api.post(SEND, {"org_code": tenant.org_code}).status_code == 400
    assert api.post(VERIFY, {"org_code": tenant.org_code, "phone": PHONE}).status_code == 400


def test_debug_otp_is_not_exposed_in_production(api, make_tenant, tenant_token):
    """With DEBUG off the plaintext code must never appear in the response."""
    tenant, _ = make_tenant(package_code="P1")
    _make_agent(api, tenant, tenant_token)

    sent = api.post(SEND, {"org_code": tenant.org_code, "phone": PHONE})
    assert sent.status_code == 200
    assert "debug_otp" not in sent.data
    assert "channels" not in sent.data


@override_settings(DEBUG=True)
def test_deactivated_user_cannot_get_a_session_by_otp(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")
    created = _make_agent(api, tenant, tenant_token)

    code = api.post(SEND, {"org_code": tenant.org_code, "phone": PHONE}).data["debug_otp"]
    # Deactivate AFTER the code was issued — the session must still be refused.
    admin = auth(api, tenant_token(tenant)["access"])
    assert admin.patch(f"/api/t/users/{created['id']}/", {"is_active": False}).status_code == 200

    assert api.post(
        VERIFY, {"org_code": tenant.org_code, "phone": PHONE, "otp": code}
    ).status_code == 401
