from rest_framework import serializers

from .models import DeliveryNote, Invoice, PickList, SalesOrder, SalesOrderItem, StatusLog


class SalesOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesOrderItem
        fields = ["id", "item", "item_name", "quantity", "rate", "tax_rate", "amount"]


class StatusLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusLog
        fields = ["id", "from_status", "to_status", "actor_name", "note", "at"]


class SalesOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    assigned_agent_name = serializers.CharField(source="assigned_agent.full_name", read_only=True, default=None)
    # Portal-compat: the ported sales-orders screen reads `fulfillment_status`.
    fulfillment_status = serializers.CharField(source="status", read_only=True)
    items = SalesOrderItemSerializer(many=True, read_only=True)
    status_logs = StatusLogSerializer(many=True, read_only=True)

    class Meta:
        model = SalesOrder
        fields = [
            "id", "order_number", "customer", "customer_name", "assigned_agent", "assigned_agent_name",
            "order_date", "source", "field_order_id", "currency", "subtotal", "tax_amount",
            "discount_amount", "round_off", "total", "advance_amount", "amount_paid",
            "billing_address", "shipping_address", "status", "fulfillment_status", "payment_status",
            "notes", "items", "status_logs", "created_at",
        ]
        read_only_fields = [
            "order_number", "source", "field_order_id", "subtotal", "tax_amount", "total",
            "amount_paid", "status", "payment_status", "created_at",
        ]


class PickListSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = PickList
        fields = ["id", "order", "order_number", "picker", "status", "created_at"]


class DeliveryNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryNote
        fields = [
            "id", "order", "note_number", "transporter", "vehicle_number",
            "driver_name", "driver_phone", "created_at",
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ["id", "order", "invoice_number", "invoice_date", "total", "created_at"]
