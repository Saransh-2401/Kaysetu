"""Seat enforcement, seat usage in billing summary, GST invoice PDF, two-stage dunning."""
import pytest
from django.utils import timezone

from apps.billing.models import PaymentOrder
from apps.billing.services import run_dunning
from apps.control.models import Subscription
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _add_user(api, token, n):
    return auth(api, token).post(
        "/api/t/users/",
        {"email": f"user{n}@acme.test", "full_name": f"User {n}", "password": "agent-pass-123"},
    )


def _subscribe(api, token, seats, cycle="monthly"):
    checkout = auth(api, token).post("/api/t/billing/checkout", {"seats": seats, "cycle": cycle})
    assert checkout.status_code == 201, checkout.data
    verify = auth(api, token).post(
        "/api/t/billing/verify",
        {"order_id": checkout.data["order_id"], "payment_id": "mock_pay", "signature": "mock"},
    )
    assert verify.status_code == 200, verify.data
    return checkout.data


def test_trial_seat_limit_blocks_and_upgrade_unblocks(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # 5 included users; owner occupies 1
    token = tenant_token(tenant)["access"]

    for n in range(2, 6):  # owner + 4 = 5 = at the trial cap
        assert _add_user(api, token, n).status_code == 201

    blocked = _add_user(api, token, 6)
    assert blocked.status_code == 402, blocked.data
    assert blocked.data["code"] == "seat_limit_reached"
    assert blocked.data["seat_limit"] == 5
    assert blocked.data["seats_used"] == 5

    # Buying 7 seats lifts the cap to 7
    _subscribe(api, token, seats=7)
    assert _add_user(api, token, 6).status_code == 201
    assert _add_user(api, token, 7).status_code == 201
    assert _add_user(api, token, 8).status_code == 402

    # Deactivating one frees a seat; re-activating consumes it again
    users = auth(api, token).get("/api/t/users/").data["results"]
    victim = next(u for u in users if u["email"] == "user7@acme.test")
    assert auth(api, token).patch(f"/api/t/users/{victim['id']}/", {"is_active": False}).status_code == 200
    assert _add_user(api, token, 8).status_code == 201
    reactivate = auth(api, token).patch(f"/api/t/users/{victim['id']}/", {"is_active": True})
    assert reactivate.status_code == 402
    assert reactivate.data["code"] == "seat_limit_reached"


def test_summary_reports_seats_and_invoice_no(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]

    summary = auth(api, token).get("/api/t/billing")
    assert summary.data["seats"] == {"limit": 5, "used": 1}

    _subscribe(api, token, seats=8)
    summary = auth(api, token).get("/api/t/billing")
    assert summary.data["seats"]["limit"] == 8
    paid = summary.data["payments"][0]
    assert paid["status"] == "paid"
    assert paid["invoice_no"].startswith("KSI-")

    # /me carries the subscription block for the portal banner
    me = auth(api, token).get("/api/me")
    assert me.data["org"]["subscription"]["seats"] == 8
    assert me.data["org"]["subscription"]["status"] == "active"


def test_invoice_pdf_download_and_scoping(api, make_tenant, tenant_token):
    tenant_a, _ = make_tenant(package_code="P2")
    token_a = tenant_token(tenant_a)["access"]
    _subscribe(api, token_a, seats=8)
    order = PaymentOrder.objects.get(tenant=tenant_a)

    pdf = auth(api, token_a).get(f"/api/t/billing/invoice/{order.pk}")
    assert pdf.status_code == 200
    assert pdf["Content-Type"] == "application/pdf"
    content = b"".join(pdf.streaming_content) if hasattr(pdf, "streaming_content") else pdf.content
    assert content.startswith(b"%PDF")
    assert f"KSI-".encode() in pdf["Content-Disposition"].encode()

    # Another tenant cannot fetch it; unpaid orders 404
    tenant_b, _ = make_tenant(package_code="P2")
    token_b = tenant_token(tenant_b)["access"]
    assert auth(api, token_b).get(f"/api/t/billing/invoice/{order.pk}").status_code == 404


def test_dunning_two_stage(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    _subscribe(api, token, seats=5)

    subscription = tenant.subscriptions.latest("started_at")

    # Stage 1: period just ended -> past_due, tenant keeps working
    subscription.current_period_end = timezone.now() - timezone.timedelta(hours=1)
    subscription.save(update_fields=["current_period_end"])
    result = run_dunning()
    subscription.refresh_from_db()
    tenant.refresh_from_db()
    assert subscription.status == Subscription.Status.PAST_DUE
    assert tenant.status == "active"
    assert tenant.org_code in result["past_due"]

    # Seat cap still honored during grace (limit stays at paid seats)
    summary = auth(api, token).get("/api/t/billing")
    assert summary.data["seats"]["limit"] == 5

    # Stage 2: grace exhausted -> suspended
    subscription.current_period_end = timezone.now() - timezone.timedelta(days=30)
    subscription.save(update_fields=["current_period_end"])
    result = run_dunning()
    tenant.refresh_from_db()
    assert tenant.status == "suspended"
    assert tenant.org_code in result["suspended"]

    # Suspended org can no longer log in
    relogin = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": tenant.owner_email, "password": "owner-pass-123"},
    )
    assert relogin.status_code in (401, 403)
