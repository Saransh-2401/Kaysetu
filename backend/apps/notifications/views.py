"""
NOTIFY API — /api/notifications/. CORE (no HasModule gate): every tenant has a
feed regardless of which packages they bought.

Paths match the imported portal exactly, so its notification screens needed no
repointing at all.
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.permissions import IsTenantUser

from . import events as catalog
from . import services
from .models import (
    Notification,
    NotificationBroadcast,
    RoleNotificationDefault,
    UserNotificationProfile,
    UserNotificationSetting,
)
from .serializers import BroadcastSerializer, NotificationSerializer

ADMIN_ROLES = {"admin"}


def _is_admin(user) -> bool:
    return bool(user and (user.is_owner or (user.role is not None
                                            and user.role.slug in ADMIN_ROLES)))


class IsNotificationAdmin(BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        return _is_admin(request.user)


class FeedPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 200


def _event_payload(event_key_entry, *, effective=None, override=None, relevant=None):
    payload = dict(event_key_entry)
    if effective is not None:
        payload["effective"] = effective
    if override is not None:
        payload["override"] = override
    if relevant is not None:
        payload["relevant"] = relevant
    return payload


class NotificationFeedViewSet(viewsets.ReadOnlyModelViewSet):
    """The signed-in user's own feed. Never anyone else's."""

    permission_classes = [IsTenantUser]
    serializer_class = NotificationSerializer
    pagination_class = FeedPagination

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("unread") == "true":
            qs = qs.filter(status=Notification.Status.UNREAD)
        if params.get("event_key"):
            qs = qs.filter(event_key=params["event_key"])
        return qs

    def list(self, request, *args, **kwargs):
        # the portal's FeedResponse carries the unread count alongside the page
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        data = NotificationSerializer(page if page is not None else qs, many=True).data
        unread = Notification.objects.filter(
            user=request.user, status=Notification.Status.UNREAD).count()
        if page is not None:
            resp = self.get_paginated_response(data)
            resp.data["unread"] = unread
            return resp
        return Response({"count": len(data), "unread": unread, "results": data})

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        return Response(NotificationSerializer(services.mark_read(self.get_object())).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        return Response({"updated": services.mark_all_read(request.user),
                         **services.summary(request.user)})

    @action(detail=False, methods=["get"])
    def summary(self, request):
        return Response(services.summary(request.user))


class EventCatalogView(APIView):
    """What this platform can notify about — drives the preference screens."""

    permission_classes = [IsTenantUser]

    def get(self, request):
        return Response({
            "channels": catalog.CHANNELS,
            "channel_labels": catalog.CHANNEL_LABELS,
            "categories": catalog.categories(),
            "events": catalog.EVENTS,
        })


class MyPreferencesView(APIView):
    """Per-user notification settings, with what each event RESOLVES to."""

    permission_classes = [IsTenantUser]

    def _payload(self, user):
        role_slug = getattr(getattr(user, "role", None), "slug", None)
        role_defaults = services._role_defaults_for(role_slug)
        overrides = services._user_overrides_for(user.pk)
        profile = UserNotificationProfile.objects.filter(user=user).first()
        relevant_keys = {e["key"] for e in catalog.events_for_role(role_slug)}
        events = [
            _event_payload(
                entry,
                effective=services.effective_channels(
                    entry["key"], role_slug=role_slug,
                    role_overrides=role_defaults.get(entry["key"], {}),
                    user_overrides=overrides.get(entry["key"], {})),
                override=overrides.get(entry["key"], {}),
                relevant=entry["key"] in relevant_keys,
            )
            for entry in catalog.EVENTS
        ]
        return {
            "muted": bool(profile.muted) if profile else False,
            "quiet_hours_start": profile.quiet_hours_start if profile else None,
            "quiet_hours_end": profile.quiet_hours_end if profile else None,
            "channels": catalog.CHANNELS,
            "channel_labels": catalog.CHANNEL_LABELS,
            "categories": catalog.categories(),
            "role": role_slug,
            "events": events,
        }

    def get(self, request):
        return Response(self._payload(request.user))

    def patch(self, request):
        data = request.data or {}
        profile, _ = UserNotificationProfile.objects.get_or_create(user=request.user)
        fields = []
        for field in ("muted", "quiet_hours_start", "quiet_hours_end"):
            if field in data:
                setattr(profile, field, data[field])
                fields.append(field)
        if fields:
            profile.save(update_fields=fields + ["updated_at"])

        for event_key, channels in (data.get("overrides") or {}).items():
            if event_key not in catalog.EVENT_KEYS:
                return Response({"detail": f"unknown event '{event_key}'."}, status=400)
            clean = {c: bool(v) for c, v in (channels or {}).items() if c in catalog.CHANNELS}
            if clean:
                UserNotificationSetting.objects.update_or_create(
                    user=request.user, event_key=event_key, defaults={"channels": clean})
            else:   # empty override = "go back to whatever my role says"
                UserNotificationSetting.objects.filter(
                    user=request.user, event_key=event_key).delete()
        return Response(self._payload(request.user))

    def post(self, request):
        return self.patch(request)


class RoleDefaultsView(APIView):
    """Admin policy layer: what a ROLE hears unless a person says otherwise."""

    permission_classes = [IsTenantUser, IsNotificationAdmin]

    def _roles(self):
        from apps.foundation.models import Role

        return [{"value": r.slug, "label": r.name} for r in Role.objects.order_by("name")]

    def _payload(self, role_slug):
        overrides = services._role_defaults_for(role_slug)
        relevant_keys = {e["key"] for e in catalog.events_for_role(role_slug)}
        events = [
            _event_payload(
                entry,
                effective=services.effective_channels(
                    entry["key"], role_slug=role_slug,
                    role_overrides=overrides.get(entry["key"], {})),
                override=overrides.get(entry["key"], {}),
                relevant=entry["key"] in relevant_keys,
            )
            for entry in catalog.EVENTS
        ]
        return {
            "roles": self._roles(),
            "role": role_slug,
            "channels": catalog.CHANNELS,
            "channel_labels": catalog.CHANNEL_LABELS,
            "categories": catalog.categories(),
            "events": events,
        }

    def get(self, request):
        return Response(self._payload(request.query_params.get("role")))

    def patch(self, request):
        role_slug = request.data.get("role") or request.query_params.get("role")
        if not role_slug:
            return Response({"detail": "role is required."}, status=400)
        for event_key, channels in (request.data.get("overrides") or {}).items():
            if event_key not in catalog.EVENT_KEYS:
                return Response({"detail": f"unknown event '{event_key}'."}, status=400)
            clean = {c: bool(v) for c, v in (channels or {}).items() if c in catalog.CHANNELS}
            if clean:
                RoleNotificationDefault.objects.update_or_create(
                    role_slug=role_slug, event_key=event_key, defaults={"channels": clean})
            else:   # empty = fall back to the catalog default
                RoleNotificationDefault.objects.filter(
                    role_slug=role_slug, event_key=event_key).delete()
        return Response(self._payload(role_slug))

    def post(self, request):
        return self.patch(request)


class BroadcastViewSet(viewsets.ModelViewSet):
    """Admin announcements. Everyone can read what was sent; only admins send."""

    serializer_class = BroadcastSerializer
    # A bare array, not a paginated envelope: the composer reads the history as
    # BroadcastRecord[] and did `history.map(...)` straight on the response, so
    # a {results} wrapper crashed it. The list is small (recent announcements).
    pagination_class = None
    http_method_names = ["get", "post", "head", "options"]
    queryset = NotificationBroadcast.objects.select_related("sent_by").all()

    def get_permissions(self):
        if self.action in ("create", "recipients"):
            return [IsTenantUser(), IsNotificationAdmin()]
        return [IsTenantUser()]

    def create(self, request, *args, **kwargs):
        try:
            record, warnings, result = services.broadcast(
                title=request.data.get("title", ""),
                body=request.data.get("body", ""),
                audience_type=request.data.get("audience_type", "all"),
                roles=request.data.get("roles"),
                user_ids=request.data.get("user_ids"),
                channels=request.data.get("channels"),
                sent_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({
            "id": record.pk,
            "recipient_count": record.recipient_count,
            "warnings": warnings,
            "delivered": result.get("delivered_in_app", 0),
            "broadcast": BroadcastSerializer(record).data,
        }, status=201)

    @action(detail=False, methods=["get"])
    def recipients(self, request):
        """Who an admin can address — the picker behind the broadcast form."""
        from apps.foundation.models import TenantUser

        qs = TenantUser.objects.filter(is_active=True).select_related("role")
        if request.query_params.get("role"):
            qs = qs.filter(role__slug=request.query_params["role"])
        return Response([{
            "id": u.pk, "full_name": u.full_name, "username": u.email,
            "role": getattr(u.role, "slug", "") or "",
        } for u in qs.order_by("full_name")[:2000]])
