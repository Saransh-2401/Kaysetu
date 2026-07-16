from rest_framework import serializers

from .models import StockLedger, StockLevel, Warehouse


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "name", "code", "address", "is_default", "is_active", "created_at"]


class StockLevelSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    available = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = StockLevel
        fields = [
            "id", "item", "item_name", "warehouse", "warehouse_name",
            "on_hand", "reserved", "available", "reorder_level", "low_stock", "updated_at",
        ]

    def get_low_stock(self, obj):
        return obj.on_hand <= obj.reorder_level


class StockLedgerSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    # --- Old-Project stock-ledger screen compatibility aliases (read-only) ---
    # The imported portal ledger page reads these legacy field names; expose them
    # over the canonical model so the screen renders unchanged.
    transaction_date = serializers.DateTimeField(source="at", read_only=True)
    voucher_type = serializers.CharField(source="movement", read_only=True)
    voucher_no = serializers.CharField(source="reference", read_only=True)
    balance_qty = serializers.DecimalField(source="balance_after", max_digits=14, decimal_places=3, read_only=True)
    product_name = serializers.SerializerMethodField()
    uom = serializers.SerializerMethodField()
    stock_value = serializers.SerializerMethodField()

    class Meta:
        model = StockLedger
        fields = [
            "id", "item", "item_name", "warehouse", "warehouse_name", "movement",
            "quantity", "balance_after", "valuation_rate", "reference", "note", "at",
            # legacy aliases:
            "transaction_date", "voucher_type", "voucher_no", "balance_qty",
            "product_name", "uom", "stock_value",
        ]

    def get_product_name(self, obj):
        return None  # catalog is unified (foundation.CatalogItem) -> item_name carries it

    def get_uom(self, obj):
        return getattr(obj.item, "unit", "") or ""

    def get_stock_value(self, obj):
        return float(obj.balance_after) * float(obj.valuation_rate)
