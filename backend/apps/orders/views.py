"""ORDERS API — Sales Orders & Dispatch. Gated by HasModule('ORDERS'). /api/t/orders/."""
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.foundation.permissions import HasModule

from . import services
from .models import DeliveryNote, PickList, SalesOrder
from .serializers import (
    DeliveryNoteSerializer, InvoiceSerializer, PickListSerializer, SalesOrderSerializer,
)

OrdersModule = HasModule("ORDERS")
MANAGER_ROLES = {"admin", "field_manager", "sales_manager", "dispatcher"}


def _is_manager(user) -> bool:
    return user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)


class SalesOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [OrdersModule]
    serializer_class = SalesOrderSerializer

    def get_queryset(self):
        qs = SalesOrder.objects.select_related("customer", "assigned_agent").prefetch_related("items", "status_logs")
        # Non-managers see only orders assigned to them (managers/admin see all).
        if not _is_manager(self.request.user):
            qs = qs.filter(assigned_agent_id=self.request.user.pk)
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("source"):
            qs = qs.filter(source=params["source"])
        if params.get("customer"):
            qs = qs.filter(customer_id=params["customer"])
        if params.get("payment_status"):
            qs = qs.filter(payment_status=params["payment_status"])
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        if not data.get("customer") or not data.get("items"):
            return Response({"detail": "customer and items are required."}, status=400)
        order = services.create_order(
            customer_id=data["customer"], order_date=data.get("order_date") or timezone.localdate(),
            items=data["items"], assigned_agent=request.user if not _is_manager(request.user) else None,
            notes=data.get("notes", ""), advance_amount=data.get("advance_amount", 0),
        )
        return Response(SalesOrderSerializer(order).data, status=201)

    def update(self, request, *args, **kwargs):
        denied = self._manager_only(request)
        return denied or super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._manager_only(request)
        return denied or super().destroy(request, *args, **kwargs)

    def _manager_only(self, request):
        return None if _is_manager(request.user) else Response({"detail": "Manager access required."}, status=403)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        denied = self._manager_only(request)
        if denied:
            return denied
        order = self.get_object()
        if order.status != SalesOrder.Status.PROCESSING:
            return Response({"detail": "Only a processing order can be confirmed."}, status=400)
        services.confirm_order(order, actor=request.user)
        return Response(SalesOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        denied = self._manager_only(request)
        if denied:
            return denied
        order = self.get_object()
        services._transition(order, SalesOrder.Status.REJECTED, request.user, request.data.get("reason", ""))
        return Response(SalesOrderSerializer(order).data)

    @action(detail=True, methods=["get"], url_path="stock-warnings")
    def stock_warnings(self, request, pk=None):
        return Response({"warnings": services.stock_warnings(self.get_object())})

    @action(detail=True, methods=["post"], url_path="pick-list")
    def pick_list(self, request, pk=None):
        denied = self._manager_only(request)
        if denied:
            return denied
        order = self.get_object()
        if order.status != SalesOrder.Status.CONFIRMED:
            return Response({"detail": "Only a confirmed order can have a pick list."}, status=400)
        pl = services.make_pick_list(order, picker=request.user)
        return Response(PickListSerializer(pl).data, status=201)

    @action(detail=True, methods=["post"], url_path="delivery-note")
    def delivery_note(self, request, pk=None):
        denied = self._manager_only(request)
        if denied:
            return denied
        data = request.data
        dn = services.make_delivery_note(
            self.get_object(), transporter=data.get("transporter", ""),
            vehicle_number=data.get("vehicle_number", ""), driver_name=data.get("driver_name", ""),
            driver_phone=data.get("driver_phone", ""),
        )
        return Response(DeliveryNoteSerializer(dn).data, status=201)

    @action(detail=True, methods=["post"], url_path="mark-delivered")
    def mark_delivered(self, request, pk=None):
        denied = self._manager_only(request)
        if denied:
            return denied
        services.mark_delivered(self.get_object(), actor=request.user)
        return Response(SalesOrderSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def invoice(self, request, pk=None):
        denied = self._manager_only(request)
        if denied:
            return denied
        inv = services.issue_invoice(self.get_object())
        return Response(InvoiceSerializer(inv).data, status=201)

    @action(detail=True, methods=["post"], url_path="record-payment")
    def record_payment(self, request, pk=None):
        denied = self._manager_only(request)
        if denied:
            return denied
        amount = request.data.get("amount")
        if amount is None:
            return Response({"detail": "amount required."}, status=400)
        services.record_payment(
            self.get_object(), amount=amount, mode=request.data.get("mode", "cash"),
            reference=request.data.get("reference", ""),
        )
        return Response(SalesOrderSerializer(self.get_object()).data)


class PickListViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [OrdersModule]
    serializer_class = PickListSerializer
    queryset = PickList.objects.select_related("order", "picker").all()

    @action(detail=True, methods=["post"], url_path="mark-picked")
    def mark_picked(self, request, pk=None):
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)
        pl = self.get_object()
        pl.status = PickList.Status.PICKED
        pl.save(update_fields=["status"])
        return Response(PickListSerializer(pl).data)


class DeliveryNoteViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [OrdersModule]
    serializer_class = DeliveryNoteSerializer
    queryset = DeliveryNote.objects.select_related("order").all()
