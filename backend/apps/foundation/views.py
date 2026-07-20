from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.control.models import Tenant
from apps.tenancy.context import get_tenant, use_tenant

from .auth import SCOPE_TENANT, decode_token, make_token_pair, resolve_user
from .module_map import build_effective_permissions
from .models import CatalogItem, EntitlementSnapshot, OrgSettings, Party, Role, TenantUser
from .permissions import HasModule, IsTenantAdmin, IsTenantUser, get_entitled_modules
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


class LegacyProfileView(APIView):
    """Portal-compat: GET /auth/users/me/ returns the UserProfile shape the
    existing (Old Project) portal consumes. Maps our TenantUser -> that shape,
    synthesising `username` (portal uses full_name||username for avatars/forms)."""

    permission_classes = [IsTenantUser]

    def get(self, request):
        user = request.user
        role = user.role
        operating_city = ""
        if user.city:
            import json

            operating_city = json.dumps([user.city])
        return Response(
            {
                "id": user.pk,
                "email": user.email,
                "username": user.email,  # synthesised; TenantUser has no username
                "full_name": user.full_name,
                "phone": user.phone or "",
                "profile_image": user.profile_image or None,
                "role": role.slug if role else "",
                "is_active": user.is_active,
                "is_owner": user.is_owner,
                "department": "",
                "employee_id": "",
                "region": user.state or "",
                "operating_city": operating_city,
                "operating_pincodes": [],
                "assigned_to": None,
            }
        )


class ChangePasswordView(APIView):
    """Portal-compat: PATCH /auth/users/{id}/change_password/. A user may only
    change their OWN password (matches the portal's profile-settings screen)."""

    permission_classes = [IsTenantUser]

    def patch(self, request, pk):
        if request.user.pk != int(pk):
            return Response({"detail": "You can only change your own password."}, status=403)
        old_password = request.data.get("old_password") or ""
        new_password = request.data.get("new_password") or ""
        confirm = request.data.get("new_password_confirm") or ""
        if not request.user.check_password(old_password):
            return Response({"detail": "Current password is incorrect."}, status=400)
        if new_password != confirm:
            return Response({"new_password_confirm": "Passwords do not match."}, status=400)

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            validate_password(new_password)
        except DjangoValidationError as error:
            return Response({"new_password": list(error.messages)}, status=400)

        request.user.set_password(new_password)
        request.user.save(update_fields=["password", "updated_at"])
        return Response(status=204)


class RolePermissionsMeView(APIView):
    """Portal-compat: GET /core/role-permissions/me/ returns EffectivePermissions.
    Un-entitled packages are folded in as {enabled:false} so the portal's existing
    (fail-open) sidebar gating hides sections the tenant did not buy."""

    permission_classes = [IsTenantUser]

    def get(self, request):
        role = request.user.role
        return Response(
            build_effective_permissions(
                role_slug=role.slug if role else "",
                is_owner=request.user.is_owner,
                entitled_modules=get_entitled_modules(request),
            )
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

    def destroy(self, request, *args, **kwargs):
        """Deleting a role people still hold must not strip them silently.

        TenantUser.role is SET_NULL, so a bare delete left every holder with no
        role at all — they keep a valid session but lose every role-derived
        permission, with nothing in any trail explaining why. Same contract as
        /core/roles/: 409 with a reassignment target, not a silent 204.
        """
        role = self.get_object()
        if role.is_system:
            return Response({"detail": "System roles cannot be deleted."}, status=400)

        holders = TenantUser.objects.filter(role_id=role.pk)
        count = holders.count()
        if count:
            target_slug = (request.data or {}).get("reassign_to")
            if not target_slug:
                return Response({
                    "detail": f"{count} user(s) still hold this role.",
                    "user_count": count, "requires_reassign": True,
                }, status=409)
            target = Role.objects.filter(slug=target_slug).exclude(pk=role.pk).first()
            if target is None:
                return Response({"reassign_to": "pick a different, existing role."}, status=400)
            holders.update(role=target)
        role.delete()
        return Response(status=204)


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

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        """Customer/supplier statement. Foundation owns the stable URL but the
        data lives in BOOKS — ask the capability registry (no import). Returns an
        empty statement when BOOKS is not entitled, so the screen degrades cleanly."""
        from apps.foundation.integration import capabilities

        party = self.get_object()
        empty = {"customer": {"id": party.id, "name": party.name}, "currency": "INR",
                 "opening_balance": 0.0, "lines": [], "closing_balance": 0.0}
        data = capabilities.call(
            "books.party_ledger", party.id,
            request.query_params.get("from_date"), request.query_params.get("to_date"),
            default=empty,
        )
        return Response(data)

    @action(detail=True, methods=["get"], url_path="detail")
    def detail_analytics(self, request, pk=None):
        """Everything the client-profile drawer shows about one party.

        Assembled entirely from capabilities: foundation owns the Party and the
        URL, but the orders, visits and distributor history belong to modules it
        must not import. Whatever the tenant hasn't bought simply comes back
        empty, so the drawer still opens.
        """
        from apps.foundation.integration import capabilities

        party = self.get_object()
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")

        orders = capabilities.call("orders.for_party", party.id, from_date, to_date,
                                   default=None) or {}
        visits = capabilities.call("field.visits_for_party", party.id, from_date, to_date,
                                   default=None) or []
        distribution = capabilities.call("dist.requests_for_party", party.id,
                                         default=None) or {}
        return Response({
            "id": party.id,
            "name": party.name,
            "kind": party.kind,
            "orders": orders.get("orders", []),
            "order_count": orders.get("order_count", 0),
            "total_order_amount": orders.get("total_order_amount", 0.0),
            "product_sales": orders.get("product_sales", []),
            "visits": visits,
            "distributor": distribution.get("distributor"),
            "distributor_stock_requests": distribution.get("requests", []),
            "ledger_available": capabilities.available("books.party_ledger"),
        })


class CurrentCompanyView(APIView):
    """Portal-compat: the tenant's own company profile.

    Invoice/PO previews and print headers across the imported screens read this,
    so it is served from OrgSettings rather than a separate Company table.
    """

    permission_classes = [IsTenantUser]

    def get(self, request):
        org = OrgSettings.objects.filter(pk=1).first()
        tenant = get_tenant()
        address = (org.address if org and isinstance(getattr(org, "address", None), dict) else {}) or {}
        payload = {
            "id": 1,
            "name": (org.company_name if org else None) or (tenant.name if tenant else ""),
            "legal_name": (org.company_name if org else "") or "",
            "tax_id": getattr(org, "gstin", "") or "",
            "email": getattr(org, "email", "") or "",
            "phone": getattr(org, "phone", "") or "",
            "address": address,
            "full_address": ", ".join(
                str(v) for v in [address.get("line1"), address.get("line2"), address.get("city"),
                                 address.get("state"), address.get("postal_code")] if v
            ),
            "industry": (org.industry if org else "") or "",
            "currency": "INR",
            "org_code": tenant.org_code if tenant else "",
        }
        # the portal calls this both as a detail and a list endpoint
        if request.query_params.get("as") == "list":
            return Response({"count": 1, "results": [payload]})
        return Response(payload)


class EventDeliveryView(APIView):
    """Operational visibility for the event outbox (tenant admin).

    GET  /api/t/event-deliveries         -> undelivered events + counts
    POST /api/t/event-deliveries/retry   -> replay them now (optionally ?ids=1,2)

    Without this an auto-post that failed (an invoice that never reached the
    ledger) would only exist as a log line on a server nobody reads.
    """

    permission_classes = [IsTenantAdmin]

    def get(self, request):
        from .models import EventDelivery

        qs = EventDelivery.objects.all()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status__in=[s.strip() for s in status_filter.split(",") if s.strip()])
        else:  # default view is "what still needs attention"
            qs = qs.exclude(status=EventDelivery.Status.DELIVERED)

        counts = {row["status"]: row["n"] for row in
                  EventDelivery.objects.values("status").annotate(n=Count("id"))}
        rows = [{
            "id": d.pk, "event": d.event, "subscriber": d.subscriber, "status": d.status,
            "attempts": d.attempts, "last_error": d.last_error,
            "created_at": d.created_at, "delivered_at": d.delivered_at,
        } for d in qs[:200]]
        return Response({"counts": counts, "results": rows})

    def post(self, request):
        from .integration import redeliver

        raw_ids = request.data.get("ids") or request.query_params.get("ids")
        ids = None
        if raw_ids:
            values = raw_ids if isinstance(raw_ids, list) else str(raw_ids).split(",")
            try:
                ids = [int(str(v).strip()) for v in values if str(v).strip()]
            except ValueError:
                return Response({"detail": "ids must be integers."}, status=400)
        return Response(redeliver(delivery_ids=ids))


class ModulePingView(APIView):
    """Entitlement-gating smoke endpoint — one per module, used by tests and
    by the frontend to verify a module is reachable."""

    module_code = None

    def get_permissions(self):
        return [HasModule(self.module_code)()]

    def get(self, request):
        return Response({"ok": True, "module": self.module_code})
