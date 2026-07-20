from rest_framework import serializers

from .models import Lead, LeadActivity, Quotation, QuotationItem


class LeadActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadActivity
        fields = ["id", "action", "detail", "actor_name", "at"]


class LeadSerializer(serializers.ModelSerializer):
    # Identity denormalised from the backing Party (portal reads these flat).
    name = serializers.CharField(source="party.name", read_only=True, default="")
    phone = serializers.CharField(source="party.phone", read_only=True, default="")
    email = serializers.CharField(source="party.email", read_only=True, default="")
    city = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    party_id = serializers.IntegerField(read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True, default=None)
    sales_manager_name = serializers.CharField(
        source="assigned_to.reports_to.full_name", read_only=True, default=None
    )
    activities = LeadActivitySerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id", "party_id", "name", "phone", "email", "city", "address", "latitude", "longitude",
            "company_name", "source", "status", "industry", "territory", "employee_count",
            "notes", "follow_up_date", "converted_at", "assigned_to", "assigned_to_name",
            "sales_manager_name", "activities", "created_at",
        ]
        read_only_fields = ["status", "converted_at", "created_at"]

    def _addr(self, obj):
        return (obj.party.address if obj.party else {}) or {}

    def get_city(self, obj):
        return self._addr(obj).get("city", "")

    def get_address(self, obj):
        a = self._addr(obj)
        parts = [a.get(k) for k in ("line1", "line2", "city", "state", "postal_code")]
        return ", ".join(str(p) for p in parts if p)

    def get_latitude(self, obj):
        return self._addr(obj).get("latitude")

    def get_longitude(self, obj):
        return self._addr(obj).get("longitude")


class QuotationItemSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True, default="")

    class Meta:
        model = QuotationItem
        fields = ["id", "item", "item_name", "item_code", "description",
                  "quantity", "rate", "tax_rate", "amount", "tax_amount"]
        read_only_fields = ["amount", "tax_amount"]


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)
    # Portal aliases — the ported screen speaks "quotation_number"/"customer".
    quotation_number = serializers.CharField(source="number", read_only=True)
    customer = serializers.IntegerField(source="party_id", read_only=True)
    customer_name = serializers.CharField(source="party.name", read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True, default="")
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Quotation
        fields = ["id", "number", "quotation_number", "party", "customer", "customer_name",
                  "lead", "quotation_date", "valid_until", "currency",
                  "subtotal", "tax_amount", "total", "status", "lost_reason", "is_expired",
                  "terms_and_conditions", "notes", "owner", "owner_name", "items",
                  "created_at", "updated_at"]
        # Money is derived from the lines; status moves through its own actions.
        read_only_fields = ["number", "subtotal", "tax_amount", "total", "status",
                            "lost_reason", "created_at", "updated_at"]
