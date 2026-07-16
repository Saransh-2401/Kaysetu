from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.control.models import Tenant
from apps.tenancy.context import use_tenant

from .auth import SCOPE_TENANT, decode_token, make_token_pair, resolve_user
from .models import CatalogItem, EntitlementSnapshot, OrgSettings, Party, Role, TenantUser
from .permissions import HasModule, IsTenantUser, get_entitled_modules
from .serializers import CatalogItemSerializer, PartySerializer, RoleSerializer, TenantUserSerializer


def _org_payload(tenant, org: OrgSettings | None, modules: list[str]):
    return {
        "org_code": tenant.org_code,
        "name": org.company_name if org else tenant.name,
        "industry": tenant.industry,
        "labels": org.labels if org else {},
        "appearance": org.appearance if org else {},
        "setup_state": org.setup_state if org else {},
        "modules": modules,
        "status": tenant.status,
        "trial_ends_at": tenant.trial_ends_at,
    }


class TenantLoginView(APIView):
    """POST {org_code, email, password} -> tokens + user + org context."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        org_code = (request.data.get("org_code") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        if not org_code or not email or not password:
            return Response({"detail": "org_code, email and password are required."}, status=400)

        tenant = Tenant.objects.filter(org_code__iexact=org_code).first()
        if tenant is None:
            return Response({"detail": "Invalid organization code."}, status=status.HTTP_401_UNAUTHORIZED)
        if not tenant.can_login():
            return Response(
                {"detail": f"This organization is {tenant.status}.", "code": f"tenant_{tenant.status}"},
                status=status.HTTP_403_FORBIDDEN,
            )

        with use_tenant(tenant):
            user = TenantUser.objects.filter(email=email, is_active=True).first()
            if user is None or not user.check_password(password):
                return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
            user.last_login = timezone.now()
            user.save(update_fields=["last_login", "updated_at"])

            org = OrgSettings.objects.filter(pk=1).first()
            modules = EntitlementSnapshot.current_modules()
            role = user.role

        return Response(
            {
                **make_token_pair(sub=user.pk, scope=SCOPE_TENANT, tid=tenant.pk),
                "user": {
                    "id": user.pk,
                    "email": user.email,
                    "full_name": user.full_name,
                    "is_owner": user.is_owner,
                    "role": role.slug if role else None,
                },
                "org": _org_payload(tenant, org, modules),
            }
        )


class RefreshView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        payload = decode_token(request.data.get("refresh") or "")
        if payload.get("type") != "refresh":
            return Response({"detail": "Refresh token required."}, status=401)
        resolve_user(payload)  # re-validates user + tenant status
        return Response(
            make_token_pair(
                sub=payload["sub"], scope=payload["scope"], tid=payload.get("tid")
            )
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.auth.get("scope") == SCOPE_TENANT:
            tenant = Tenant.objects.get(pk=request.auth["tid"])
            org = OrgSettings.objects.filter(pk=1).first()
            role = request.user.role
            return Response(
                {
                    "scope": SCOPE_TENANT,
                    "user": {
                        "id": request.user.pk,
                        "email": request.user.email,
                        "full_name": request.user.full_name,
                        "is_owner": request.user.is_owner,
                        "role": role.slug if role else None,
                        "permissions": role.permissions if role else {},
                    },
                    "org": _org_payload(tenant, org, get_entitled_modules(request)),
                }
            )
        return Response(
            {
                "scope": "control",
                "user": {
                    "id": request.user.pk,
                    "email": request.user.email,
                    "full_name": request.user.full_name,
                    "admin_role": request.user.admin_role,
                },
            }
        )


class IsOwnerOrReadOnly(IsTenantUser):
    """Owner/admin-role users manage; everyone else reads. Refined with the full matrix later."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        role = request.user.role
        return request.user.is_owner or (role is not None and role.slug == "admin")


class OrgSettingsView(APIView):
    """The tenant's own organization settings (setup wizard + settings pages).
    Reads: any tenant user. Writes: owner/admin only."""

    permission_classes = [IsOwnerOrReadOnly]

    def get(self, request):
        from .serializers import OrgSettingsSerializer

        org = OrgSettings.objects.filter(pk=1).first()
        if org is None:
            return Response({"detail": "Organization not initialized."}, status=500)
        return Response(OrgSettingsSerializer(org).data)

    def patch(self, request):
        from .serializers import OrgSettingsSerializer

        org = OrgSettings.objects.get(pk=1)
        serializer = OrgSettingsSerializer(org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TenantUserViewSet(viewsets.ModelViewSet):
    serializer_class = TenantUserSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = TenantUser.objects.select_related("role").order_by("full_name")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(full_name__icontains=search) | qs.filter(email__icontains=search)
        return qs


class RoleViewSet(viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [IsOwnerOrReadOnly]
    queryset = Role.objects.all().order_by("name")

    def get_queryset(self):
        return Role.objects.all().order_by("name")

    def perform_destroy(self, instance):
        if instance.is_system:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("System roles cannot be deleted.")
        instance.delete()


class CatalogItemViewSet(viewsets.ModelViewSet):
    serializer_class = CatalogItemSerializer
    permission_classes = [IsTenantUser]

    def get_queryset(self):
        qs = CatalogItem.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        kind = self.request.query_params.get("kind")
        if kind:
            qs = qs.filter(kind=kind)
        return qs


class PartyViewSet(viewsets.ModelViewSet):
    serializer_class = PartySerializer
    permission_classes = [IsTenantUser]

    def get_queryset(self):
        qs = Party.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        kind = self.request.query_params.get("kind")
        if kind:
            qs = qs.filter(kind__in=[kind, Party.Kind.BOTH])
        return qs


class ModulePingView(APIView):
    """Entitlement-gating smoke endpoint — one per module, used by tests and
    by the frontend to verify a module is reachable."""

    module_code = None

    def get_permissions(self):
        return [HasModule(self.module_code)()]

    def get(self, request):
        return Response({"ok": True, "module": self.module_code})
