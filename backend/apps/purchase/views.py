"""PURCH API — Procurement. Gated by HasModule('PURCH'). /api/t/purchase/."""
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.foundation.models import Party
from apps.foundation.permissions import HasModule

from . import services
from .models import GoodsReceipt, MaterialRequest, PurchaseBill, PurchaseOrder
from .serializers import (
    GoodsReceiptSerializer,
    MaterialRequestSerializer,
    PurchaseBillSerializer,
    PurchaseOrderSerializer,
    SupplierSerializer,
)

PurchModule = HasModule("PURCH")
MANAGER_ROLES = {"admin", "purchase_manager"}


def _is_purchaser(user) -> bool:
    return bool(user and (user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)))


class IsPurchaser(BasePermission):
    """Approving/receiving/billing is a purchase-manager action."""

    message = "Purchase access required."

    def has_permission(self, request, view):
        return _is_purchaser(request.user)


class PurchPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 2000


class SupplierViewSet(viewsets.ModelViewSet):
    """Suppliers are foundation Parties (kind=supplier) — one party registry
    shared with customers, exposed here in the supplier shape."""

    serializer_class = SupplierSerializer
    pagination_class = PurchPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "phone"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]
    # No DELETE: parties are shared with CRM/ORDERS and referenced by PROTECT FKs —
    # deactivate (is_active=false) instead of destroying a shared row.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        perms = [PurchModule()]
        if self.action in ("create", "update", "partial_update"):
            perms.append(IsPurchaser())   # party rows are shared; only purchasers write
        return perms

    def get_queryset(self):
        qs = Party.objects.filter(kind__in=[Party.Kind.SUPPLIER, Party.Kind.BOTH])
        params = self.request.query_params
        if params.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=params["is_active"] == "true")
        return qs


class MaterialRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [PurchModule]
    serializer_class = MaterialRequestSerializer
    pagination_class = PurchPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = MaterialRequest.objects.prefetch_related("items", "items__item", "items__supplier")
        params = self.request.query_params
        status_filter = params.get("request_status") or params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if params.get("priority"):
            qs = qs.filter(priority=params["priority"])
        return qs

    def create(self, request, *args, **kwargs):
        mr = services.create_material_request(
            items=request.data.get("items", []),
            required_date=request.data.get("required_date") or None,
            purpose=request.data.get("purpose", ""),
            priority=request.data.get("priority", "medium"),
            created_by=request.user,
        )
        return Response(MaterialRequestSerializer(mr).data, status=201)

    def partial_update(self, request, *args, **kwargs):
        # A submitted/approved/rejected request is part of the approval trail —
        # editing it after the fact would be a bait-and-switch.
        if self.get_object().status != MaterialRequest.Status.DRAFT:
            return Response({"detail": "Only a draft material request can be edited."}, status=400)
        return super().partial_update(request, *args, **kwargs)

    def _transition(self, request, target, reason=""):
        mr = services.set_mr_status(self.get_object(), target, reason=reason)
        return Response(MaterialRequestSerializer(mr).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._transition(request, MaterialRequest.Status.SUBMITTED)

    @action(detail=True, methods=["post"], permission_classes=[PurchModule, IsPurchaser])
    def approve(self, request, pk=None):
        return self._transition(request, MaterialRequest.Status.APPROVED)

    @action(detail=True, methods=["post"], permission_classes=[PurchModule, IsPurchaser])
    def reject(self, request, pk=None):
        reason = request.data.get("reason", "")
        if not reason:
            return Response({"detail": "A rejection reason is required."}, status=400)
        return self._transition(request, MaterialRequest.Status.REJECTED, reason=reason)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseOrderSerializer
    pagination_class = PurchPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        perms = [PurchModule()]
        if self.action in ("create", "update", "partial_update"):
            perms.append(IsPurchaser())   # PATCH was previously ungated
        return perms

    def partial_update(self, request, *args, **kwargs):
        po = self.get_object()
        if po.status != PurchaseOrder.Status.DRAFT:
            return Response({"detail": "Only a draft purchase order can be edited."}, status=400)
        return super().partial_update(request, *args, **kwargs)

    def get_queryset(self):
        qs = PurchaseOrder.objects.select_related("supplier").prefetch_related("items")
        params = self.request.query_params
        for field in ("status", "receipt_status", "payment_status"):
            if params.get(field):
                qs = qs.filter(**{field: params[field]})
        if params.get("supplier"):
            qs = qs.filter(supplier_id=params["supplier"])
        return qs

    def create(self, request, *args, **kwargs):
        if not _is_purchaser(request.user):
            return Response({"detail": "Purchase access required."}, status=403)
        data = request.data
        mr = None
        if data.get("material_request"):
            mr = MaterialRequest.objects.filter(pk=data["material_request"]).first()
        po = services.create_purchase_order(
            supplier_id=data.get("supplier"),
            order_date=data.get("order_date"),
            delivery_date=data.get("delivery_date") or None,
            items=data.get("items", []),
            material_request=mr,
            notes=data.get("notes", ""),
            payment_terms=data.get("payment_terms", ""),
        )
        return Response(PurchaseOrderSerializer(po).data, status=201)

    @action(detail=True, methods=["post"], permission_classes=[PurchModule, IsPurchaser])
    def approve(self, request, pk=None):
        po = services.set_po_status(self.get_object(), PurchaseOrder.Status.APPROVED)
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=["post"], permission_classes=[PurchModule, IsPurchaser])
    def send(self, request, pk=None):
        po = services.set_po_status(self.get_object(), PurchaseOrder.Status.SENT)
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=["post"], url_path="close", permission_classes=[PurchModule, IsPurchaser])
    def close_order(self, request, pk=None):
        po = services.set_po_status(self.get_object(), PurchaseOrder.Status.CLOSED)
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=["post"], url_path="receive", permission_classes=[PurchModule, IsPurchaser])
    def receive(self, request, pk=None):
        """Record a GRN. Hands the accepted quantities to INV via an event."""
        grn = services.receive_goods(
            self.get_object(),
            lines=request.data.get("items", []),
            receipt_date=request.data.get("receipt_date") or None,
            warehouse_id=request.data.get("warehouse") or request.data.get("warehouse_id") or None,
            notes=request.data.get("notes", ""),
        )
        return Response(GoodsReceiptSerializer(grn).data, status=201)

    @action(detail=True, methods=["post"], url_path="bill", permission_classes=[PurchModule, IsPurchaser])
    def bill(self, request, pk=None):
        """Book the supplier's invoice for this PO. BOOKS posts it to the ledger."""
        po = self.get_object()
        bill = services.create_bill(
            supplier_id=po.supplier_id,
            purchase_order=po,
            invoice_date=request.data.get("invoice_date") or po.order_date,
            due_date=request.data.get("due_date") or None,
            supplier_invoice_no=request.data.get("supplier_invoice_no", ""),
        )
        return Response(PurchaseBillSerializer(bill).data, status=201)


class GoodsReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [PurchModule]
    serializer_class = GoodsReceiptSerializer
    pagination_class = PurchPagination

    def get_queryset(self):
        qs = GoodsReceipt.objects.select_related("supplier", "purchase_order").prefetch_related("items")
        params = self.request.query_params
        if params.get("purchase_order"):
            qs = qs.filter(purchase_order_id=params["purchase_order"])
        return qs


class PurchaseBillViewSet(viewsets.ModelViewSet):
    permission_classes = [PurchModule]
    serializer_class = PurchaseBillSerializer
    pagination_class = PurchPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = PurchaseBill.objects.select_related("supplier", "purchase_order").prefetch_related("payments")
        params = self.request.query_params
        status_filter = params.get("payment_status") or params.get("status")
        if status_filter:
            qs = qs.filter(status__in=[s.strip() for s in status_filter.split(",") if s.strip()])
        if params.get("supplier"):
            qs = qs.filter(supplier_id=params["supplier"])
        return qs

    def create(self, request, *args, **kwargs):
        if not _is_purchaser(request.user):
            return Response({"detail": "Purchase access required."}, status=403)
        data = request.data
        po = PurchaseOrder.objects.filter(pk=data["purchase_order"]).first() if data.get("purchase_order") else None
        bill = services.create_bill(
            supplier_id=data.get("supplier"),
            purchase_order=po,
            invoice_date=data.get("invoice_date"),
            due_date=data.get("due_date") or None,
            supplier_invoice_no=data.get("supplier_invoice_no", ""),
            items=data.get("items"),
            subtotal=data.get("subtotal"),
            tax_amount=data.get("tax_amount"),
        )
        return Response(PurchaseBillSerializer(bill).data, status=201)

    @action(detail=True, methods=["post"], url_path="record-payment",
            permission_classes=[PurchModule, IsPurchaser])
    def record_payment(self, request, pk=None):
        amount = request.data.get("amount")
        if amount is None:
            return Response({"detail": "amount required."}, status=400)
        services.record_bill_payment(
            self.get_object(), amount=amount,
            mode=request.data.get("mode", "bank"), reference=request.data.get("reference", ""),
        )
        return Response(PurchaseBillSerializer(self.get_object()).data)
