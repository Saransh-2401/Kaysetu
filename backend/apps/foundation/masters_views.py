"""
Masters — shared reference data (units of measure, GST slabs).

Platform-core: every tenant needs units and tax rates whatever they bought.
Reading is open to the whole tenant (invoice screens look rates up constantly);
writing is admin-only, because changing a tax slab changes what every future
invoice charges.
"""
from rest_framework import filters, serializers, viewsets

from .config_views import IsAdminOrReadOnly
from .models import UOM, TaxSlab


class UOMSerializer(serializers.ModelSerializer):
    class Meta:
        model = UOM
        fields = ["id", "uom_name", "symbol", "is_base_unit", "conversion_factor",
                  "is_active", "created_at", "updated_at"]


class TaxSlabSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxSlab
        fields = ["id", "name", "percentage", "hsn_codes", "description",
                  "is_active", "created_at", "updated_at"]

    def validate_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("A GST rate must be within 0..100.")
        return value

    def validate_hsn_codes(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("hsn_codes must be a list.")
        # Normalised so a lookup by HSN can't miss because of stray whitespace.
        return [str(code).strip() for code in value if str(code).strip()]


class _MasterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params
        if params.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=params["is_active"] == "true")
        return qs


class UOMViewSet(_MasterViewSet):
    serializer_class = UOMSerializer
    queryset = UOM.objects.all()
    search_fields = ["uom_name", "symbol"]
    ordering_fields = ["uom_name", "created_at"]
    ordering = ["uom_name"]


class TaxSlabViewSet(_MasterViewSet):
    serializer_class = TaxSlabSerializer
    queryset = TaxSlab.objects.all()
    search_fields = ["name", "description"]
    ordering_fields = ["name", "percentage", "created_at"]
    ordering = ["-percentage"]
