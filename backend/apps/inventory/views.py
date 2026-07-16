"""INV API — Inventory & Warehouse. Gated by HasModule('INV'). /api/t/inv/."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.permissions import HasModule

from . import services
from .models import StockLedger, StockLevel, Warehouse
from .serializers import StockLedgerSerializer, StockLevelSerializer, WarehouseSerializer

InvModule = HasModule("INV")
MANAGER_ROLES = {"admin", "warehouse_manager", "field_manager"}


class InvLimitOffsetPagination(LimitOffsetPagination):
    """The imported portal read screens page with limit/offset; keep a default
    limit so a param-less request still returns a {count, results} envelope."""

    default_limit = 25
    max_limit = 200


# Portal ledger screen sorts by legacy field names -> map to real columns.
_LEDGER_ORDER_MAP = {
    "transaction_date": "at",
    "balance_qty": "balance_after",
    "voucher_no": "reference",
    "quantity": "quantity",
    "valuation_rate": "valuation_rate",
}


def _is_manager(user) -> bool:
    return user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)


class WarehouseViewSet(viewsets.ModelViewSet):
    permission_classes = [InvModule]
    serializer_class = WarehouseSerializer
    queryset = Warehouse.objects.all()


class StockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [InvModule]
    serializer_class = StockLevelSerializer
    pagination_class = InvLimitOffsetPagination

    def get_queryset(self):
        from django.db.models import F

        qs = StockLevel.objects.select_related("item", "warehouse")
        params = self.request.query_params
        if params.get("warehouse"):
            qs = qs.filter(warehouse_id=params["warehouse"])
        if params.get("item"):
            qs = qs.filter(item_id=params["item"])
        if params.get("low_stock") == "true":
            qs = qs.filter(on_hand__lte=F("reorder_level"))
        return qs


class StockLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [InvModule]
    serializer_class = StockLedgerSerializer
    pagination_class = InvLimitOffsetPagination

    def get_queryset(self):
        qs = StockLedger.objects.select_related("item", "warehouse")
        params = self.request.query_params
        if params.get("item"):
            qs = qs.filter(item_id=params["item"])
        if params.get("warehouse"):
            qs = qs.filter(warehouse_id=params["warehouse"])
        # accept both the canonical `movement` and the portal's `voucher_type`
        movement = params.get("movement") or params.get("voucher_type")
        if movement:
            qs = qs.filter(movement=movement)
        if params.get("search"):
            qs = qs.filter(item__name__icontains=params["search"])
        if params.get("from_date"):
            qs = qs.filter(at__date__gte=params["from_date"])
        if params.get("to_date"):
            qs = qs.filter(at__date__lte=params["to_date"])
        return qs.order_by(self._ordering())

    def _ordering(self):
        raw = (self.request.query_params.get("ordering") or "-transaction_date").strip()
        desc, key = raw.startswith("-"), raw.lstrip("-")
        col = _LEDGER_ORDER_MAP.get(key, "at")
        return ("-" if desc else "") + col

    @action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        """Minimal activity trace for the portal ledger row modal: the movement
        itself as a single timeline event plus its source reference."""
        row = self.get_object()
        return Response({
            "ledger": {
                "id": row.id,
                "voucher_type": row.movement,
                "voucher_no": row.reference,
                "transaction_date": row.at,
                "quantity": row.quantity,
                "balance_qty": row.balance_after,
                "valuation_rate": row.valuation_rate,
                "stock_value": float(row.balance_after) * float(row.valuation_rate),
                "item_name": row.item.name,
                "product_name": None,
                "warehouse_name": row.warehouse.name,
                "batch_no": "",
            },
            "source": {"type": row.movement, "number": row.reference, "found": bool(row.reference),
                       "label": row.get_movement_display()},
            "events": [{
                "timestamp": row.at,
                "title": row.get_movement_display(),
                "note": row.note or f"{row.get_movement_display()} of {abs(float(row.quantity))}",
                "actor": "",
            }],
        })


class StockOpsView(APIView):
    """Manager stock operations: receive / adjust / transfer."""

    permission_classes = [InvModule]

    def _guard(self, request):
        return _is_manager(request.user)

    def post(self, request, op):
        if not self._guard(request):
            return Response({"detail": "Manager access required."}, status=403)
        data = request.data
        item_id = data.get("item")
        if not item_id:
            return Response({"detail": "item required."}, status=400)
        try:
            if op == "receive":
                wh = self._warehouse(data)
                level = services.receive_stock(item_id, wh, data.get("quantity", 0),
                                               rate=data.get("rate", 0), reference=data.get("reference", ""))
                return Response(StockLevelSerializer(level).data)
            if op == "adjust":
                wh = self._warehouse(data)
                level = services.adjust_stock(item_id, wh, data.get("delta", 0), note=data.get("note", ""))
                return Response(StockLevelSerializer(level).data)
            if op == "transfer":
                from_wh = Warehouse.objects.get(pk=data["from_warehouse"])
                to_wh = Warehouse.objects.get(pk=data["to_warehouse"])
                services.transfer_stock(item_id, from_wh, to_wh, data.get("quantity", 0))
                return Response({"success": True})
        except (Warehouse.DoesNotExist, KeyError):
            return Response({"detail": "warehouse not found."}, status=400)
        except services.InsufficientStock as exc:
            # covers both invalid numeric input and would-go-negative transfers
            return Response({"detail": str(exc)}, status=400)
        return Response({"detail": "unknown op."}, status=404)

    def _warehouse(self, data):
        if data.get("warehouse"):
            return Warehouse.objects.get(pk=data["warehouse"])
        return services.default_warehouse()
