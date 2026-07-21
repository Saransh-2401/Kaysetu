"""ATT API — Attendance & Leave. Gated by HasModule("ATT"). /api/t/att/."""
from datetime import date
from decimal import Decimal

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.permissions import HasModule

from . import services
from .models import Holiday, LeaveRequest, LeaveType, OfficeAttendance
from .serializers import (
    HolidaySerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    OfficeAttendanceSerializer,
)

AttModule = HasModule("ATT")
MANAGER_ROLES = {"admin", "hr_manager", "sales_manager", "field_manager"}


def _is_manager(user) -> bool:
    return bool(user and (user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)))


class IsAttManager(BasePermission):
    message = "Manager access required."

    def has_permission(self, request, view):
        return _is_manager(request.user)


class AttPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 2000


def _scope(qs, user, field="user_id"):
    """Everyone sees their own rows; a manager sees the whole team."""
    if _is_manager(user):
        return qs
    return qs.filter(**{field: user.pk})


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AttModule]
    serializer_class = OfficeAttendanceSerializer
    pagination_class = AttPagination

    def get_queryset(self):
        qs = OfficeAttendance.objects.select_related("user")
        params = self.request.query_params
        if params.get("user"):
            qs = qs.filter(user_id=params["user"])
        if params.get("from_date"):
            qs = qs.filter(date__gte=params["from_date"])
        if params.get("to_date"):
            qs = qs.filter(date__lte=params["to_date"])
        return _scope(qs, self.request.user)

    # The imported portal punch widget reads a flat status shape
    # ({applicable, checked_in, checked_out, ...}) rather than the model row —
    # serve exactly that so the screen works unchanged.
    @staticmethod
    def _status(row):
        return {
            "applicable": True,
            "checked_in": bool(row and row.check_in_time),
            "checked_out": bool(row and row.check_out_time),
            "check_in_time": row.check_in_time if row else None,
            "check_out_time": row.check_out_time if row else None,
            "check_out_type": (row.check_out_type or None) if row else None,
            "working_hours": float(row.working_hours) if row else 0.0,
        }

    @action(detail=False, methods=["post"], url_path="check-in")
    def check_in(self, request):
        row = services.check_in(request.user, notes=request.data.get("notes", ""))
        return Response({"success": True, "check_in_time": row.check_in_time,
                         **self._status(row)}, status=201)

    @action(detail=False, methods=["post"], url_path="check-out")
    def check_out(self, request):
        row = services.check_out(request.user, actor=request.user)
        return Response({"success": True, "check_out_time": row.check_out_time,
                         "working_hours": float(row.working_hours), **self._status(row)})

    @action(detail=False, methods=["get"])
    def today(self, request):
        row = OfficeAttendance.objects.filter(user=request.user, date=timezone.localdate()).first()
        return Response(self._status(row))

    # ── Admin office-attendance grid ────────────────────────────────────────
    # The ported portal screen reads a flat per-row shape and drives manual
    # checkout / edit off it. These mirror the field-sales admin endpoints so
    # the Office Staff tab works unchanged (served here + aliased to the old
    # /office-attendance/… paths in urls.py).
    @staticmethod
    def _record(row):
        u = row.user
        return {
            "id": row.id,
            "user_id": u.pk,
            "user_name": u.full_name or u.email,
            "user_role": (u.role.slug if u.role_id and u.role else ""),
            "profile_image": u.profile_image or None,
            "check_in_time": row.check_in_time,
            "check_out_time": row.check_out_time,
            "working_hours": float(row.working_hours),
            "check_out_type": (row.check_out_type or None),
            "checked_out_by_name": (row.checked_out_by.full_name if row.checked_out_by_id else None),
            "checked_in": bool(row.check_in_time),
            "checked_out": bool(row.check_out_time),
            "has_edit_logs": False,  # office attendance keeps no edit history yet
        }

    def _require_manager(self, request):
        if not _is_manager(request.user):
            self.permission_denied(request, message="Manager access required.")

    @staticmethod
    def _aware(value):
        """Portal sends local ISO strings — coerce to an aware datetime."""
        dt = parse_datetime(value) if value else None
        if dt is not None and timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return dt

    @action(detail=False, methods=["get"], url_path="by-date")
    def by_date(self, request):
        self._require_manager(request)
        day = request.query_params.get("date") or str(timezone.localdate())
        rows = (
            OfficeAttendance.objects
            .select_related("user", "user__role", "checked_out_by")
            .filter(date=day)
            .order_by("user__full_name")
        )
        return Response([self._record(r) for r in rows])

    @action(detail=True, methods=["post"], url_path="admin-checkout")
    def admin_checkout(self, request, pk=None):
        self._require_manager(request)
        row = self.get_object()
        if row.check_in_time is None:
            return Response({"detail": "This staff member has not checked in."}, status=400)
        if row.check_out_time is not None:
            return Response({"detail": "Already checked out."}, status=400)
        # Close at "now" for today; for an older open row, close at end of that day.
        if row.date == timezone.localdate():
            end = timezone.now()
        else:
            end = timezone.make_aware(
                timezone.datetime.combine(row.date, timezone.datetime.min.time())
            ).replace(hour=23, minute=59)
        if end < row.check_in_time:
            end = row.check_in_time
        row.check_out_time = end
        row.check_out_type = OfficeAttendance.CheckOutType.ADMIN
        row.checked_out_by = request.user
        row.working_hours = Decimal(str(round((end - row.check_in_time).total_seconds() / 3600, 2)))
        row.save(update_fields=["check_out_time", "check_out_type", "checked_out_by", "working_hours"])
        return Response(self._record(row))

    @action(detail=True, methods=["patch"], url_path="admin-edit")
    def admin_edit(self, request, pk=None):
        self._require_manager(request)
        row = self.get_object()
        if request.data.get("status") == "absent":
            row.check_in_time = None
            row.check_out_time = None
            row.check_out_type = ""
            row.working_hours = Decimal("0")
            row.checked_out_by = None
        else:
            ci = self._aware(request.data.get("check_in_time"))
            if ci is None:
                return Response({"detail": "check_in_time is required."}, status=400)
            co = self._aware(request.data.get("check_out_time"))
            row.check_in_time = ci
            if co is not None:
                if co < ci:
                    return Response({"detail": "Check-out cannot be before check-in."}, status=400)
                row.check_out_time = co
                row.check_out_type = row.check_out_type or OfficeAttendance.CheckOutType.MANUAL
                row.working_hours = Decimal(str(round((co - ci).total_seconds() / 3600, 2)))
            else:
                row.check_out_time = None
                row.check_out_type = ""
                row.working_hours = Decimal("0")
        row.save()
        return Response(self._record(row))

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        # Edit history is not tracked for office attendance yet — the portal
        # only opens this when has_edit_logs is true, so an empty list is safe.
        return Response([])


class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    pagination_class = AttPagination
    http_method_names = ["get", "post", "head", "options"]

    MANAGER_ACTIONS = {"approve", "reject"}

    def get_permissions(self):
        if self.action in self.MANAGER_ACTIONS:
            return [AttModule(), IsAttManager()]
        return [AttModule()]

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related("user", "leave_type", "decided_by")
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("user"):
            qs = qs.filter(user_id=params["user"])
        return _scope(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        leave = services.apply_for_leave(
            request.user,
            leave_type_id=request.data.get("leave_type"),
            from_date=request.data.get("from_date"),
            to_date=request.data.get("to_date"),
            reason=request.data.get("reason", ""),
        )
        return Response(LeaveRequestSerializer(leave).data, status=201)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        leave = services.decide_leave(self.get_object(), approve=True, actor=request.user,
                                      note=request.data.get("note", ""))
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        note = request.data.get("note", "")
        if not note:
            return Response({"detail": "A reason is required."}, status=400)
        leave = services.decide_leave(self.get_object(), approve=False, actor=request.user, note=note)
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        leave = self.get_object()
        if leave.user_id != request.user.pk and not _is_manager(request.user):
            return Response({"detail": "You can only cancel your own leave."}, status=403)
        return Response(LeaveRequestSerializer(services.cancel_leave(leave, actor=request.user)).data)


class LeaveTypeViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveTypeSerializer
    pagination_class = AttPagination
    queryset = LeaveType.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [AttModule(), IsAttManager()]
        return [AttModule()]


class HolidayViewSet(viewsets.ModelViewSet):
    serializer_class = HolidaySerializer
    pagination_class = AttPagination
    queryset = Holiday.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [AttModule(), IsAttManager()]
        return [AttModule()]


class WorkingDaysView(APIView):
    """Working days in a range (weekends + holidays excluded) — used by TA/payroll."""

    permission_classes = [AttModule]

    def get(self, request):
        def _parse(value):
            try:
                return date.fromisoformat(value)
            except (TypeError, ValueError):
                return None

        start = _parse(request.query_params.get("from_date"))
        end = _parse(request.query_params.get("to_date"))
        if start is None or end is None or end < start:
            return Response({"detail": "valid from_date and to_date are required."}, status=400)
        return Response({"from_date": str(start), "to_date": str(end),
                         "working_days": float(services.working_days_between(start, end))})
