"""Billing: quotes, mock-gateway checkout, Razorpay signatures, webhook, dunning."""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.billing.gateway import RazorpayGateway
from apps.billing.models import PaymentOrder
from apps.billing.services import run_dunning
from apps.control.models import Package, Subscription
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _subscribe(api, token, body=None):
    checkout = auth(api, token).post("/api/t/billing/checkout", body or {"seats": 5, "cycle": "monthly"})
    assert checkout.status_code == 201, checkout.data
    assert checkout.data["gateway"] == "mock"
    verify = auth(api, token).post(
        "/api/t/billing/verify",
        {"order_id": checkout.data["order_id"], "payment_id": "mock_pay_1", "signature": "mock"},
    )
    assert verify.status_code == 200, verify.data
    return checkout.data


def test_quote_math_extra_seats_and_annual(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # 1499/mo, 5 users incl, 149/extra
    token = tenant_token(tenant)["access"]

    monthly = auth(api, token).get("/api/t/billing/quote", {"package": "P2", "seats": 8, "cycle": "monthly"})
    assert monthly.status_code == 200
    assert Decimal(monthly.data["subtotal"]) == Decimal("1499") + 3 * Decimal("149")
    assert Decimal(monthly.data["tax"]) == (Decimal(monthly.data["subtotal"]) * 18 / 100).quantize(Decimal("0.01"))

    annual = auth(api, token).get("/api/t/billing/quote", {"package": "P2", "seats": 8, "cycle": "annual"})
    assert Decimal(annual.data["subtotal"]) == Decimal("14990") + 3 * Decimal("149") * 12


def test_mock_checkout_activates_subscription(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    assert tenant.status == "trial"

    _subscribe(api, token)

    tenant.refresh_from_db()
    assert tenant.status == "active"
    subscription = tenant.subscriptions.latest("started_at")
    assert subscription.status == "active"
    assert subscription.current_period_end > timezone.now() + timezone.timedelta(days=25)

    summary = auth(api, token).get("/api/t/billing")
    assert summary.data["tenant_status"] == "active"
    assert summary.data["payments"][0]["status"] == "paid"

    # Verify is idempotent (webhook + callback double-landing)
    order = PaymentOrder.objects.get(tenant=tenant)
    reverify = auth(api, token).post(
        "/api/t/billing/verify",
        {"order_id": order.pk, "payment_id": "mock_pay_1", "signature": "mock"},
    )
    assert reverify.status_code == 200
    assert PaymentOrder.objects.filter(tenant=tenant, status="paid").count() == 1


def test_bad_signature_rejected(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    checkout = auth(api, token).post("/api/t/billing/checkout", {"seats": 5, "cycle": "monthly"})
    verify = auth(api, token).post(
        "/api/t/billing/verify",
        {"order_id": checkout.data["order_id"], "payment_id": "x", "signature": "forged"},
    )
    assert verify.status_code == 400
    tenant.refresh_from_db()
    assert tenant.status == "trial"


def test_package_upgrade_switches_entitlements(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # FIELD
    token = tenant_token(tenant)["access"]

    _subscribe(api, token, {"package_code": "P4", "seats": 5, "cycle": "monthly"})  # ORDERS+INV+DIST

    tenant.refresh_from_db()
    assert tenant.package.code == "P4"
    assert tenant.entitled_modules() == ["DIST", "INV", "ORDERS"]
    assert auth(api, token).get("/api/t/orders/ping").status_code == 200
    assert auth(api, token).get("/api/t/field/ping").status_code == 403


def test_billing_requires_tenant_admin(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    owner_token = tenant_token(tenant)["access"]
    auth(api, owner_token).post(
        "/api/t/users/",
        {"email": "agent3@acme.test", "full_name": "Agent Three",
         "role_slug": "sales_agent", "password": "agent-pass-123"},
    )
    agent = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": "agent3@acme.test", "password": "agent-pass-123"},
    )
    assert auth(api, agent.data["access"]).post("/api/t/billing/checkout", {"seats": 2}).status_code == 403
    assert auth(api, agent.data["access"]).get("/api/t/billing").status_code == 403


def test_webhook_marks_order_paid(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    checkout = auth(api, token).post("/api/t/billing/checkout", {"seats": 5, "cycle": "monthly"})
    gateway_order_id = checkout.data["gateway_order_id"]

    api.credentials()
    response = api.post(
        "/api/billing/webhook/razorpay",
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_wh_1", "order_id": gateway_order_id}}},
        },
        format="json",
        headers={"X-Razorpay-Signature": "mock"},
    )
    assert response.status_code == 200
    tenant.refresh_from_db()
    assert tenant.status == "active"

    bad = api.post(
        "/api/billing/webhook/razorpay", {}, format="json",
        headers={"X-Razorpay-Signature": "forged"},
    )
    assert bad.status_code == 400


def test_razorpay_signature_hmac():
    gateway = RazorpayGateway("rzp_test_key", "the-secret", "hook-secret")
    import hashlib
    import hmac as hmac_lib

    signature = hmac_lib.new(b"the-secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
    assert gateway.verify_payment_signature(order_id="order_1", payment_id="pay_1", signature=signature)
    assert not gateway.verify_payment_signature(order_id="order_1", payment_id="pay_1", signature="bad")

    body = b'{"event":"payment.captured"}'
    hook_signature = hmac_lib.new(b"hook-secret", body, hashlib.sha256).hexdigest()
    assert gateway.verify_webhook_signature(body=body, signature=hook_signature)
    assert not gateway.verify_webhook_signature(body=body, signature="bad")


def test_dunning_suspends_lapsed_tenants(api, make_tenant, tenant_token):
    expired, _ = make_tenant(package_code="P1", company="Expired Trial Co")
    fresh, _ = make_tenant(package_code="P1", company="Fresh Trial Co")
    paid, _ = make_tenant(package_code="P2", company="Lapsed Paid Co")
    _subscribe(api, tenant_token(paid)["access"])

    long_ago = timezone.now() - timezone.timedelta(days=10)
    expired.trial_ends_at = long_ago
    expired.save(update_fields=["trial_ends_at"])
    subscription = paid.subscriptions.latest("started_at")
    subscription.current_period_end = long_ago
    subscription.save(update_fields=["current_period_end"])

    result = run_dunning()

    expired.refresh_from_db(); fresh.refresh_from_db(); paid.refresh_from_db()
    assert expired.status == "suspended"
    assert fresh.status == "trial"
    assert paid.status == "suspended"
    assert set(result["suspended"]) == {expired.org_code, paid.org_code}
    subscription.refresh_from_db()
    assert subscription.status == "past_due"
