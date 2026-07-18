"""DIST API — Distribution Network. Gated by HasModule('DIST'). /api/t/dist/."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.foundation.permissions import HasModule

from . import services
from .models import DistributorInvoice, DistributorStock, StockRequest
from .serializers import (
    DistributorInvoiceSerializer,
    DistributorStockSerializer,
    StockRequestSerializer,
)

DistModule = HasModule("DIST")
MANAGER_ROLES = {"admin", "sales_manager", "distributor_manager"}
DISTRIBUTOR_ROLE = "distributor"


def _is_manager(user) -> bool:
    return bool(user and (user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)))


def _own_party_id(user):
    """The Party this login acts for, if any. Scoping keys off THIS rather than a
    role name — a custom role (or no role) must not silently see every
    distributor's commercial data."""
    if user is None or _is_manager(user):
        return None
    return getattr(user, "party_id", None) or None


def _scope_to_own_party(qs, user, field="distributor_id"):
    own = _own_party_id(user)
    return qs.filter(**{field: own}) if own else qs


class IsDistManager(BasePermission):
    """Approving / dispatching / invoicing is a company-side action."""

    message = "Distribution manager access required."

    def has_permission(self, request, view):
        return _is_manager(request.user)


class DistPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 2000


class StockRequestViewSet(viewsets.ModelViewSet):
    serializer_class = StockRequestSerializer
    pagination_class = DistPagination
    http_method_names = ["get", "post", "head", "options"]

    # Company-side actions. Listed explicitly because get_permissions() below
    # replaces the per-action permission_classes DRF would otherwise apply.
    MANAGER_ACTIONS = {"approve", "reject", "dispatch_stock", "mark_delivered", "invoice"}

    def get_permissions(self):
        if self.action in self.MANAGER_ACTIONS:
            return [DistModule(), IsDistManager()]
        return [DistModule()]

    def get_queryset(self):
        qs = (StockRequest.objects.select_related("distributor")
              .prefetch_related("items", "logs"))
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in params["status"].split(",") if s.strip()])
        if params.get("payment_status"):
            qs = qs.filter(payment_status=params["payment_status"])
        if params.get("distributor"):
            qs = qs.filter(distributor_id=params["distributor"])
        return _scope_to_own_party(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        distributor_id = request.data.get("distributor")
        own = _own_party_id(request.user)
        if own:
            distributor_id = own          # a party-linked user can only request for themselves
        req = services.create_stock_request(
            distributor_id=distributor_id,
            items=request.data.get("items", []),
            notes=request.data.get("notes", ""),
        )
        return Response(StockRequestSerializer(req).data, status=201)

    def _fresh(self):
        """Re-read after a service call: the object from get_object() carries a
        prefetch cache of its items, which a service that rewrote those rows
        would leave stale in the response."""
        return Response(StockRequestSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], permission_classes=[DistModule, IsDistManager])
    def approve(self, request, pk=None):
        services.approve_request(
            self.get_object(), actor=request.user, allocations=request.data.get("allocations"),
        )
        return self._fresh()

    @action(detail=True, methods=["post"], permission_classes=[DistModule, IsDistManager])
    def reject(self, request, pk=None):
        services.reject_request(self.get_object(), reason=request.data.get("reason", ""),
                                actor=request.user)
        return self._fresh()

    # NOTE: the method must NOT be called `dispatch` — that would shadow
    # ViewSet.dispatch(), the framework's own request dispatcher.
    @action(detail=True, methods=["post"], url_path="dispatch",
            permission_classes=[DistModule, IsDistManager])
    def dispatch_stock(self, request, pk=None):
        services.dispatch_request(self.get_object(), actor=request.user)
        return self._fresh()

    @action(detail=True, methods=["post"], url_path="mark-delivered",
            permission_classes=[DistModule, IsDistManager])
    def mark_delivered(self, request, pk=None):
        services.mark_delivered(self.get_object(), actor=request.user)
        return self._fresh()

    @action(detail=True, methods=["post"], permission_classes=[DistModule, IsDistManager])
    def invoice(self, request, pk=None):
        inv = services.issue_invoice(
            self.get_object(),
            invoice_date=request.data.get("invoice_date") or None,
            due_date=request.data.get("due_date") or None,
        )
        return Response(DistributorInvoiceSerializer(inv).data, status=201)


class DistributorInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [DistModule]
    serializer_class = DistributorInvoiceSerializer
    pagination_class = DistPagination

    def get_queryset(self):
        qs = DistributorInvoice.objects.select_related("distributor", "request")
        params = self.request.query_params
        status_filter = params.get("payment_status") or params.get("status")
        if status_filter:
            qs = qs.filter(status__in=[s.strip() for s in status_filter.split(",") if s.strip()])
        if params.get("distributor"):
            qs = qs.filter(distributor_id=params["distributor"])
        return _scope_to_own_party(qs, self.request.user)

    @action(detail=True, methods=["post"], url_path="mark_paid",
            permission_classes=[DistModule, IsDistManager])
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        amount = request.data.get("amount")
        if amount is None:   # portal's mark_paid settles the whole invoice
            amount = (invoice.total_amount or 0) - (invoice.paid_amount or 0)
        services.record_invoice_payment(
            invoice, amount=amount, mode=request.data.get("mode", "bank"),
            reference=request.data.get("payment_reference", ""),
        )
        return Response(DistributorInvoiceSerializer(self.get_object()).data)


class DistributorStockViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [DistModule]
    serializer_class = DistributorStockSerializer
    pagination_class = DistPagination

    def get_queryset(self):
        qs = DistributorStock.objects.select_related("distributor", "item")
        params = self.request.query_params
        if params.get("distributor"):
            qs = qs.filter(distributor_id=params["distributor"])
        if params.get("item"):
            qs = qs.filter(item_id=params["item"])
        return _scope_to_own_party(qs, self.request.user)
