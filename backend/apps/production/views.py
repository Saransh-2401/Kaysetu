"""PROD API — Production. Gated by HasModule('PROD'). /api/t/prod/."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.foundation.permissions import HasModule

from . import services
from .models import BillOfMaterials, WorkOrder
from .serializers import BillOfMaterialsSerializer, WorkOrderSerializer

ProdModule = HasModule("PROD")
MANAGER_ROLES = {"admin", "production_manager"}


def _is_production_manager(user) -> bool:
    return bool(user and (user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)))


class IsProductionManager(BasePermission):
    message = "Production access required."

    def has_permission(self, request, view):
        return _is_production_manager(request.user)


class ProdPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 2000


class BOMViewSet(viewsets.ModelViewSet):
    serializer_class = BillOfMaterialsSerializer
    pagination_class = ProdPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    WRITE_ACTIONS = {"create", "update", "partial_update"}

    def get_permissions(self):
        if self.action in self.WRITE_ACTIONS:
            return [ProdModule(), IsProductionManager()]
        return [ProdModule()]

    def get_queryset(self):
        qs = BillOfMaterials.objects.select_related("item").prefetch_related("materials")
        params = self.request.query_params
        if params.get("item"):
            qs = qs.filter(item_id=params["item"])
        if params.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=params["is_active"] == "true")
        return qs

    def create(self, request, *args, **kwargs):
        bom = services.create_bom(
            item_id=request.data.get("item"),
            materials=request.data.get("materials", []),
            output_quantity=request.data.get("output_quantity", 1),
            notes=request.data.get("notes", ""),
        )
        return Response(BillOfMaterialsSerializer(bom).data, status=201)


class WorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer
    pagination_class = ProdPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    MANAGER_ACTIONS = {"create", "update", "partial_update", "release", "start",
                       "complete", "cancel"}

    def get_permissions(self):
        if self.action in self.MANAGER_ACTIONS:
            return [ProdModule(), IsProductionManager()]
        return [ProdModule()]

    def get_queryset(self):
        qs = (WorkOrder.objects.select_related("item", "bom")
              .prefetch_related("materials", "materials__raw_material"))
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in params["status"].split(",") if s.strip()])
        if params.get("item"):
            qs = qs.filter(item_id=params["item"])
        return qs

    def _fresh(self):
        # re-read: services rewrite the material rows, which the prefetch cache
        # on the object from get_object() would otherwise serialise stale.
        return Response(WorkOrderSerializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        bom = BillOfMaterials.objects.filter(pk=request.data.get("bom")).first()
        if bom is None:
            return Response({"detail": "A valid bom is required."}, status=400)
        order = services.create_work_order(
            bom=bom,
            planned_quantity=request.data.get("planned_quantity"),
            start_date=request.data.get("start_date") or None,
            end_date=request.data.get("end_date") or None,
            warehouse_id=request.data.get("warehouse") or request.data.get("warehouse_id") or None,
            notes=request.data.get("notes", ""),
        )
        return Response(WorkOrderSerializer(order).data, status=201)

    @action(detail=True, methods=["post"])
    def release(self, request, pk=None):
        services.release_order(self.get_object())
        return self._fresh()

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        services.start_order(self.get_object())
        return self._fresh()

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        services.cancel_order(self.get_object())
        return self._fresh()

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        services.complete_order(
            self.get_object(),
            produced_quantity=request.data.get("produced_quantity"),
            consumption=request.data.get("consumption"),
        )
        return self._fresh()
