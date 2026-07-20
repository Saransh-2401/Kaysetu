import json
import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.control.models import Package, Subscription, Tenant
from apps.foundation.permissions import IsTenantAdmin

from . import services
from .gateway import GatewayError, get_gateway
from .models import PaymentOrder

logger = logging.getLogger("kaysetu.billing")


def _tenant(request) -> Tenant:
    return Tenant.objects.get(pk=request.auth["tid"])


class QuoteView(APIView):
    permission_classes = [IsTenantAdmin]

    def get(self, request):
        try:
            package = Package.objects.get(
                code=request.query_params.get("package", ""), is_published=True, is_addon=False
            )
        except Package.DoesNotExist:
            return Response({"detail": "Unknown package."}, status=400)
        try:
            seats = max(1, int(request.query_params.get("seats", package.included_users)))
        except ValueError:
            return Response({"detail": "seats must be a number."}, status=400)
        cycle = request.query_params.get("cycle", "monthly")
        if cycle not in Subscription.Cycle.values:
            return Response({"detail": "cycle must be monthly or annual."}, status=400)
        return Response(services.quote(package, seats, cycle))


class BillingSummaryView(APIView):
    """The tenant's Billing page data."""

    permission_classes = [IsTenantAdmin]

    def get(self, request):
        tenant = _tenant(request)
        subscription = tenant.subscriptions.order_by("-started_at").first()
        payments = [
            {
                "id": order.pk,
                "package": order.package.code,
                "seats": order.seats,
                "cycle": order.billing_cycle,
                "total": str(order.total),
                "status": order.status,
                "paid_at": order.paid_at,
                "created_at": order.created_at,
            }
            for order in tenant.payment_orders.all()[:10]
        ]
        return Response(
            {
                "tenant_status": tenant.status,
                "trial_ends_at": tenant.trial_ends_at,
                "subscription": subscription
                and {
                    "package_code": subscription.package.code,
                    "package_name": subscription.package.name,
                    "seats": subscription.seats,
                    "billing_cycle": subscription.billing_cycle,
                    "status": subscription.status,
                    "current_period_end": subscription.current_period_end,
                },
                "payments": payments,
            }
        )


class CheckoutView(APIView):
    permission_classes = [IsTenantAdmin]

    def post(self, request):
        tenant = _tenant(request)
        package_code = request.data.get("package_code") or (tenant.package and tenant.package.code)
        if not package_code:
            return Response({"detail": "package_code required."}, status=400)
        try:
            seats = max(1, int(request.data.get("seats", 1)))
        except (TypeError, ValueError):
            return Response({"detail": "seats must be a number."}, status=400)
        cycle = request.data.get("cycle", "monthly")
        if cycle not in Subscription.Cycle.values:
            return Response({"detail": "cycle must be monthly or annual."}, status=400)
        try:
            order = services.start_checkout(tenant, package_code=package_code, seats=seats, cycle=cycle)
        except Package.DoesNotExist:
            return Response({"detail": "Unknown package."}, status=400)
        except GatewayError as error:
            logger.error("checkout gateway error for %s: %s", tenant.org_code, error)
            return Response({"detail": "Payment gateway unavailable. Try again shortly."}, status=502)
        return Response(
            {
                "order_id": order.pk,
                "gateway": order.gateway,
                "gateway_order_id": order.gateway_order_id,
                "key_id": order.meta.get("key_id"),
                "amount_paise": int(order.total * 100),
                "currency": order.currency,
                "quote": order.meta.get("quote"),
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyView(APIView):
    """Browser callback after gateway checkout completes."""

    permission_classes = [IsTenantAdmin]

    def post(self, request):
        tenant = _tenant(request)
        try:
            order = PaymentOrder.objects.get(
                pk=request.data.get("order_id"), tenant=tenant
            )
        except (PaymentOrder.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Unknown order."}, status=404)

        payment_id = request.data.get("payment_id") or ""
        verified = get_gateway().verify_payment_signature(
            order_id=order.gateway_order_id,
            payment_id=payment_id,
            signature=request.data.get("signature") or "",
        )
        if not verified:
            return Response({"detail": "Payment signature mismatch."}, status=400)
        services.apply_payment_success(order, payment_id)
        return Response({"status": "paid", "tenant_status": order.tenant.status})


class RazorpayWebhookView(APIView):
    """Server-to-server confirmation — the authoritative payment signal."""

    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        signature = request.headers.get("X-Razorpay-Signature", "")
        if not get_gateway().verify_webhook_signature(body=request.body, signature=signature):
            return Response({"detail": "bad signature"}, status=400)
        try:
            event = json.loads(request.body)
        except ValueError:
            return Response({"detail": "bad payload"}, status=400)

        if event.get("event") in ("payment.captured", "order.paid"):
            payment = event.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id", "")
            order = PaymentOrder.objects.filter(gateway_order_id=order_id).first()
            if order is not None:
                services.apply_payment_success(order, payment.get("id", ""))
            else:
                logger.warning("webhook for unknown gateway order %s", order_id)
        return Response({"status": "ok"})
