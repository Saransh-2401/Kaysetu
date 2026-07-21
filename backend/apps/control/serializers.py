from rest_framework import serializers

from .models import AppVersion, ModuleDef, Package, ProvisioningJob, Subscription, Tenant


class ModuleDefSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleDef
        fields = ["code", "name", "description", "sort_order"]


class PackagePublicSerializer(serializers.ModelSerializer):
    modules = serializers.SlugRelatedField(slug_field="code", many=True, read_only=True)

    class Meta:
        model = Package
        fields = [
            "code", "name", "tagline", "modules", "is_addon", "mobile_level",
            "base_price_monthly", "base_price_annual", "included_users",
            "per_user_price", "sort_order",
        ]


class PackageAdminSerializer(serializers.ModelSerializer):
    modules = serializers.SlugRelatedField(
        slug_field="code", many=True, queryset=ModuleDef.objects.all()
    )

    class Meta:
        model = Package
        fields = [
            "id", "code", "name", "tagline", "modules", "is_addon", "mobile_level",
            "base_price_monthly", "base_price_annual", "included_users",
            "per_user_price", "is_published", "sort_order", "created_at", "updated_at",
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    package_code = serializers.CharField(source="package.code", read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id", "package_code", "seats", "billing_cycle", "status",
            "started_at", "current_period_end",
        ]


class ProvisioningJobSerializer(serializers.ModelSerializer):
    tenant_id = serializers.IntegerField(read_only=True)
    tenant_org_code = serializers.CharField(source="tenant.org_code", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)

    class Meta:
        model = ProvisioningJob
        fields = [
            "id", "tenant_id", "tenant_org_code", "tenant_name",
            "job_type", "status", "attempts", "log", "created_at", "finished_at",
        ]


class TenantListSerializer(serializers.ModelSerializer):
    package_code = serializers.CharField(source="package.code", read_only=True, default=None)

    class Meta:
        model = Tenant
        fields = [
            "id", "org_code", "name", "slug", "industry", "status",
            "owner_name", "owner_email", "package_code", "trial_ends_at", "created_at",
        ]


class TenantDetailSerializer(TenantListSerializer):
    entitled_modules = serializers.SerializerMethodField()
    subscriptions = SubscriptionSerializer(many=True, read_only=True)
    jobs = ProvisioningJobSerializer(many=True, read_only=True)

    class Meta(TenantListSerializer.Meta):
        fields = TenantListSerializer.Meta.fields + [
            "owner_phone", "db_name", "entitled_modules", "subscriptions", "jobs",
        ]

    def get_entitled_modules(self, obj):
        return obj.entitled_modules()


class SignupSerializer(serializers.Serializer):
    company_name = serializers.CharField(max_length=200)
    owner_name = serializers.CharField(max_length=200)
    owner_email = serializers.EmailField()
    owner_phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    password = serializers.CharField(min_length=8, max_length=128)
    password_confirm = serializers.CharField(max_length=128)
    package_code = serializers.CharField(max_length=16)
    industry = serializers.ChoiceField(choices=Tenant.Industry.choices, default=Tenant.Industry.GENERIC)
    seats = serializers.IntegerField(required=False, min_value=1, default=None, allow_null=True)

    def validate_package_code(self, value):
        if not Package.objects.filter(code=value, is_published=True, is_addon=False).exists():
            raise serializers.ValidationError("Unknown or unpublished package.")
        return value

    def validate(self, data):
        if data["password"] != data.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            validate_password(data["password"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)})
        return data


class AppVersionSerializer(serializers.ModelSerializer):
    """SuperAdmin app-release CRUD. `download_url` is an alias of apk_url the
    marketing site + Flutter app read under that name."""

    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name",
                                             read_only=True, default="")
    download_url = serializers.CharField(source="apk_url", read_only=True)

    class Meta:
        model = AppVersion
        fields = ["id", "version", "version_code", "apk_url", "download_url",
                  "release_notes", "force_update", "is_active",
                  "uploaded_by", "uploaded_by_name", "created_at", "updated_at"]
        read_only_fields = ["uploaded_by", "created_at", "updated_at"]
