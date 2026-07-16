from rest_framework import serializers

from .models import CatalogItem, OrgSettings, Party, Role, TenantUser


class OrgSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgSettings
        fields = [
            "company_name", "legal_name", "gstin", "industry", "logo_url",
            "fy_start_month", "labels", "numbering", "working_hours",
            "appearance", "setup_state", "updated_at",
        ]
        read_only_fields = ["updated_at"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "slug", "is_system", "permissions"]
        read_only_fields = ["is_system"]


class TenantUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=False)
    role_slug = serializers.SlugRelatedField(
        source="role", slug_field="slug", queryset=Role.objects.all(), required=False, allow_null=True
    )
    aadhaar_number = serializers.RegexField(
        r"^\d{12}$", required=False, allow_blank=True,
        error_messages={"invalid": "Aadhaar number must be exactly 12 digits."},
    )
    pan_number = serializers.RegexField(
        r"^[A-Z]{5}[0-9]{4}[A-Z]$", required=False, allow_blank=True,
        error_messages={"invalid": "PAN must look like ABCDE1234F."},
    )
    gst_number = serializers.RegexField(
        r"^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}$", required=False, allow_blank=True,
        error_messages={"invalid": "Enter a valid 15-character GSTIN."},
    )

    class Meta:
        model = TenantUser
        fields = [
            "id", "email", "phone", "full_name", "role_slug", "is_owner", "is_active",
            "profile_image", "aadhaar_card", "aadhaar_number", "pan_card", "pan_number",
            "address_line1", "address_line2", "city", "state", "postal_code", "country",
            "full_address", "business_name", "gst_number", "shipping_address",
            "latitude", "longitude", "home_latitude", "home_longitude",
            "last_login", "last_seen", "created_at",
            "password", "password_confirm",
        ]
        read_only_fields = ["is_owner", "last_login", "last_seen", "created_at"]

    def validate(self, data):
        password = data.get("password")
        confirm = data.pop("password_confirm", None)
        if password:
            if confirm is not None and password != confirm:
                raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
            from django.contrib.auth.password_validation import validate_password
            from django.core.exceptions import ValidationError as DjangoValidationError

            try:
                validate_password(password)
            except DjangoValidationError as error:
                raise serializers.ValidationError({"password": list(error.messages)})
        return data

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = TenantUser(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CatalogItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogItem
        fields = [
            "id", "name", "code", "kind", "unit", "price", "tax_rate",
            "hsn_sac", "is_active", "extra", "created_at", "updated_at",
        ]


class PartySerializer(serializers.ModelSerializer):
    # Portal-compat aliases so the ported /my-customers screen renders unchanged.
    customer_name = serializers.CharField(source="name", read_only=True)
    formatted_address = serializers.SerializerMethodField()
    assigned_agent_name = serializers.CharField(source="assigned_agent.full_name", read_only=True, default=None)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Party
        fields = [
            "id", "name", "customer_name", "kind", "phone", "email", "gstin", "address",
            "formatted_address", "credit_limit", "assigned_agent", "assigned_agent_name",
            "latitude", "longitude", "is_active", "extra", "created_at", "updated_at",
        ]

    def get_formatted_address(self, obj):
        a = obj.address or {}
        parts = [a.get(k) for k in ("line1", "line2", "city", "state", "postal_code")]
        return ", ".join(p for p in parts if p)

    def get_latitude(self, obj):
        return (obj.address or {}).get("latitude")

    def get_longitude(self, obj):
        return (obj.address or {}).get("longitude")
