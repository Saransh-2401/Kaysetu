"""
TRACK API — Agent Live Tracking. All endpoints gated by HasModule('TRACK')
(which already requires tenant scope). Mounted under /api/t/track/.
"""
from decimal import Decimal

from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.integration import events
from apps.foundation.permissions import HasModule
from apps.foundation.models import TenantUser

from . import gps, services
from .models import DeviceDiagnostic, DutyDay, RouteHistory, TrackingSettings
from .serializers import (
    DeviceDiagnosticSerializer,
    RouteHistorySerializer,
    TrackingSettingsSerializer,
)

TrackModule = HasModule("TRACK")

# Only slugs actually seeded by provisioning (MODULE_ROLE_TEMPLATES). Keying on
# non-seeded slugs would let a custom role escalate by slug collision.
MANAGER_ROLES = {"admin", "field_manager", "sales_manager"}


def _is_manager(user) -> bool:
    return user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)


def _is_admin(user) -> bool:
    return user.is_owner or (user.role is not None and user.role.slug == "admin")


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _visible_agent_ids(user):
    """None = all agents (admin/owner); else the set of agent ids this user may
    see (a manager's team + self; an agent = just self)."""
    if _is_admin(user):
        return None
    if _is_manager(user):
        team = set(
            TenantUser.objects.filter(reports_to_id=user.pk).values_list("pk", flat=True)
        )
        team.add(user.pk)
        return team
    return {user.pk}


class TrackWrite(BasePermission):
    """Owner/admin/manager may act on the team; anyone may act on themselves."""

    def has_permission(self, request, view):
        return True  # object-level checks done in the views


# --------------------------------------------------------------- agent actions
class PunchInView(APIView):
    permission_classes = [TrackModule]

    def post(self, request):
        data = request.data
        lat, lng = data.get("latitude", data.get("lat")), data.get("longitude", data.get("lng"))
        report, _ = DutyDay.objects.get_or_create(agent=request.user, date=timezone.localdate())
        if report.punch_in_time:
            return Response({"message": "Already punched in", "time": report.punch_in_time})
        now = timezone.now()
        report.punch_in_time = now
        report.start_location = {"lat": lat, "lng": lng, "address": data.get("address", "")}
        report.punch_out_time = None
        report.punch_out_type = ""
        if data.get("selfie_url"):
            report.punch_in_selfie = data["selfie_url"]
        report.save()
        events.emit("track.punched_in", agent_id=request.user.pk, date=report.date)
        return Response({
            "success": True, "time": now, "location": report.start_location,
            "selfie_url": report.punch_in_selfie,
        })


class PunchOutView(APIView):
    permission_classes = [TrackModule]

    def post(self, request):
        report = DutyDay.objects.filter(agent=request.user, date=timezone.localdate()).first()
        if report is None or report.punch_in_time is None:
            return Response({"detail": "You are not punched in."}, status=400)
        if report.punch_out_time:
            return Response({"message": "Already punched out", "time": report.punch_out_time})
        now = timezone.now()
        data = request.data
        report.punch_out_time = now
        report.punch_out_type = DutyDay.PunchOutType.MANUAL
        report.end_location = {
            "lat": data.get("latitude", data.get("lat")),
            "lng": data.get("longitude", data.get("lng")),
            "address": data.get("address", ""),
        }
        hours = (now - report.punch_in_time).total_seconds() / 3600
        report.working_hours = Decimal(str(round(max(0, hours), 2)))
        report.save()
        events.emit("track.punched_out", agent_id=request.user.pk, date=report.date)
        return Response({"success": True, "time": now, "working_hours": report.working_hours})


class TrackLocationView(APIView):
    """Batch GPS upload. Points are attributed to the report of their LOCAL
    capture date (handles buffers flushed across midnight / after punch-out)."""

    permission_classes = [TrackModule]

    def post(self, request):
        payload = request.data
        raw_points = payload.get("points") if isinstance(payload, dict) and "points" in payload else [payload]
        # group by local capture date
        by_date: dict = {}
        for raw in raw_points:
            parsed = gps.parse_incoming_point(raw)
            if parsed is None:
                by_date.setdefault(None, []).append(("skip", raw))
                continue
            _, ts = parsed
            local_date = timezone.localtime(ts).date() if ts else timezone.localdate()
            by_date.setdefault(local_date, []).append(("ok", raw))

        accepted = skipped = 0
        for local_date, items in by_date.items():
            if local_date is None:
                skipped += len(items)
                continue
            report = (
                DutyDay.objects.filter(
                    agent=request.user, date=local_date,
                    punch_in_time__isnull=False, punch_out_time__isnull=True,
                ).first()
                or DutyDay.objects.filter(
                    agent=request.user, date=local_date, punch_in_time__isnull=False
                ).order_by("-id").first()
            )
            if report is None:
                skipped += len(items)
                continue
            a, s = services.ingest_points(report, [raw for _, raw in items])
            accepted += a
            skipped += s

        today_open = DutyDay.objects.filter(
            agent=request.user, date=timezone.localdate(),
            punch_in_time__isnull=False, punch_out_time__isnull=True,
        ).exists()
        return Response({
            "success": True, "accepted_points": accepted, "skipped_points": skipped,
            "session_closed": not today_open,
        })


class StatusView(APIView):
    permission_classes = [TrackModule]

    def get(self, request):
        report = DutyDay.objects.filter(agent=request.user, date=timezone.localdate()).first()
        if report is None:
            return Response({"isPunchedIn": False})
        return Response({
            "isPunchedIn": report.is_punched_in,
            "punchInTime": report.punch_in_time,
            "punchInLocation": (report.start_location or {}).get("address", ""),
            "punchOutTime": report.punch_out_time,
            "punchOutLocation": (report.end_location or {}).get("address", ""),
        })


class HeartbeatView(APIView):
    """App-liveness signal, distinct from GPS liveness (last_location_at)."""

    permission_classes = [TrackModule]

    def post(self, request):
        request.user.last_seen = timezone.now()
        request.user.save(update_fields=["last_seen", "updated_at"])
        return Response({"success": True})


class DeviceDiagnosticsView(APIView):
    permission_classes = [TrackModule]

    def post(self, request):
        payload = request.data
        events_in = payload.get("events") if isinstance(payload, dict) and "events" in payload else [payload]
        stored = 0
        for ev in events_in:
            if not isinstance(ev, dict) or not ev.get("event"):
                continue
            DeviceDiagnostic.objects.create(
                agent=request.user,
                event=str(ev.get("event"))[:40],
                detail=ev.get("detail") or {},
                client_time=ev.get("client_time"),
                device_model=str(ev.get("device_model", ""))[:120],
                os_version=str(ev.get("os_version", ""))[:60],
                app_version=str(ev.get("app_version", ""))[:40],
            )
            stored += 1
        return Response({"success": True, "stored": stored})


# --------------------------------------------------------------- manager views
class CurrentLocationView(APIView):
    permission_classes = [TrackModule]

    def get(self, request):
        agent_id = _as_int(request.query_params.get("agent_id"))
        if agent_id is None:
            return Response({"detail": "A numeric agent_id is required."}, status=400)
        visible = _visible_agent_ids(request.user)
        if visible is not None and agent_id not in visible:
            return Response({"detail": "Not permitted."}, status=403)
        report = (
            DutyDay.objects.filter(agent_id=agent_id).exclude(location_track=[])
            .order_by("-date").first()
        )
        if report is None or not report.location_track:
            return Response({"detail": "No location for agent."}, status=404)
        point = report.location_track[-1]
        return Response({
            "agent_id": agent_id, "agent_name": report.agent.full_name,
            "latitude": point.get("lat"), "longitude": point.get("lng"),
            "timestamp": point.get("timestamp"), "accuracy": point.get("accuracy"),
            "is_mocked": bool(point.get("is_mocked") or point.get("suspect")),
            "mock_detected": report.mock_detected,
        })


class DayRouteView(APIView):
    """Route replay — cleaned track for an agent/date."""

    permission_classes = [TrackModule]

    def get(self, request):
        agent_id = _as_int(request.query_params.get("agent_id"))
        date = request.query_params.get("date")
        if agent_id is None or not date:
            return Response({"detail": "A numeric agent_id and date are required."}, status=400)
        visible = _visible_agent_ids(request.user)
        if visible is not None and agent_id not in visible:
            return Response({"detail": "Not permitted."}, status=403)
        report = DutyDay.objects.filter(agent_id=agent_id, date=date).first()
        if report is None:
            return Response({"detail": "No track."}, status=404)
        cleaned, flagged = gps.clean_route(report.location_track)
        return Response({
            "agent_id": agent_id, "agent_name": report.agent.full_name, "date": date,
            "punch_in_time": report.punch_in_time, "punch_out_time": report.punch_out_time,
            "total_points": len(cleaned), "mock_detected": flagged > 0,
            "mock_point_count": flagged, "location_points": cleaned,
        })


class LiveAgentsView(APIView):
    """On-duty agents with their latest position — powers the live map."""

    permission_classes = [TrackModule]

    def get(self, request):
        visible = _visible_agent_ids(request.user)
        qs = DutyDay.objects.filter(
            date=timezone.localdate(), punch_in_time__isnull=False, punch_out_time__isnull=True,
        ).select_related("agent")
        if visible is not None:
            qs = qs.filter(agent_id__in=visible)
        now = timezone.now()
        threshold = TrackingSettings.get().offline_threshold_min
        agents = []
        for report in qs:
            point = report.location_track[-1] if report.location_track else None
            last_at = report.last_location_at
            online = bool(last_at and (now - last_at).total_seconds() / 60 <= threshold)
            agents.append({
                "agent_id": report.agent_id, "agent_name": report.agent.full_name,
                "lat": point.get("lat") if point else None,
                "lng": point.get("lng") if point else None,
                "last_location_at": last_at,
                "is_online": online,
                "mock_detected": report.mock_detected,
            })
        return Response({"as_of": now, "count": len(agents), "agents": agents})


class TrackingHealthView(APIView):
    """The 'what's broken' board — on-duty agents with device/GPS health."""

    permission_classes = [TrackModule]

    def get(self, request):
        visible = _visible_agent_ids(request.user)
        qs = DutyDay.objects.filter(
            date=timezone.localdate(), punch_in_time__isnull=False,
        ).select_related("agent")
        if visible is not None:
            qs = qs.filter(agent_id__in=visible)
        now = timezone.now()
        today = timezone.localdate()
        rows = []
        for report in qs:
            last_diag = (
                DeviceDiagnostic.objects.filter(agent_id=report.agent_id)
                .order_by("-created_at").first()
            )
            health = (
                DeviceDiagnostic.objects.filter(
                    agent_id=report.agent_id, event="punch_in_health", created_at__date=today
                ).order_by("-created_at").first()
            )
            hdetail = health.detail if health else {}
            watchdogs = DeviceDiagnostic.objects.filter(
                agent_id=report.agent_id, event="watchdog_restart", created_at__date=today
            ).count()
            last_at = report.last_location_at
            last_seen = report.agent.last_seen
            rows.append({
                "agent_id": report.agent_id, "agent_name": report.agent.full_name,
                "punched_in": report.punch_out_time is None,
                "last_location_at": last_at,
                "last_location_min_ago": int((now - last_at).total_seconds() // 60) if last_at else None,
                "last_seen": last_seen,
                "last_seen_min_ago": int((now - last_seen).total_seconds() // 60) if last_seen else None,
                "points_today": len(report.location_track or []),
                "mock_detected": report.mock_detected,
                "device_model": last_diag.device_model if last_diag else "",
                "os_version": last_diag.os_version if last_diag else "",
                "app_version": last_diag.app_version if last_diag else "",
                "battery_opt_granted": hdetail.get("battery_opt_granted"),
                "location_permission": hdetail.get("location_permission"),
                "location_accuracy": hdetail.get("location_accuracy"),
                "watchdog_restarts_today": watchdogs,
                "latest_event": last_diag.event if last_diag else "",
                "latest_event_at": last_diag.created_at if last_diag else None,
            })
        rows.sort(key=lambda r: (r["last_location_min_ago"] is None, r["last_location_min_ago"] or 0), reverse=True)
        return Response({"as_of": now, "count": len(rows), "agents": rows})


class AdminAttendanceView(APIView):
    """Attendance grid for a date — every agent (present + absent)."""

    permission_classes = [TrackModule]

    def get(self, request):
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)
        date = request.query_params.get("date") or timezone.localdate().isoformat()
        visible = _visible_agent_ids(request.user)
        agents = TenantUser.objects.filter(is_active=True)
        if visible is not None:
            agents = agents.filter(pk__in=visible)
        # only field agents on the attendance grid
        agents = [u for u in agents if u.role and u.role.slug in {"field_agent", "sales_agent"}]
        reports = {
            r.agent_id: r for r in DutyDay.objects.filter(agent_id__in=[u.pk for u in agents], date=date)
        }
        rows = []
        for user in agents:
            r = reports.get(user.pk)
            rows.append({
                "agent_id": user.pk, "agent_name": user.full_name,
                "profile_image": user.profile_image,
                "record_id": r.id if r else None,
                "punch_in_time": r.punch_in_time if r else None,
                "punch_out_time": r.punch_out_time if r else None,
                "working_hours": r.working_hours if r else 0,
                "punch_out_type": r.punch_out_type if r else "",
                "last_seen": user.last_seen,
                "last_location_at": r.last_location_at if r else None,
                "mock_detected": r.mock_detected if r else False,
                "has_edit_logs": bool(r.edit_logs) if r else False,
                "allowance_basis": r.allowance_basis if r else "",
            })
        return Response({"date": date, "count": len(rows), "agents": rows})


class AdminCheckoutView(APIView):
    permission_classes = [TrackModule]

    def post(self, request, pk):
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)
        report = DutyDay.objects.filter(pk=pk).select_related("agent").first()
        if report is None:
            return Response({"detail": "Not found."}, status=404)
        visible = _visible_agent_ids(request.user)
        if visible is not None and report.agent_id not in visible:
            return Response({"detail": "Not permitted."}, status=403)
        if report.punch_in_time is None:
            return Response({"detail": "Agent not punched in."}, status=400)
        if report.punch_out_time:
            return Response({"message": "Already punched out"})
        now = timezone.now()
        report.punch_out_time = now
        report.punch_out_type = DutyDay.PunchOutType.MANUAL
        report.working_hours = Decimal(str(round(max(0, (now - report.punch_in_time).total_seconds() / 3600), 2)))
        report.edit_logs.append({
            "edited_by": request.user.full_name, "edited_by_id": request.user.pk,
            "edited_at": now.isoformat(), "changes": {"punch_out": {"old": None, "new": now.isoformat()}},
        })
        report.save()
        return Response({"success": True, "checked_out_by": request.user.full_name})


class RouteHistoryView(APIView):
    permission_classes = [TrackModule]

    def get(self, request):
        visible = _visible_agent_ids(request.user)
        qs = RouteHistory.objects.select_related("agent")
        if visible is not None:
            qs = qs.filter(agent_id__in=visible)
        agent_id = request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent_id=agent_id)
        date_from, date_to = request.query_params.get("date_from"), request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return Response(RouteHistorySerializer(qs[:200], many=True).data)


class TrackingSettingsView(APIView):
    permission_classes = [TrackModule]

    def get(self, request):
        return Response(TrackingSettingsSerializer(TrackingSettings.get()).data)

    def patch(self, request):
        if not _is_admin(request.user):
            return Response({"detail": "Admin access required."}, status=403)
        serializer = TrackingSettingsSerializer(TrackingSettings.get(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminAttendanceListView(AdminAttendanceView):
    """Portal alias for the attendance grid.

    Returns a BARE ARRAY, not the `{date, count, agents}` envelope. The ported
    attendance export does `Array.isArray(res) ? res : []`, so an envelope here
    would silently produce an empty sheet — every agent marked absent — rather
    than an error anyone would notice.
    """

    def get(self, request):
        response = super().get(request)
        if response.status_code != 200:
            return response
        return Response(response.data["agents"])


class AdminAttendanceEditView(APIView):
    """Manager correction of a duty day — the record a manager fixes when an
    agent forgot to punch. Every edit is appended to `edit_logs`, so a corrected
    day never looks like a day that was recorded correctly."""

    permission_classes = [TrackModule]

    def patch(self, request, pk=None):
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)

        if pk is not None:
            report = DutyDay.objects.filter(pk=pk).select_related("agent").first()
            if report is None:
                return Response({"detail": "Not found."}, status=404)
        else:
            agent_id, date = request.data.get("agent_id"), request.data.get("date")
            if not agent_id or not date:
                return Response({"detail": "agent_id and date are required."}, status=400)
            agent = TenantUser.objects.filter(pk=agent_id, is_active=True).first()
            if agent is None:
                return Response({"detail": "Agent not found."}, status=404)
            report, _ = DutyDay.objects.get_or_create(agent=agent, date=date)

        visible = _visible_agent_ids(request.user)
        if visible is not None and report.agent_id not in visible:
            return Response({"detail": "That agent is not on your team."}, status=403)

        status_in = str(request.data.get("status", "present")).lower()
        changes = {
            "punch_in_time": str(report.punch_in_time or ""),
            "punch_out_time": str(report.punch_out_time or ""),
            "working_hours": float(report.working_hours or 0),
        }

        if status_in == "absent":
            report.punch_in_time = None
            report.punch_out_time = None
            report.punch_out_type = ""
            report.working_hours = 0
        else:
            punch_in = request.data.get("punch_in_time")
            if not punch_in:
                return Response({"punch_in_time": "required when marking present."}, status=400)
            punch_out = request.data.get("punch_out_time") or None
            report.punch_in_time = punch_in
            report.punch_out_time = punch_out
            report.punch_out_type = DutyDay.PunchOutType.MANUAL if punch_out else ""
            report.working_hours = services.working_hours_between(punch_in, punch_out, report.date)
            if report.working_hours is None:
                return Response({"punch_out_time": "must be after the punch-in time."}, status=400)

        report.edit_logs = list(report.edit_logs or []) + [{
            "at": timezone.now().isoformat(),
            "by": request.user.full_name or request.user.email,
            "status": status_in, "previous": changes,
        }]
        report.save(update_fields=["punch_in_time", "punch_out_time", "punch_out_type",
                                   "working_hours", "edit_logs"])
        return Response({
            "id": report.pk, "agent_id": report.agent_id, "date": report.date,
            "punch_in_time": report.punch_in_time, "punch_out_time": report.punch_out_time,
            "punch_out_type": report.punch_out_type, "working_hours": report.working_hours,
            "edit_logs": report.edit_logs,
        })


class AdminAttendanceLogsView(APIView):
    """The edit trail for one duty day."""

    permission_classes = [TrackModule]

    def get(self, request, pk):
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)
        report = DutyDay.objects.filter(pk=pk).first()
        if report is None:
            return Response({"detail": "Not found."}, status=404)
        visible = _visible_agent_ids(request.user)
        if visible is not None and report.agent_id not in visible:
            return Response({"detail": "That agent is not on your team."}, status=403)
        return Response({"record_id": report.pk, "logs": report.edit_logs or []})
