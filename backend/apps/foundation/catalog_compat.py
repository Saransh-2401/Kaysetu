"""
Warehouse-catalog compatibility.

The ported screens call `/warehouse/items/` and `/warehouse/products/` — the
previous platform kept two tables for what is one thing here (`CatalogItem`).
Rather than reshape the imported UI, both paths are served over CatalogItem, in
the shape those screens read.

Stock lives in INV, not here, so `quantity` is filled from the inventory
capability when the tenant has INV and is null otherwise — null meaning "not
tracked", which a screen can render differently from a real zero.
"""
from rest_framework import filters, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .integration import capabilities
from .models import CatalogItem
from .config_views import IsAdminOrReadOnly


def _stock_of(item_id):
    return capabilities.call("inventory.stock_of", item_id, default=None)


class WarehouseItemSerializer(serializers.ModelSerializer):
    # The old screens' vocabulary, mapped onto the one catalog row.
    item_name = serializers.CharField(source="name", max_length=200)
    item_code = serializers.CharField(source="code", required=False, allow_blank=True,
                                      max_length=64)
    product_name = serializers.CharField(source="name", read_only=True)
    sku = serializers.CharField(source="code", read_only=True)
    uom = serializers.CharField(source="unit", required=False, allow_blank=True, max_length=32)
    hsn_code = serializers.CharField(source="hsn_sac", required=False, allow_blank=True,
                                     max_length=16)
    selling_price = serializers.DecimalField(source="price", max_digits=12, decimal_places=2,
                                             required=False)
    quantity = serializers.SerializerMethodField()
    low_stock_threshold = serializers.SerializerMethodField()

    class Meta:
        model = CatalogItem
        fields = ["id", "item_name", "item_code", "product_name", "sku", "name", "code",
                  "kind", "uom", "unit", "hsn_code", "hsn_sac", "price", "selling_price",
                  "tax_rate", "is_active", "quantity", "low_stock_threshold",
                  "extra", "created_at"]
        # The canonical names are exposed for READING only. They are the same
        # columns as the aliases above, so leaving them writable would make
        # `name` a second required field alongside `item_name`.
        read_only_fields = ["name", "code", "unit", "hsn_sac", "price", "created_at"]

    def get_quantity(self, obj):
        # None (not 0) when INV isn't installed: a screen must be able to tell
        # "we don't track stock" apart from "we have none".
        return _stock_of(obj.pk)

    def get_low_stock_threshold(self, obj):
        return (obj.extra or {}).get("low_stock_threshold")


class WarehouseItemViewSet(viewsets.ModelViewSet):
    """Serves BOTH /warehouse/items/ and /warehouse/products/ — one catalog."""

    # Read is open to the whole tenant (order and invoice screens look items up
    # constantly); writing is admin-only for the same reason a tax slab is:
    # `selling_price` decides what every future order and invoice charges.
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = WarehouseItemSerializer
    # No DELETE: catalog rows are referenced by PROTECT FKs from orders,
    # purchase and production. Deactivate instead of destroying history.
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code", "hsn_sac"]
    ordering_fields = ["name", "price", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = CatalogItem.objects.all()
        params = self.request.query_params
        if params.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=params["is_active"] == "true")
        if params.get("status") == "active":
            qs = qs.filter(is_active=True)
        if params.get("kind"):
            qs = qs.filter(kind=params["kind"])
        return qs

    @action(detail=False, methods=["get"])
    def low_stock(self, request):
        """Items at or under their reorder level. Empty without INV — nothing
        can be known to be low when nothing is tracking stock."""
        rows = []
        for item in self.get_queryset():
            on_hand = _stock_of(item.pk)
            threshold = (item.extra or {}).get("low_stock_threshold")
            if on_hand is None or threshold is None:
                continue
            if float(on_hand) <= float(threshold):
                rows.append({**WarehouseItemSerializer(item).data, "on_hand": on_hand})
        return Response({"count": len(rows), "results": rows})

    @action(detail=True, methods=["post"], url_path="set-stock",
            permission_classes=[IsAdminOrReadOnly])
    def set_stock(self, request, pk=None):
        """Correct an item's counted stock. Delegated to INV via the capability
        registry — SALES/foundation never writes a stock row itself."""
        quantity = request.data.get("quantity")
        if quantity is None:
            return Response({"quantity": "required."}, status=400)
        result = capabilities.call(
            "inventory.set_stock", self.get_object().pk, quantity,
            note=request.data.get("note", "counted"), default=None,
        )
        if result is None:
            return Response(
                {"detail": "Stock is not tracked — the Inventory module is not enabled."},
                status=400)
        return Response({"item": self.get_object().pk, "on_hand": result})

    @action(detail=True, methods=["get"])
    def suppliers(self, request, pk=None):
        """Who has quoted this item. Answered by PURCH when installed; an empty
        list otherwise rather than a 404 the screen can't interpret."""
        rows = capabilities.call("purchase.suppliers_of", self.get_object().pk, default=None)
        return Response({"count": len(rows or []), "results": rows or []})

    @action(detail=False, methods=["get"])
    def categories(self, request):
        """The distinct categories in use — the item form's category dropdown.
        Categories live in `extra` (CatalogItem has no category column), so this
        is whatever the tenant has actually typed, as a plain string array."""
        seen = {(item.extra or {}).get("category") for item in self.get_queryset()}
        return Response(sorted(c for c in seen if c))

    @action(detail=False, methods=["get"])
    def uoms(self, request):
        """Units of measure for the item form. The UOM master when the tenant
        has curated one, otherwise the distinct units already on the catalog —
        so the dropdown is never empty and never 404s."""
        from .models import UOM

        names = list(UOM.objects.filter(is_active=True).values_list("uom_name", flat=True))
        if not names:
            names = sorted({item.unit for item in self.get_queryset() if item.unit})
        return Response(names)
