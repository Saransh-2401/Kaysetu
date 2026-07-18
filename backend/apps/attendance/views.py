"""ATT API — Attendance & Leave. Gated by HasModule("ATT"). /api/t/att/."""
from datetime import date

from django.utils import timezone
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

    @action(detail=False, methods=["post"], url_path="check-in")
    def check_in(self, request):
        row = services.check_in(request.user, notes=request.data.get("notes", ""))
        return Response(OfficeAttendanceSerializer(row).data, status=201)

    @action(detail=False, methods=["post"], url_path="check-out")
    def check_out(self, request):
        row = services.check_out(request.user, actor=request.user)
        return Response(OfficeAttendanceSerializer(row).data)

    @action(detail=False, methods=["get"])
    def today(self, request):
        row = OfficeAttendance.objects.filter(user=request.user, date=timezone.localdate()).first()
        return Response(OfficeAttendanceSerializer(row).data if row else {})


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
