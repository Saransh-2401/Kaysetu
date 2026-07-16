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
    role_slug = serializers.SlugRelatedField(
        source="role", slug_field="slug", queryset=Role.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = TenantUser
        fields = [
            "id", "email", "phone", "full_name", "role_slug",
            "is_owner", "is_active", "last_login", "password",
        ]
        read_only_fields = ["is_owner", "last_login"]

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
    class Meta:
        model = Party
        fields = [
            "id", "name", "kind", "phone", "email", "gstin", "address",
            "credit_limit", "is_active", "extra", "created_at", "updated_at",
        ]
