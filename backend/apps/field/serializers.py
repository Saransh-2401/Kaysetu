from rest_framework import serializers

from apps.foundation.models import TenantUser

from .models import (
    Collection, FieldOrder, FieldOrderItem, SalesCityTarget, SalesTarget, Visit, VisitImage,
)


class VisitImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisitImage
        fields = ["id", "image_url", "image_type", "created_at"]


class VisitSerializer(serializers.ModelSerializer):
    agent = serializers.PrimaryKeyRelatedField(
        queryset=TenantUser.objects.all(), required=False,
    )  # defaults to the caller in the view; managers may assign
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    party_name = serializers.CharField(source="party.name", read_only=True, default=None)
    # Portal-compat aliases (the ported visits screen reads customer_name / customer{}).
    customer_name = serializers.CharField(source="party.name", read_only=True, default=None)
    customer = serializers.SerializerMethodField()
    images = VisitImageSerializer(many=True, read_only=True)

    def get_customer(self, obj):
        if obj.party_id is None:
            return None
        return {"id": obj.party_id, "customer_name": obj.party.name}

    class Meta:
        model = Visit
        fields = [
            "id", "agent", "agent_name", "party", "party_name", "customer", "customer_name",
            "visit_date", "scheduled_time",
            "actual_checkin_time", "actual_checkout_time", "checkin_location", "checkout_location",
            "gps_verified", "visit_type", "purpose", "notes", "checkout_notes", "outcome",
            "transport_mode", "distance_km", "status", "skip_reason", "reschedule_reason",
            "rescheduled_to", "rescheduled_time", "checkin_selfie", "voice_note_url",
            "client_uuid", "images", "created_at",
        ]
        read_only_fields = [
            "actual_checkin_time", "actual_checkout_time", "gps_verified", "status", "created_at",
        ]


class SalesCityTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesCityTarget
        fields = [
            "id", "city", "visit_target", "order_target", "stock_request_target",
            "revenue_target", "stock_request_revenue_target", "new_client_target", "login_hours_target",
        ]


class SalesTargetSerializer(serializers.ModelSerializer):
    city_targets = SalesCityTargetSerializer(many=True, read_only=True)

    class Meta:
        model = SalesTarget
        fields = [
            "id", "agent", "month", "year", "is_default",
            "visit_target", "order_target", "stock_request_target", "revenue_target",
            "stock_request_revenue_target", "new_client_target", "login_hours_target",
            "pincodes", "city_targets", "created_at",
        ]


class FieldOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FieldOrderItem
        fields = ["id", "item", "item_name", "quantity", "rate", "tax_rate", "amount"]


class FieldOrderSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    party_name = serializers.CharField(source="party.name", read_only=True)
    items = FieldOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = FieldOrder
        fields = [
            "id", "order_number", "agent", "agent_name", "party", "party_name", "order_date",
            "status", "subtotal", "tax_amount", "total", "notes", "items", "created_at",
        ]
        read_only_fields = ["order_number", "subtotal", "tax_amount", "total", "created_at"]


class CollectionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    party_name = serializers.CharField(source="party.name", read_only=True)

    class Meta:
        model = Collection
        fields = [
            "id", "agent", "agent_name", "party", "party_name", "amount", "mode",
            "reference", "against_invoice", "collected_at",
        ]
        read_only_fields = ["collected_at"]
