import os
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.control.models import Tenant
from apps.tenancy.context import get_tenant, use_tenant

from . import media_service
from .auth import SCOPE_TENANT, decode_token, make_token_pair, resolve_user
from .module_map import build_effective_permissions
from .models import CatalogItem, EntitlementSnapshot, OrgSettings, Party, Role, TenantUser
from .permissions import HasModule, IsTenantAdmin, IsTenantUser, get_entitled_modules
from .serializers import CatalogItemSerializer, PartySerializer, RoleSerializer, TenantUserSerializer


def _org_payload(tenant, org: OrgSettings | None, modules: list[str]):
    # Latest subscription drives the portal's renewal banner + billing page.
    subscription = tenant.subscriptions.order_by("-started_at").first()
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
        "subscription": subscription
        and {
            "package_code": subscription.package.code,
            "status": subscription.status,
            "seats": subscription.seats,
            "billing_cycle": subscription.billing_cycle,
            "current_period_end": subscription.current_period_end,
        },
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

        from .login_audit import record_login

        tenant = Tenant.objects.filter(org_code__iexact=org_code).first()
        if tenant is None:
            # No tenant DB to audit into — an unknown org code hits no one's log.
            return Response({"detail": "Invalid organization code."}, status=status.HTTP_401_UNAUTHORIZED)
        if not tenant.can_login():
            with use_tenant(tenant):
                record_login(request, username_attempted=email, success=False,
                             detail=f"tenant_{tenant.status}")
            return Response(
                {"detail": f"This organization is {tenant.status}.", "code": f"tenant_{tenant.status}"},
                status=status.HTTP_403_FORBIDDEN,
            )

        with use_tenant(tenant):
            user = TenantUser.objects.filter(email=email, is_active=True).first()
            if user is None or not user.check_password(password):
                record_login(request, username_attempted=email, success=False,
                             detail="invalid_credentials")
                return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
            user.last_login = timezone.now()
            user.save(update_fields=["last_login", "updated_at"])
            record_login(request, user=user, username_attempted=email, success=True)

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


def normalize_phone(raw: str) -> str:
    """Last 10 digits — so +91 98765 43210, 09876543210 and 9876543210 match.

    Users are entered by admins in whatever format they like; a login must not
    fail because someone typed a country code.
    """
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def _find_user_by_phone(phone: str):
    """Resolve a TenantUser by phone inside the CURRENT tenant context."""
    target = normalize_phone(phone)
    if not target:
        return None
    for user in TenantUser.objects.filter(is_active=True).exclude(phone=""):
        if normalize_phone(user.phone) == target:
            return user
    return None


def _deliver_otp(user, code, tenant):
    """Send the code by SMS and/or email. Returns the channels that accepted it.

    Best-effort by design: a provider outage must not break the login flow, and
    the caller never reveals which channel worked (that would leak whether a
    phone is registered).
    """
    from django.conf import settings

    channels = []

    # SMS — only if the org configured a provider AND an OTP_LOGIN template.
    try:
        from .models import SMSConfiguration, SMSTemplate

        sms_config = SMSConfiguration.objects.filter(pk=1).first()
        template = SMSTemplate.objects.filter(trigger_key="OTP_LOGIN", is_active=True).first()
        if sms_config and sms_config.api_key and template and template.dlt_template_id:
            # No SMS gateway is wired into this platform yet; the config and DLT
            # id are stored and ready, so this is where the send goes.
            channels.append("sms_pending_provider")
    except Exception:                                # noqa: BLE001 - never break login
        pass

    # Email — reuses the tenant's own SMTP, same path as the credentials mail.
    try:
        if user.email:
            from .config_views import _send_email
            from .models import EmailConfiguration, EmailTemplate

            config = EmailConfiguration.objects.filter(pk=1).first()
            if config and config.host and config.username and config.password:
                template = EmailTemplate.objects.filter(trigger_key="OTP_LOGIN", is_active=True).first()
                if template:
                    subject = template.subject
                    body = (template.body or "")\
                        .replace("{full_name}", user.full_name or user.email)\
                        .replace("{otp}", code)
                else:
                    subject = "Your sign-in code"
                    body = (f"<p>Hello {user.full_name or user.email},</p>"
                            f"<p>Your one-time sign-in code is <b>{code}</b>. "
                            f"It expires in {OTP_TTL_MINUTES} minutes.</p>"
                            f"<p>If you didn't request it, you can ignore this email.</p>")
                sent, _ = _send_email(config, user.email, subject, body)
                if sent:
                    channels.append("email")
    except Exception:                                # noqa: BLE001 - never break login
        pass

    if settings.DEBUG:
        channels.append("debug")
    return channels


OTP_TTL_MINUTES = 5


class SendOTPView(APIView):
    """POST {org_code, phone} -> issues a one-time sign-in code.

    Always answers 200 with the same message, whether or not the phone belongs
    to anyone: a differing reply would turn this into a phone-enumeration oracle
    for any known org code.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        import secrets

        from django.conf import settings
        from django.contrib.auth.hashers import make_password

        from .models import LoginOTP

        org_code = (request.data.get("org_code") or "").strip()
        phone = (request.data.get("phone") or request.data.get("phoneNumber") or "").strip()
        if not org_code or not phone:
            return Response({"detail": "org_code and phone are required."}, status=400)

        generic = Response(
            {"detail": "If that phone number is registered, a sign-in code has been sent.",
             "expires_in": OTP_TTL_MINUTES * 60},
            status=200,
        )

        tenant = Tenant.objects.filter(org_code__iexact=org_code).first()
        if tenant is None:
            return Response({"detail": "Invalid organization code."}, status=401)
        if not tenant.can_login():
            return Response(
                {"detail": f"This organization is {tenant.status}.", "code": f"tenant_{tenant.status}"},
                status=403,
            )

        with use_tenant(tenant):
            user = _find_user_by_phone(phone)
            if user is None:
                return generic

            code = f"{secrets.randbelow(1000000):06d}"
            LoginOTP.objects.filter(phone=normalize_phone(phone), consumed_at__isnull=True).update(
                consumed_at=timezone.now()          # supersede any earlier code
            )
            LoginOTP.objects.create(
                phone=normalize_phone(phone),
                code_hash=make_password(code),
                expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
            )
            channels = _deliver_otp(user, code, tenant)

        payload = dict(generic.data)
        # The plaintext code is exposed ONLY with DEBUG on (never in production),
        # so a local/dev login works without a live SMS provider.
        if settings.DEBUG:
            payload["debug_otp"] = code
            payload["channels"] = channels
        return Response(payload, status=200)


class VerifyOTPView(APIView):
    """POST {org_code, phone, otp} -> the same token payload as password login."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        from django.contrib.auth.hashers import check_password

        from .login_audit import record_login
        from .models import LoginOTP

        org_code = (request.data.get("org_code") or "").strip()
        phone = (request.data.get("phone") or request.data.get("phoneNumber") or "").strip()
        code = str(request.data.get("otp") or "").strip()
        if not org_code or not phone or not code:
            return Response({"detail": "org_code, phone and otp are required."}, status=400)

        tenant = Tenant.objects.filter(org_code__iexact=org_code).first()
        if tenant is None:
            return Response({"detail": "Invalid organization code."}, status=401)
        if not tenant.can_login():
            return Response(
                {"detail": f"This organization is {tenant.status}.", "code": f"tenant_{tenant.status}"},
                status=403,
            )

        invalid = Response({"detail": "Invalid or expired code."}, status=401)

        with use_tenant(tenant):
            normalized = normalize_phone(phone)
            otp = (
                LoginOTP.objects.filter(phone=normalized, consumed_at__isnull=True)
                .order_by("-created_at")
                .first()
            )
            if otp is None or not otp.is_usable():
                record_login(request, username_attempted=phone, success=False,
                             method="otp", detail="otp_missing_or_expired")
                return invalid

            if not check_password(code, otp.code_hash):
                # Count the miss so a 6-digit code can't be brute-forced.
                otp.attempts += 1
                if otp.attempts >= LoginOTP.MAX_ATTEMPTS:
                    otp.consumed_at = timezone.now()
                otp.save(update_fields=["attempts", "consumed_at"])
                record_login(request, username_attempted=phone, success=False,
                             method="otp", detail="otp_invalid")
                return invalid

            user = _find_user_by_phone(phone)
            if user is None:
                record_login(request, username_attempted=phone, success=False,
                             method="otp", detail="user_not_found")
                return invalid

            # Burn the code before issuing a session — one use only.
            otp.consumed_at = timezone.now()
            otp.save(update_fields=["consumed_at"])

            user.last_login = timezone.now()
            user.save(update_fields=["last_login", "updated_at"])
            record_login(request, user=user, username_attempted=phone, success=True, method="otp")

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


def _seat_limit_response(request):
    """402 when the org's paid/trial seat allowance is exhausted, else None.

    The limit lives in the control plane (Subscription.seats, or the package's
    included_users during trial); usage is the tenant DB's active user count.
    """
    from apps.control.models import Subscription

    tenant = Tenant.objects.get(pk=request.auth["tid"])
    subscription = (
        tenant.subscriptions.filter(
            status__in=[Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE]
        )
        .order_by("-started_at")
        .first()
    )
    limit = subscription.seats if subscription else (
        tenant.package.included_users if tenant.package_id else None
    )
    if limit is None:
        return None
    used = TenantUser.objects.filter(is_active=True).count()
    if used < limit:
        return None
    return Response(
        {
            "detail": f"Your plan includes {limit} user seat{'s' if limit != 1 else ''} and all "
                      f"{used} are in use. Buy more seats to add this user.",
            "code": "seat_limit_reached",
            "seat_limit": limit,
            "seats_used": used,
        },
        status=402,
    )


def _send_credentials_email(user, password, tenant):
    """Email a newly created user their sign-in details.

    Admins set the password in the Add-User form; without this the account was
    created and then nobody could tell the user what it was. Sending happens
    through the tenant's own SMTP config (same path as the config screen's test
    send). Returns (sent, error) and NEVER raises: a mail outage must not undo a
    user that was already created — the caller surfaces the outcome instead.
    """
    from .config_views import _send_email
    from .models import EmailConfiguration

    config = EmailConfiguration.objects.filter(pk=1).first()
    if config is None or not (config.host and config.username and config.password):
        return False, "Email is not configured for this organization."

    portal_url = os.environ.get("PORTAL_URL", "https://app.kaysetu.in")
    org_name = getattr(tenant, "name", "") or ""
    org_code = getattr(tenant, "org_code", "") or ""
    body = f"""
      <p>Hello {user.full_name or user.email},</p>
      <p>An account has been created for you{f' at <b>{org_name}</b>' if org_name else ''}.
         You can sign in with the details below.</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Organization code</b></td><td>{org_code}</td></tr>
        <tr><td><b>Email</b></td><td>{user.email}</td></tr>
        <tr><td><b>Password</b></td><td>{password}</td></tr>
      </table>
      <p><a href="{portal_url}/login">Sign in to {portal_url}</a></p>
      <p>For your security, please change this password after your first sign-in.</p>
    """
    try:
        return _send_email(config, user.email, f"Your sign-in details{f' for {org_name}' if org_name else ''}", body)
    except Exception as exc:                        # noqa: BLE001 - reported to the admin
        return False, f"{type(exc).__name__}: {exc}"


class TenantUserViewSet(viewsets.ModelViewSet):
    serializer_class = TenantUserSerializer
    permission_classes = [IsOwnerOrReadOnly]
    # The user forms post multipart (photo + KYC scans alongside the fields).
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # Uploaded file field -> media-service section. Same layout as the previous
    # platform so stored URLs and the service's folders stay consistent.
    UPLOAD_SECTIONS = {
        "profile_image": media_service.SECTION_USER_PROFILE,
        "aadhaar_card": media_service.SECTION_USER_AADHAAR,
        "pan_card": media_service.SECTION_USER_PAN,
    }

    def get_queryset(self):
        qs = TenantUser.objects.select_related("role").order_by("full_name")
        params = self.request.query_params
        search = params.get("search")
        if search:
            qs = qs.filter(full_name__icontains=search) | qs.filter(email__icontains=search)
        # The ported pickers filter by role slug (e.g. ?role=sales_manager).
        if params.get("role"):
            qs = qs.filter(role__slug=params["role"])
        if params.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=params["is_active"] == "true")
        return qs

    def _absorb_uploads(self, request):
        """Push any uploaded photo/KYC files to the media service and rewrite
        the payload with the returned URLs.

        These model fields are URLFields — without this the multipart file the
        form sends is silently dropped and the user is saved with no photo.
        Returns an error Response when the service rejects an upload, because
        saving a KYC record whose scan vanished is worse than failing loudly.
        """
        files = getattr(request, "FILES", None)
        if not files:
            return None
        uploaded = {field: files[field] for field in self.UPLOAD_SECTIONS if field in files}
        if not uploaded:
            return None
        if not media_service.is_configured():
            return Response(
                {"detail": "File uploads are unavailable — the media service is not configured."},
                status=503,
            )
        # QueryDict from a multipart request is immutable; copy before writing.
        request._full_data = data = request.data.copy()
        for field, file_obj in uploaded.items():
            url = media_service.upload_and_get_url(file_obj, self.UPLOAD_SECTIONS[field])
            if not url:
                return Response(
                    {field: "Upload failed. Please try again."}, status=502
                )
            data[field] = url
        return None

    def create(self, request, *args, **kwargs):
        blocked = _seat_limit_response(request)
        if blocked is not None:
            return blocked
        failed = self._absorb_uploads(request)
        if failed is not None:
            return failed

        # Keep the plaintext password before the serializer consumes it, so the
        # new user can be told what it is. Without this the account was created
        # with a password only the admin knew — and if none was supplied at all,
        # set_unusable_password() left an account nobody could ever sign in to.
        password = (request.data.get("password") or "").strip()

        response = super().create(request, *args, **kwargs)

        if response.status_code == 201 and password:
            email = (response.data or {}).get("email")
            user = TenantUser.objects.filter(email=email).first() if email else None
            if user is not None:
                tenant = Tenant.objects.filter(pk=request.auth["tid"]).first()
                sent, error = _send_credentials_email(user, password, tenant)
                # Report delivery without failing the (already committed) create,
                # so the admin knows whether to pass the password on by hand.
                response.data = dict(response.data or {})
                response.data["credentials_email_sent"] = sent
                if not sent:
                    response.data["credentials_email_error"] = error
        return response

    def update(self, request, *args, **kwargs):
        # Re-activating a deactivated user also consumes a seat.
        instance = self.get_object()
        wants_active = str(request.data.get("is_active", "")).lower() in ("true", "1")
        if not instance.is_active and wants_active:
            blocked = _seat_limit_response(request)
            if blocked is not None:
                return blocked
        failed = self._absorb_uploads(request)
        if failed is not None:
            return failed
        return super().update(request, *args, **kwargs)


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
        from .config_views import company_payload
        org = OrgSettings.objects.filter(pk=1).first()
        tenant = get_tenant()
        payload = company_payload(org, tenant)
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
