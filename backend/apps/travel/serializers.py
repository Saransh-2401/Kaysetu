from rest_framework import serializers

from .models import (
    AgentBankDetail,
    AllowanceClaim,
    AllowanceDocument,
    NotificationPreference,
    PolicyConfig,
    Trip,
)


class AgentBankDetailSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    masked_account_number = serializers.CharField(read_only=True)

    class Meta:
        model = AgentBankDetail
        fields = ["id", "agent", "agent_name", "account_holder_name", "account_number",
                  "masked_account_number", "ifsc_code", "bank_name", "upi_id", "updated_at"]
        read_only_fields = ["agent", "updated_at"]
        extra_kwargs = {"account_number": {"write_only": True}}   # only the mask is read back


class AllowanceDocumentSerializer(serializers.ModelSerializer):
    request = serializers.IntegerField(source="claim_id", read_only=True)   # portal alias
    file_url = serializers.SerializerMethodField()
    doc_type_display = serializers.CharField(source="get_doc_type_display", read_only=True)

    class Meta:
        model = AllowanceDocument
        fields = ["id", "claim", "request", "file_url", "file_name", "doc_type",
                  "doc_type_display", "created_at"]
        read_only_fields = ["claim", "file_name", "created_at"]

    def get_file_url(self, obj):
        # Media-service URL when uploaded there; otherwise the locally stored
        # file, absolutised — a relative path is unresolvable to the mobile app
        # and to the portal served from a different origin.
        from apps.foundation.media import media_url

        return obj.file_url or media_url(obj.file)


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["push_enabled", "email_enabled", "sms_enabled", "in_app_enabled",
                  "deadline_reminders", "unclaimed_reminders", "updated_at"]
        read_only_fields = ["updated_at"]


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
                  "source", "basis", "notes", "claim", "is_claimed", "created_at"]
        read_only_fields = ["agent", "source", "basis", "claim", "created_at"]


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
