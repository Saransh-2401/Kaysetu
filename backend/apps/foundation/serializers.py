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
    # The ported user list renders `role` (the display name) and `status`
    # (Active/Inactive). Without these it read undefined and crashed on
    # `.toUpperCase()` / `.includes()`.
    role = serializers.CharField(source="role.name", read_only=True, default="")
    status = serializers.SerializerMethodField()

    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"

    #: Identity documents and home address. Regulated personal data (Aadhaar
    #: especially) that only an admin — or the person themselves — may see.
    KYC_FIELDS = (
        "aadhaar_number", "aadhaar_card", "pan_number", "pan_card", "gst_number",
        "home_latitude", "home_longitude",
    )

    def to_representation(self, instance):
        """Redact colleagues' KYC for anyone who is not a tenant admin.

        The user list is not admin-only — pickers all over the portal read it for
        names and roles — so every field on it is visible to every user in the
        tenant. Without this, one field agent could harvest the Aadhaar and PAN
        of the entire company from a single GET.
        """
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user is None:
            return data
        role = getattr(user, "role", None)
        is_admin = bool(getattr(user, "is_owner", False) or (role is not None and role.slug == "admin"))
        if is_admin or getattr(user, "pk", None) == instance.pk:
            return data
        for field in self.KYC_FIELDS:
            if field in data:
                data[field] = None
        return data

    class Meta:
        model = TenantUser
        fields = [
            "id", "email", "phone", "full_name", "role", "role_slug", "status",
            "is_owner", "is_active",
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
    distributor_name = serializers.CharField(source="distributor.name", read_only=True, default=None)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Party
        fields = [
            "id", "name", "customer_name", "kind", "phone", "email", "gstin", "address",
            "formatted_address", "credit_limit", "assigned_agent", "assigned_agent_name",
            "distributor", "distributor_name",
            "latitude", "longitude", "is_active", "extra", "created_at", "updated_at",
        ]

    def validate_distributor(self, value):
        """Only a distributor-flagged party may serve a retailer.

        Without this any customer could be set as another's distributor, which
        silently corrupts every primary-vs-secondary figure downstream — the
        numbers would still add up, just against the wrong party.
        """
        if value is None:
            return value
        if self.instance is not None and value.pk == self.instance.pk:
            raise serializers.ValidationError("A party cannot be its own distributor.")
        if not (value.extra or {}).get("is_distributor"):
            raise serializers.ValidationError(
                f"'{value.name}' is not a distributor. Mark it as one first.")
        return value

    def get_formatted_address(self, obj):
        a = obj.address or {}
        parts = [a.get(k) for k in ("line1", "line2", "city", "state", "postal_code")]
        return ", ".join(p for p in parts if p)

    def get_latitude(self, obj):
        return (obj.address or {}).get("latitude")

    def get_longitude(self, obj):
        return (obj.address or {}).get("longitude")
