"""
Tenant configuration API — company profile, messaging config + templates, mobile
releases, quick links, and role CRUD.

All of it is platform-core: every tenant gets these regardless of package, so
nothing here is gated on a module. Writes are admin-only, because these settings
decide what the whole organisation can see and how it talks to its customers.
"""
from django.utils.text import slugify
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    EmailConfiguration,
    EmailTemplate,
    OrgSettings,
    Role,
    RoleQuickLink,
    SMSConfiguration,
    SMSTemplate,
    TenantUser,
    UserQuickLink,
)
from .permissions import IsTenantAdmin, IsTenantUser
from apps.tenancy.context import get_tenant


class IsAdminOrReadOnly(IsTenantUser):
    """Anyone in the tenant may read; only an admin may change."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return IsTenantAdmin().has_permission(request, view)


# ------------------------------------------------------------------- company
COMPANY_FIELDS = [
    "company_name", "legal_name", "abbreviation", "gstin", "registration_number",
    "industry", "logo_url", "email", "phone", "website", "address", "country",
    "latitude", "longitude", "operating_cities", "default_operating_city",
    "default_currency", "timezone", "date_format", "fy_start_month", "fiscal_day_start",
    "office_start_time", "office_end_time", "active_font", "is_active",
]


def company_payload(org, tenant):
    address = (org.address if org else {}) or {}
    return {
        "id": 1,
        "name": (org.company_name if org else "") or (tenant.name if tenant else ""),
        "company_name": (org.company_name if org else "") or "",
        "legal_name": getattr(org, "legal_name", "") or "",
        "abbreviation": getattr(org, "abbreviation", "") or "",
        "country": getattr(org, "country", "") or "India",
        "default_currency": getattr(org, "default_currency", "") or "INR",
        "tax_id": getattr(org, "gstin", "") or "",
        "gstin": getattr(org, "gstin", "") or "",
        "registration_number": getattr(org, "registration_number", "") or "",
        "email": getattr(org, "email", "") or "",
        "phone": getattr(org, "phone", "") or "",
        "website": getattr(org, "website", "") or "",
        "logo": getattr(org, "logo_url", "") or "",
        "logo_url": getattr(org, "logo_url", "") or "",
        "address": address,
        "full_address": ", ".join(str(v) for v in [
            address.get("line1"), address.get("line2"), address.get("city"),
            address.get("state"), address.get("postal_code")] if v),
        "latitude": getattr(org, "latitude", None),
        "longitude": getattr(org, "longitude", None),
        "operating_cities": getattr(org, "operating_cities", []) or [],
        "default_operating_city": getattr(org, "default_operating_city", "") or "",
        "timezone": getattr(org, "timezone", "") or "Asia/Kolkata",
        "date_format": getattr(org, "date_format", "") or "dd/MM/yyyy",
        "is_active": getattr(org, "is_active", True),
        "fiscal_month_start": getattr(org, "fy_start_month", 4),
        "fiscal_day_start": getattr(org, "fiscal_day_start", 1),
        "office_start_time": getattr(org, "office_start_time", None),
        "office_end_time": getattr(org, "office_end_time", None),
        "active_color_scheme": (getattr(org, "appearance", {}) or {}).get("scheme", ""),
        "custom_color_scheme": (getattr(org, "appearance", {}) or {}).get("custom"),
        "active_font": getattr(org, "active_font", "") or "roboto",
        "industry": getattr(org, "industry", "") or "",
        "currency": getattr(org, "default_currency", "") or "INR",
        "org_code": tenant.org_code if tenant else "",
    }


class CompanyViewSet(viewsets.ViewSet):
    """The tenant's own company profile. A singleton served as a collection,
    because the ported screens address it as `/core/companies/{id}/`."""

    permission_classes = [IsAdminOrReadOnly]

    def _org(self):
        org, _ = OrgSettings.objects.get_or_create(
            pk=1, defaults={"company_name": (get_tenant().name if get_tenant() else "")})
        return org

    def list(self, request):
        return Response({"count": 1, "results": [company_payload(self._org(), get_tenant())]})

    def retrieve(self, request, pk=None):
        return Response(company_payload(self._org(), get_tenant()))

    @action(detail=False, methods=["get"])
    def current(self, request):
        return Response(company_payload(self._org(), get_tenant()))

    def partial_update(self, request, pk=None):
        return self._save(request)

    def update(self, request, pk=None):
        return self._save(request)

    def _save(self, request):
        from decimal import Decimal, InvalidOperation

        org = self._org()
        data = request.data
        # `name` is what the portal's form field is called; the column is
        # company_name. Accept both rather than silently dropping the edit.
        if "name" in data and "company_name" not in data:
            org.company_name = data["name"]

        # Numeric fields are validated HERE. Assigning a request value straight
        # to the model deferred the failure to save(), which surfaced as a 500
        # on something as ordinary as a mistyped latitude.
        errors = {}
        for field in COMPANY_FIELDS:
            if field not in data:
                continue
            value = data[field]
            if field in ("office_start_time", "office_end_time",
                         "latitude", "longitude") and value in ("", None):
                value = None
            elif field in ("latitude", "longitude"):
                try:
                    value = Decimal(str(value))
                except (InvalidOperation, TypeError, ValueError):
                    errors[field] = "must be a decimal number."
                    continue
            elif field in ("fy_start_month", "fiscal_day_start"):
                try:
                    value = int(value)
                except (TypeError, ValueError):
                    errors[field] = "must be a whole number."
                    continue
                bound = 12 if field == "fy_start_month" else 31
                if not 1 <= value <= bound:
                    errors[field] = f"must be between 1 and {bound}."
                    continue
            elif field == "operating_cities" and not isinstance(value, list):
                errors[field] = "must be a list of city names."
                continue
            elif field == "address" and not isinstance(value, dict):
                errors[field] = "must be an object."
                continue
            setattr(org, field, value)
        if errors:
            return Response(errors, status=400)
        if "tax_id" in data:
            org.gstin = data["tax_id"]
        appearance = dict(org.appearance or {})
        if "active_color_scheme" in data:
            appearance["scheme"] = data["active_color_scheme"]
        if "custom_color_scheme" in data:
            appearance["custom"] = data["custom_color_scheme"]
        org.appearance = appearance
        org.save()
        return Response(company_payload(org, get_tenant()))


# ------------------------------------------------------------------ messaging
class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = ["id", "name", "trigger_key", "subject", "body",
                  "available_variables", "is_active", "updated_at"]
        read_only_fields = ["trigger_key", "available_variables", "updated_at"]


class SMSTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMSTemplate
        fields = ["id", "name", "trigger_key", "content", "dlt_template_id",
                  "is_active", "updated_at"]
        read_only_fields = ["trigger_key", "updated_at"]


class _TemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None          # the screens render a plain array

    def _preview_context(self, template):
        raise NotImplementedError


class EmailTemplateViewSet(_TemplateViewSet):
    serializer_class = EmailTemplateSerializer
    queryset = EmailTemplate.objects.all()
    http_method_names = ["get", "post", "patch", "put", "head", "options"]

    @action(detail=True, methods=["post"])
    def send_test(self, request, pk=None):
        template = self.get_object()
        target = request.data.get("email")
        if not target:
            return Response({"status": "error", "message": "An email address is required."},
                            status=400)
        config = EmailConfiguration.objects.filter(pk=1).first()
        if config is None or not config.host or not config.username:
            # Say so plainly. Reporting success here would train people to trust
            # a channel that never actually sends.
            return Response({"status": "error",
                             "message": "Email is not configured yet — set the SMTP details first."},
                            status=400)
        body = template.body
        for variable in template.available_variables or []:
            body = body.replace("{{%s}}" % variable, f"TEST_{str(variable).upper()}")
        sent, error = _send_email(config, target, template.subject, body)
        if not sent:
            return Response({"status": "error", "message": error}, status=400)
        return Response({"status": "success", "message": f"Test email sent to {target}."})


class SMSTemplateViewSet(_TemplateViewSet):
    serializer_class = SMSTemplateSerializer
    queryset = SMSTemplate.objects.all()
    http_method_names = ["get", "post", "patch", "put", "head", "options"]

    @action(detail=True, methods=["post"])
    def send_test(self, request, pk=None):
        template = self.get_object()
        if not request.data.get("phone"):
            return Response({"status": "error", "message": "A phone number is required."},
                            status=400)
        config = SMSConfiguration.objects.filter(pk=1).first()
        if config is None or not config.api_key:
            return Response({"status": "error",
                             "message": "SMS is not configured yet — set the API key first."},
                            status=400)
        if not template.dlt_template_id:
            # Indian carriers reject a send with no DLT template id. Failing here
            # is more useful than a silent carrier-side drop.
            return Response({"status": "error",
                             "message": "This template has no DLT template id, so the carrier "
                                        "would reject it."}, status=400)
        return Response({"status": "error",
                         "message": "No SMS provider is wired up yet — the template and DLT id "
                                    "are stored and ready.",
                         "data": {"dispatched": False}}, status=400)


def _send_email(config, to_address, subject, body):
    """Send through the tenant's own SMTP settings. Returns (sent, error)."""
    from django.core.mail import EmailMessage, get_connection

    try:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=config.host, port=config.port, username=config.username,
            password=config.password, use_tls=config.use_tls, use_ssl=config.use_ssl,
            fail_silently=False,
        )
        message = EmailMessage(
            subject=subject, body=body,
            from_email=config.default_from_email or config.username,
            to=[to_address], connection=connection,
        )
        message.content_subtype = "html"
        message.send()
        return True, ""
    except Exception as exc:                       # noqa: BLE001 - reported to the admin
        return False, f"{type(exc).__name__}: {exc}"


class EmailConfigView(APIView):
    """Singleton config. The password is write-only — it is never returned, so a
    read-only admin session can't exfiltrate the mail credentials."""

    permission_classes = [IsAdminOrReadOnly]

    def _payload(self, config):
        if config is None:
            return {"host": "", "port": 587, "username": "", "use_tls": True,
                    "use_ssl": False, "default_from_email": "", "from_name": "",
                    "is_configured": False}
        return {
            "id": config.pk, "host": config.host, "port": config.port,
            "username": config.username, "use_tls": config.use_tls, "use_ssl": config.use_ssl,
            "default_from_email": config.default_from_email, "from_name": config.from_name,
            "is_configured": bool(config.host and config.username and config.password),
            "has_password": bool(config.password),
        }

    def get(self, request):
        return Response(self._payload(EmailConfiguration.objects.filter(pk=1).first()))

    def post(self, request):
        config, _ = EmailConfiguration.objects.get_or_create(pk=1)
        for field in ("host", "port", "username", "use_tls", "use_ssl",
                      "default_from_email", "from_name"):
            if field in request.data:
                setattr(config, field, request.data[field])
        # A blank password means "leave it alone", not "clear it" — otherwise
        # editing the from-name would silently break sending.
        if request.data.get("password"):
            config.password = request.data["password"]
        config.save()
        return Response(self._payload(config))


class EmailConfigVerifyView(APIView):
    permission_classes = [IsTenantAdmin]

    def post(self, request):
        from django.core.mail import get_connection

        data = request.data
        stored = EmailConfiguration.objects.filter(pk=1).first()
        # Verify what was TYPED when a host is supplied, so an admin can test
        # credentials before committing them.
        host = data.get("host") or (stored.host if stored else "")
        if not host:
            return Response({"status": "error", "message": "No SMTP host configured."},
                            status=400)

        # The stored password may ONLY be reused against the stored host and
        # username. Otherwise an admin could point this at a server they control
        # and have us authenticate to it — extracting a credential the API
        # deliberately never shows them.
        username = data.get("username") or (stored.username if stored else "")
        reusing_stored_target = bool(
            stored and host == stored.host and username == stored.username)
        password = data.get("password") or ""
        if not password:
            if not reusing_stored_target:
                return Response({
                    "status": "error",
                    "message": "Re-enter the password to verify against a different "
                               "host or username.",
                }, status=400)
            password = stored.password
        try:
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host, port=int(data.get("port") or (stored.port if stored else 587)),
                username=data.get("username") or (stored.username if stored else ""),
                password=password,
                use_tls=bool(data.get("use_tls", stored.use_tls if stored else True)),
                use_ssl=bool(data.get("use_ssl", stored.use_ssl if stored else False)),
                fail_silently=False, timeout=10,
            )
            connection.open()
            connection.close()
        except Exception as exc:                   # noqa: BLE001
            return Response({"status": "error", "message": f"{type(exc).__name__}: {exc}"},
                            status=400)
        return Response({"status": "success", "message": "Connected to the mail server."})


class EmailConfigSendTestView(APIView):
    permission_classes = [IsTenantAdmin]

    def post(self, request):
        target = request.data.get("email")
        if not target:
            return Response({"status": "error", "message": "An email address is required."},
                            status=400)
        config = EmailConfiguration.objects.filter(pk=1).first()
        if config is None or not config.host:
            return Response({"status": "error", "message": "Email is not configured yet."},
                            status=400)
        sent, error = _send_email(config, target, "KaySetu test email",
                                  "<p>Your KaySetu email settings are working.</p>")
        if not sent:
            return Response({"status": "error", "message": error}, status=400)
        return Response({"status": "success", "message": f"Test email sent to {target}."})


class SMSConfigView(APIView):
    permission_classes = [IsAdminOrReadOnly]

    def _payload(self, config):
        if config is None:
            return {"sender_id": "", "entity_id": "", "is_configured": False}
        return {"id": config.pk, "sender_id": config.sender_id, "entity_id": config.entity_id,
                "has_api_key": bool(config.api_key),
                "is_configured": bool(config.api_key and config.entity_id)}

    def get(self, request):
        return Response(self._payload(SMSConfiguration.objects.filter(pk=1).first()))

    def post(self, request):
        config, _ = SMSConfiguration.objects.get_or_create(pk=1)
        for field in ("sender_id", "entity_id"):
            if field in request.data:
                setattr(config, field, request.data[field])
        if request.data.get("api_key"):
            config.api_key = request.data["api_key"]
        config.save()
        return Response(self._payload(config))


# App releases are a PLATFORM concern, not a tenant one — the mobile app is one
# app, published once by the SuperAdmin. That surface moved to the control plane
# (apps/control: /sa/app-versions/ + public /public/app-version/latest); it is
# deliberately gone from the tenant API.


# ---------------------------------------------------------------- quick links
class QuickLinkSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    label = serializers.CharField(max_length=60)
    path = serializers.CharField(max_length=200)
    module_key = serializers.CharField(max_length=50, required=False, allow_blank=True)
    order = serializers.IntegerField(required=False, default=0)


class RoleQuickLinkViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None

    class _Serializer(serializers.ModelSerializer):
        role = serializers.CharField(source="role_slug")

        class Meta:
            model = RoleQuickLink
            fields = ["id", "role", "label", "path", "module_key", "order"]

    serializer_class = _Serializer

    def get_queryset(self):
        qs = RoleQuickLink.objects.all()
        role = self.request.query_params.get("role")
        return qs.filter(role_slug=role) if role else qs


class QuickLinkViewSet(viewsets.ViewSet):
    """A user's own shortcuts, plus the ones their role gives them."""

    permission_classes = [IsTenantUser]

    @action(detail=False, methods=["get"])
    def me(self, request):
        role_slug = getattr(getattr(request.user, "role", None), "slug", "") or ""
        predefined = RoleQuickLink.objects.filter(role_slug=role_slug)
        personal = UserQuickLink.objects.filter(user=request.user)
        return Response({
            "predefined": [{"id": r.pk, "label": r.label, "path": r.path,
                            "module_key": r.module_key, "order": r.order, "role": r.role_slug}
                           for r in predefined],
            "personal": [{"id": r.pk, "label": r.label, "path": r.path,
                          "module_key": r.module_key, "order": r.order}
                         for r in personal],
        })

    def create(self, request):
        label = (request.data.get("label") or "").strip()
        path = (request.data.get("path") or "").strip()
        if not label or not path:
            return Response({"detail": "A label and a path are required."}, status=400)
        role_slug = getattr(getattr(request.user, "role", None), "slug", "") or ""
        if RoleQuickLink.objects.filter(role_slug=role_slug, path=path).exists():
            return Response({"detail": "This page is already a predefined quick link."},
                            status=400)
        link, created = UserQuickLink.objects.get_or_create(
            user=request.user, path=path,
            defaults={"label": label, "module_key": (request.data.get("module_key") or "").strip()},
        )
        if not created:
            return Response({"detail": "You already added this quick link."}, status=400)
        return Response({"id": link.pk, "label": link.label, "path": link.path,
                         "module_key": link.module_key, "order": link.order}, status=201)

    def destroy(self, request, pk=None):
        # Scoped to the caller: deleting by id alone would let anyone remove
        # someone else's shortcuts.
        deleted, _ = UserQuickLink.objects.filter(pk=pk, user=request.user).delete()
        return Response(status=204 if deleted else 404)


# ---------------------------------------------------------------------- roles
class RoleRowSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()
    access_type = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["id", "slug", "name", "description", "is_system", "is_full_access",
                  "is_active", "access_type", "permissions", "user_count",
                  "created_at", "updated_at"]
        read_only_fields = ["slug", "is_system", "created_at", "updated_at"]

    def get_user_count(self, obj):
        counts = self.context.get("user_counts")
        if counts is not None:                      # prepared once, avoids N+1
            return counts.get(obj.pk, 0)
        return TenantUser.objects.filter(role_id=obj.pk).count()

    def get_access_type(self, obj):
        return "full" if obj.is_full_access else "custom"


class RoleConfigViewSet(viewsets.ModelViewSet):
    """Role CRUD addressed by SLUG — the portal's permission screens use slugs
    as their stable identifier, not database ids."""

    permission_classes = [IsAdminOrReadOnly]
    serializer_class = RoleRowSerializer
    queryset = Role.objects.all().order_by("name")
    lookup_field = "slug"
    pagination_class = None

    def get_serializer_context(self):
        from django.db.models import Count

        counts = {row["role"]: row["n"] for row in
                  TenantUser.objects.values("role").annotate(n=Count("id"))}
        return {**super().get_serializer_context(), "user_counts": counts}

    def _unique_slug(self, name):
        base = slugify(name).replace("-", "_")[:50] or "role"
        slug, suffix = base, 2
        while Role.objects.filter(slug=slug).exists():
            slug = f"{base[:47]}_{suffix}"
            suffix += 1
        return slug

    def create(self, request, *args, **kwargs):
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"name": "required."}, status=400)
        if Role.objects.filter(name__iexact=name).exists():
            return Response({"name": "a role with that name already exists."}, status=400)
        role = Role.objects.create(
            name=name, slug=self._unique_slug(name),
            description=request.data.get("description", ""),
            is_system=False, is_full_access=bool(request.data.get("is_full_access")),
            permissions=request.data.get("permissions") or {},
        )
        return Response(self.get_serializer(role).data, status=201)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system and "name" in request.data and request.data["name"] != role.name:
            return Response({"name": "System roles cannot be renamed."}, status=400)
        for field in ("name", "description", "permissions"):
            if field in request.data:
                setattr(role, field, request.data[field])
        if "is_active" in request.data and not role.is_full_access:
            # A full-access role must stay reachable; deactivating it could lock
            # every administrator out of the tenant.
            role.is_active = bool(request.data["is_active"])
        role.save()
        return Response(self.get_serializer(role).data)

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response({"detail": "System roles cannot be deleted."}, status=400)
        holders = TenantUser.objects.filter(role_id=role.pk)
        count = holders.count()
        if count:
            target_slug = request.data.get("reassign_to") if hasattr(request, "data") else None
            if not target_slug:
                # 409, not 400: the request is well-formed, it just conflicts
                # with people still holding the role. The screen offers a picker.
                return Response({
                    "detail": f"{count} user(s) still hold this role.",
                    "user_count": count, "requires_reassign": True,
                }, status=409)
            target = Role.objects.filter(slug=target_slug, is_active=True).first()
            if target is None or target.pk == role.pk:
                return Response({"reassign_to": "pick a different, active role."}, status=400)
            holders.update(role=target)
        role.delete()
        return Response(status=204)


class RolePermissionMatrixView(APIView):
    """The whole matrix, and a bulk save of it.

    Stored on Role.permissions rather than a side table: one row per role means
    the matrix and the role can never disagree about which roles exist.
    """

    permission_classes = [IsTenantAdmin]

    def get(self, request):
        role_filter = request.query_params.get("role")
        roles = Role.objects.all().order_by("name")
        if role_filter:
            roles = roles.filter(slug=role_filter)
        return Response([{
            "id": role.pk, "role": role.slug, "name": role.name,
            "access_type": "full" if role.is_full_access else "custom",
            "permissions": role.permissions or {},
            "updated_at": role.updated_at,
        } for role in roles])

    def post(self, request):
        return self._bulk(request)

    def patch(self, request):
        return self._bulk(request)

    def _bulk(self, request):
        payload = request.data or {}
        if not isinstance(payload, dict) or not payload:
            return Response({"detail": "Send {role_slug: {accessType, modules}}."}, status=400)
        saved, unknown = [], []
        for slug, config in payload.items():
            role = Role.objects.filter(slug=slug).first()
            if role is None:
                # Reported, not ignored — a silently-dropped role means an admin
                # thinks they saved permissions that were never stored.
                unknown.append(slug)
                continue
            if not isinstance(config, dict):
                continue
            role.is_full_access = (config.get("accessType") or config.get("access_type")) == "full"
            if "modules" in config:
                role.permissions = config["modules"] or {}
            elif "permissions" in config:
                role.permissions = config["permissions"] or {}
            role.save(update_fields=["is_full_access", "permissions", "updated_at"])
            saved.append(slug)
        body = {"status": "success", "saved_roles": saved}
        if unknown:
            body["unknown_roles"] = unknown
        return Response(body, status=400 if (unknown and not saved) else 200)


# ------------------------------------------------------------- people pickers
class AssignablePeopleView(APIView):
    """The dropdowns that assign work: agents, managers, distributors.

    Scoped, not global — a manager picking an agent should see their own team,
    not every agent in the company. An admin sees everyone.
    """

    permission_classes = [IsTenantUser]
    role_slugs = ()

    def get(self, request):
        user = request.user
        qs = TenantUser.objects.filter(is_active=True).select_related("role")
        if self.role_slugs:
            qs = qs.filter(role__slug__in=self.role_slugs)

        is_admin = bool(getattr(user, "is_owner", False)
                        or getattr(getattr(user, "role", None), "slug", "") == "admin")
        if not is_admin:
            slug = getattr(getattr(user, "role", None), "slug", "")
            if slug in ("sales_manager", "field_manager"):
                qs = qs.filter(reports_to_id=user.pk) | qs.filter(pk=user.pk)
            else:
                qs = qs.filter(pk=user.pk)
        return Response([{
            "id": u.pk, "full_name": u.full_name, "email": u.email, "phone": u.phone,
            "username": u.email, "city": u.city,
            "role": getattr(u.role, "slug", ""),
        } for u in qs.distinct().order_by("full_name")])


class AssignedSalesAgentsView(AssignablePeopleView):
    role_slugs = ("sales_agent", "field_agent")


class AssignedSalesManagersView(AssignablePeopleView):
    role_slugs = ("sales_manager", "field_manager")


class AssignedDistributorsView(APIView):
    """Distributors are foundation Parties, not users — the picker lists parties
    so a distributor with no login still appears.

    A distributor is a party flagged as one in `extra`, NOT every customer:
    returning the whole customer book from a picker labelled "distributors" both
    misled the screen and handed every tenant user the full customer list with
    contact details.
    """

    permission_classes = [IsTenantUser]

    def get(self, request):
        from .models import Party

        qs = Party.objects.filter(
            is_active=True, kind__in=[Party.Kind.CUSTOMER, Party.Kind.BOTH],
            extra__is_distributor=True)
        if request.query_params.get("city"):
            qs = qs.filter(address__city__iexact=request.query_params["city"])

        # An agent picks from THEIR distributors; a manager from their team's.
        user = request.user
        is_admin = bool(getattr(user, "is_owner", False)
                        or getattr(getattr(user, "role", None), "slug", "") == "admin")
        if not is_admin:
            slug = getattr(getattr(user, "role", None), "slug", "")
            if slug in ("sales_manager", "field_manager"):
                team = list(TenantUser.objects.filter(reports_to_id=user.pk)
                            .values_list("pk", flat=True))
                qs = qs.filter(assigned_agent_id__in=[user.pk, *team])
            else:
                qs = qs.filter(assigned_agent_id=user.pk)

        return Response([{
            "id": p.pk, "full_name": p.name, "name": p.name,
            "email": p.email, "phone": p.phone,
            "city": (p.address or {}).get("city", ""),
        } for p in qs.order_by("name")])


# ------------------------------------------------------------- login activity
from rest_framework.generics import ListAPIView          # noqa: E402
from rest_framework.pagination import PageNumberPagination  # noqa: E402

from .models import LoginActivity                          # noqa: E402


class LogPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


class LoginActivitySerializer(serializers.ModelSerializer):
    user = serializers.IntegerField(source="user_id", read_only=True)

    class Meta:
        model = LoginActivity
        fields = ["id", "user", "user_name", "username_attempted", "user_role",
                  "event", "success", "method", "platform", "ip_address",
                  "location", "location_resolved", "detail", "created_at"]


class LoginActivityView(ListAPIView):
    """The Login Activity log — an admin-only audit of who signed in, and who
    tried and failed. Reads from the tenant's own LoginActivity rows."""

    permission_classes = [IsTenantAdmin]
    serializer_class = LoginActivitySerializer
    pagination_class = LogPagination

    def get_queryset(self):
        qs = LoginActivity.objects.select_related("user").all()
        p = self.request.query_params
        if p.get("search"):
            term = p["search"]
            qs = (qs.filter(user_name__icontains=term)
                  | qs.filter(username_attempted__icontains=term)
                  | qs.filter(ip_address__icontains=term)
                  | qs.filter(location__icontains=term))
        if p.get("event"):
            qs = qs.filter(event=p["event"])
        if p.get("success") in ("true", "false"):
            qs = qs.filter(success=p["success"] == "true")
        if p.get("method"):
            qs = qs.filter(method=p["method"])
        if p.get("platform"):
            qs = qs.filter(platform=p["platform"])
        if p.get("date_from"):
            qs = qs.filter(created_at__date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(created_at__date__lte=p["date_to"])
        return qs.order_by(p.get("ordering") or "-created_at")


# --------------------------------------------------------- admin log placeholders
# The Logs screen carries several tabs whose backing features are not built yet
# (org-wide audit trail, document access log, deleted-document recovery, a
# notifications log, and DB backups). They are served as EMPTY, well-formed list
# responses rather than left to 404 — the tab shows a calm "no records" state
# instead of throwing. Replace each with a real query when the feature lands.
class EmptyLogView(ListAPIView):
    permission_classes = [IsTenantAdmin]
    pagination_class = LogPagination
    queryset = LoginActivity.objects.none()   # any model; we return nothing

    def list(self, request, *args, **kwargs):
        return Response({"count": 0, "next": None, "previous": None, "results": []})


class BackupTriggerView(APIView):
    """The 'run a backup now' button. Managed backups aren't wired to this
    deployment yet, so this answers honestly instead of 404-ing the button."""

    permission_classes = [IsTenantAdmin]

    def post(self, request):
        return Response(
            {"status": "unavailable",
             "message": "Automated backups are not configured for this environment yet."},
            status=200,
        )
