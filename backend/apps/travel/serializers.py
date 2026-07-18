from rest_framework import serializers

from .models import AllowanceClaim, PolicyConfig, Trip


class PolicyConfigSerializer(serializers.ModelSerializer):
    # (city, vehicle_type) is unique_together, and DRF's UniqueTogetherValidator
    # makes every field in the constraint required — declare the default so an
    # organisation-wide policy can be created without naming a city.
    city = serializers.CharField(required=False, allow_blank=True, default="", max_length=100)

    class Meta:
        model = PolicyConfig
        fields = ["id", "city", "vehicle_type", "rate_per_km", "max_daily_limit",
                  "max_monthly_limit", "is_active", "created_at"]
        read_only_fields = ["created_at"]


class TripSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    is_claimed = serializers.BooleanField(read_only=True)

    class Meta:
        model = Trip
        fields = ["id", "agent", "agent_name", "date", "distance_km", "transport_mode",
                  "source", "notes", "claim", "is_claimed", "created_at"]
        read_only_fields = ["agent", "source", "claim", "created_at"]


class AllowanceClaimSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    trips = TripSerializer(many=True, read_only=True)
    request_no = serializers.CharField(source="number", read_only=True)

    class Meta:
        model = AllowanceClaim
        fields = ["id", "number", "request_no", "agent", "agent_name", "period_start",
                  "period_end", "total_distance_km", "system_amount", "approved_amount",
                  "status", "decision_note", "manager_approved_by", "finance_approved_by",
                  "paid_at", "payment_reference", "trips", "created_at", "updated_at"]
        read_only_fields = ["number", "agent", "total_distance_km", "system_amount",
                            "approved_amount", "status", "decision_note",
                            "manager_approved_by", "finance_approved_by", "paid_at",
                            "payment_reference", "created_at", "updated_at"]
