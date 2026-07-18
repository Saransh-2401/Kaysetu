from rest_framework import serializers

from .models import (
    DistributorAdjustment,
    DistributorInvoice,
    DistributorStock,
    StockRequest,
    StockRequestItem,
    StockRequestLog,
    StockRequestShortage,
)


class StockRequestShortageSerializer(serializers.ModelSerializer):
    distributor = serializers.IntegerField(source="request.distributor_id", read_only=True)
    distributor_name = serializers.CharField(source="request.distributor.name", read_only=True)
    request_number = serializers.CharField(source="request.number", read_only=True)
    stock_request = serializers.IntegerField(source="request_id", read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = StockRequestShortage
        fields = ["id", "request", "stock_request", "request_number", "distributor",
                  "distributor_name", "item", "item_name", "shortage_quantity",
                  "unit_price", "total_price", "status", "payment_status",
                  "production_plan_id", "invoice", "notes", "created_at", "updated_at"]
        read_only_fields = ["request", "item", "shortage_quantity", "unit_price",
                            "status", "created_at", "updated_at"]

    def get_total_price(self, obj):
        return float(obj.total_price)


class DistributorAdjustmentSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source="distributor.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True,
                                            allow_null=True)

    class Meta:
        model = DistributorAdjustment
        fields = ["id", "distributor", "distributor_name", "item", "item_name", "quantity",
                  "reason", "balance_after", "notes", "created_by", "created_by_name",
                  "created_at"]
        read_only_fields = ["item_name", "balance_after", "created_by", "created_at"]


class DistributorStockSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    distributor_name = serializers.CharField(source="distributor.name", read_only=True)
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = DistributorStock
        fields = ["id", "distributor", "distributor_name", "item", "item_name",
                  "on_hand", "low_stock_threshold", "is_low", "updated_at"]


class StockRequestItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockRequestItem
        fields = ["id", "item", "item_name", "requested_quantity", "approved_quantity",
                  "shortage_quantity", "unit_price", "total_price"]


class StockRequestLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", read_only=True, allow_null=True)

    class Meta:
        model = StockRequestLog
        fields = ["id", "from_status", "to_status", "note", "actor", "actor_name", "at"]


class StockRequestSerializer(serializers.ModelSerializer):
    items = StockRequestItemSerializer(many=True, read_only=True)
    logs = StockRequestLogSerializer(many=True, read_only=True)
    request_number = serializers.CharField(source="number", read_only=True)   # portal alias
    distributor_name = serializers.CharField(source="distributor.name", read_only=True)
    outstanding_amount = serializers.SerializerMethodField()

    class Meta:
        model = StockRequest
        fields = ["id", "number", "request_number", "distributor", "distributor_name",
                  "requested_at", "status", "payment_status", "total_amount", "amount_paid",
                  "outstanding_amount", "has_shortage", "reject_reason", "notes",
                  "approved_by", "items", "logs", "updated_at"]
        read_only_fields = ["number", "status", "payment_status", "total_amount",
                            "amount_paid", "has_shortage", "reject_reason", "approved_by",
                            "distributor", "requested_at", "updated_at"]

    def get_outstanding_amount(self, obj):
        return float((obj.total_amount or 0) - (obj.amount_paid or 0))


class DistributorInvoiceSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="number", read_only=True)      # portal alias
    request_number = serializers.CharField(source="request.number", read_only=True)
    distributor_name = serializers.CharField(source="distributor.name", read_only=True)
    payment_status = serializers.CharField(source="status", read_only=True)      # portal alias
    stock_request = serializers.IntegerField(source="request_id", read_only=True)
    outstanding_amount = serializers.SerializerMethodField()

    class Meta:
        model = DistributorInvoice
        fields = ["id", "number", "invoice_number", "request", "stock_request", "request_number",
                  "distributor", "distributor_name", "invoice_date", "due_date",
                  "total_amount", "paid_amount", "outstanding_amount", "status",
                  "payment_status", "payment_reference", "created_at"]

    def get_outstanding_amount(self, obj):
        return float((obj.total_amount or 0) - (obj.paid_amount or 0))
