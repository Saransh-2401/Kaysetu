import logging

from django.conf import settings
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.foundation.auth import SCOPE_CONTROL, make_token_pair
from apps.foundation.permissions import IsControlAdmin
from apps.tenancy.provisioning import MODULE_ROLE_TEMPLATES, ProvisioningError, provision_tenant

from . import services
from .models import (
    AdminUser,
    ControlAuditLog,
    ModuleDef,
    Package,
    ProvisioningJob,
    Subscription,
    Tenant,
)
from .serializers import (
    ModuleDefSerializer,
    PackageAdminSerializer,
    PackagePublicSerializer,
    ProvisioningJobSerializer,
    SignupSerializer,
    TenantDetailSerializer,
    TenantListSerializer,
)

logger = logging.getLogger("kaysetu.control")


def _audit(request, action_name, entity="", entity_id="", before=None, after=None):
    ControlAuditLog.objects.create(
        actor=request.user if getattr(request.user, "pk", None) else None,
        action=action_name,
        entity=entity,
        entity_id=str(entity_id),
        before=before,
        after=after,
    )


class HealthView(APIView):
    """Liveness/readiness probe for Docker healthchecks and K8s."""

    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        from django.db import connection

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return Response({"status": "ok"})
        except Exception:
            return Response({"status": "degraded"}, status=503)


class PublicPackagesView(ListAPIView):
    """Pricing page data — rendered live on the marketing site."""

    permission_classes = [AllowAny]
    serializer_class = PackagePublicSerializer
    pagination_class = None
    queryset = (
        Package.objects.filter(is_published=True)
        .prefetch_related("modules")
        .order_by("sort_order", "code")
    )


class SignupView(APIView):
    """Self-serve enrollment: creates AND provisions the tenant. No seed scripts."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # `?wait=1` keeps the old synchronous behaviour, which the E2E tests and
        # seed scripts rely on. Real signups hand off and poll, because creating
        # a database and running every migration takes seconds and an HTTP
        # request held open that long looks broken.
        background = request.query_params.get("wait") not in ("1", "true")
        try:
            tenant = services.signup(background=background, **serializer.validated_data)
        except ProvisioningError:
            return Response(
                {
                    "detail": "Your workspace could not be prepared. Our team has been "
                    "notified — you will receive a mail when it is ready.",
                    "code": "provisioning_failed",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                "org_code": tenant.org_code,
                "status": tenant.status,
                "ready": tenant.status in Tenant.LOGIN_ALLOWED_STATUSES,
                "trial_ends_at": tenant.trial_ends_at,
                "portal_url": settings.PORTAL_BASE_URL,
                "login_email": tenant.owner_email,
                "status_url": f"/api/public/signup-status?org_code={tenant.org_code}",
            },
            status=status.HTTP_201_CREATED,
        )


class SignupStatusView(APIView):
    """Poll target while a workspace is being prepared.

    Deliberately says nothing about the tenant beyond whether it is ready — the
    caller is anonymous, and an org code is guessable.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def get(self, request):
        org_code = (request.query_params.get("org_code") or "").strip()
        if not org_code:
            return Response({"detail": "org_code is required."}, status=400)
        tenant = Tenant.objects.filter(org_code__iexact=org_code).first()
        if tenant is None:
            return Response({"detail": "Unknown organization code."}, status=404)
        ready = tenant.status in Tenant.LOGIN_ALLOWED_STATUSES
        body = {"org_code": tenant.org_code, "status": tenant.status, "ready": ready}
        if tenant.status == Tenant.Status.FAILED:
            body["detail"] = ("Your workspace could not be prepared. Our team has been "
                              "notified — you will receive a mail when it is ready.")
        return Response(body)


class AdminLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        user = AdminUser.objects.filter(email=email, is_active=True).first()
        if user is None or not user.check_password(password):
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(
            {
                **make_token_pair(sub=user.pk, scope=SCOPE_CONTROL),
                "user": {
                    "id": user.pk,
                    "email": user.email,
                    "full_name": user.full_name,
                    "admin_role": user.admin_role,
                },
            }
        )


class ModuleDefViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsControlAdmin]
    serializer_class = ModuleDefSerializer
    queryset = ModuleDef.objects.all()
    pagination_class = None


class PackageViewSet(viewsets.ModelViewSet):
    """SuperAdmin package composer (SA-6)."""

    permission_classes = [IsControlAdmin]
    serializer_class = PackageAdminSerializer
    queryset = Package.objects.all().prefetch_related("modules")

    def perform_update(self, serializer):
        before = PackageAdminSerializer(serializer.instance).data
        instance = serializer.save()
        _audit(self.request, "package.update", "Package", instance.pk,
               before=before, after=PackageAdminSerializer(instance).data)

    def perform_create(self, serializer):
        instance = serializer.save()
        _audit(self.request, "package.create", "Package", instance.pk,
               after=PackageAdminSerializer(instance).data)


class TenantViewSet(viewsets.ReadOnlyModelViewSet):
    """SuperAdmin tenants screen (SA-4) + lifecycle actions."""

    permission_classes = [IsControlAdmin]

    def get_queryset(self):
        qs = Tenant.objects.select_related("package").order_by("-created_at")
        search = self.request.query_params.get("search")
        if search:
            qs = (
                qs.filter(name__icontains=search)
                | qs.filter(org_code__icontains=search)
                | qs.filter(owner_email__icontains=search)
            )
        tenant_status = self.request.query_params.get("status")
        if tenant_status:
            qs = qs.filter(status=tenant_status)
        return qs

    def get_serializer_class(self):
        return TenantDetailSerializer if self.action == "retrieve" else TenantListSerializer

    def _set_status(self, request, tenant, new_status):
        before = tenant.status
        tenant.status = new_status
        tenant.save(update_fields=["status", "updated_at"])
        _audit(request, f"tenant.{new_status}", "Tenant", tenant.pk,
               before={"status": before}, after={"status": new_status})
        return Response(TenantDetailSerializer(tenant).data)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._set_status(request, self.get_object(), Tenant.Status.SUSPENDED)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        tenant = self.get_object()
        new_status = Tenant.Status.TRIAL if tenant.trial_ends_at and tenant.subscriptions.filter(
            status="trialing"
        ).exists() else Tenant.Status.ACTIVE
        return self._set_status(request, tenant, new_status)

    @action(detail=True, methods=["post"], url_path="set-modules")
    def set_modules(self, request, pk=None):
        """Manual entitlement override — the SA-4 'Entitlements' tab."""
        tenant = self.get_object()
        module_codes = request.data.get("modules")
        if not isinstance(module_codes, list):
            return Response({"detail": "Send {'modules': ['TRACK', ...]}"}, status=400)
        known = set(ModuleDef.objects.values_list("code", flat=True))
        unknown = [m for m in module_codes if m not in known]
        if unknown:
            return Response({"detail": f"Unknown modules: {', '.join(unknown)}"}, status=400)
        before = tenant.entitled_modules()
        modules = services.set_tenant_modules(tenant, module_codes)
        _audit(request, "tenant.set_modules", "Tenant", tenant.pk,
               before={"modules": before}, after={"modules": modules})
        return Response({"modules": modules})

    @action(detail=True, methods=["post"], url_path="retry-provisioning")
    def retry_provisioning(self, request, pk=None):
        """SA-5 Provisioning Monitor: re-run a failed provisioning (idempotent)."""
        tenant = self.get_object()
        job = tenant.jobs.filter(job_type=ProvisioningJob.Type.CREATE).first()
        try:
            job = provision_tenant(tenant, owner_password=None, job=job)
        except ProvisioningError:
            job = tenant.jobs.filter(job_type=ProvisioningJob.Type.CREATE).first()
        _audit(request, "tenant.retry_provisioning", "Tenant", tenant.pk)
        return Response(ProvisioningJobSerializer(job).data)


class StatsView(APIView):
    """SA-2 Command Center counters."""

    permission_classes = [IsControlAdmin]

    def get(self, request):
        now = timezone.now()
        week_ago = now - timezone.timedelta(days=7)
        by_status = dict(
            Tenant.objects.values_list("status").annotate(count=Count("id"))
        )
        mrr = (
            Subscription.objects.filter(status=Subscription.Status.ACTIVE)
            .aggregate(total=Sum("package__base_price_monthly"))["total"]
            or 0
        )
        return Response(
            {
                "tenants": {"total": Tenant.objects.count(), "by_status": by_status},
                "signups_this_week": Tenant.objects.filter(created_at__gte=week_ago).count(),
                "active_trials": by_status.get(Tenant.Status.TRIAL, 0),
                "trials_ending_7d": Tenant.objects.filter(
                    status=Tenant.Status.TRIAL,
                    trial_ends_at__lte=now + timezone.timedelta(days=7),
                ).count(),
                "provisioning": {
                    "failed": ProvisioningJob.objects.filter(status="failed").count(),
                    "running": ProvisioningJob.objects.filter(status="running").count(),
                },
                "mrr": str(mrr),
                "package_distribution": list(
                    Tenant.objects.exclude(package=None)
                    .values("package__code", "package__name")
                    .annotate(count=Count("id"))
                    .order_by("-count")
                ),
            }
        )


class ProvisioningJobViewSet(viewsets.ReadOnlyModelViewSet):
    """SA-5 Provisioning Monitor feed."""

    permission_classes = [IsControlAdmin]
    serializer_class = ProvisioningJobSerializer

    def get_queryset(self):
        qs = ProvisioningJob.objects.select_related("tenant").order_by("-created_at")
        job_status = self.request.query_params.get("status")
        if job_status:
            qs = qs.filter(status=job_status)
        return qs
