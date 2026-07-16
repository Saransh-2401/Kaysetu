"""
Payment gateway abstraction.

RazorpayGateway talks to the live API (stdlib HTTP + HMAC — no SDK dependency)
and is selected automatically once RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are set.
MockGateway auto-approves and powers dev/test/E2E without keys.
"""
import base64
import hashlib
import hmac
import json
import urllib.request

from django.conf import settings


class GatewayError(Exception):
    pass


class MockGateway:
    name = "mock"

    def create_order(self, *, amount_paise: int, currency: str, receipt: str) -> dict:
        return {"gateway_order_id": f"mock_order_{receipt}", "key_id": "mock"}

    def verify_payment_signature(self, *, order_id: str, payment_id: str, signature: str) -> bool:
        return signature == "mock"

    def verify_webhook_signature(self, *, body: bytes, signature: str) -> bool:
        return signature == "mock"


class RazorpayGateway:
    name = "razorpay"
    API_BASE = "https://api.razorpay.com/v1"

    def __init__(self, key_id: str, key_secret: str, webhook_secret: str = ""):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret

    def _request(self, path: str, payload: dict) -> dict:
        request = urllib.request.Request(
            f"{self.API_BASE}{path}",
            data=json.dumps(payload).encode(),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Basic "
                + base64.b64encode(f"{self.key_id}:{self.key_secret}".encode()).decode(),
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            raise GatewayError(f"Razorpay error {error.code}: {error.read()[:300]}") from error
        except OSError as error:
            raise GatewayError(f"Razorpay unreachable: {error}") from error

    def create_order(self, *, amount_paise: int, currency: str, receipt: str) -> dict:
        order = self._request(
            "/orders", {"amount": amount_paise, "currency": currency, "receipt": receipt}
        )
        return {"gateway_order_id": order["id"], "key_id": self.key_id}

    def verify_payment_signature(self, *, order_id: str, payment_id: str, signature: str) -> bool:
        expected = hmac.new(
            self.key_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature or "")

    def verify_webhook_signature(self, *, body: bytes, signature: str) -> bool:
        if not self.webhook_secret:
            return False
        expected = hmac.new(self.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")


def get_gateway():
    config = settings.BILLING
    if config["GATEWAY"] == "razorpay" and config["RAZORPAY_KEY_ID"]:
        return RazorpayGateway(
            config["RAZORPAY_KEY_ID"],
            config["RAZORPAY_KEY_SECRET"],
            config["RAZORPAY_WEBHOOK_SECRET"],
        )
    return MockGateway()
