"""Capabilities ATT provides — office attendance facts for payroll/TA consumers."""


def _present_days(user_id, from_date, to_date):
    """Days the user actually attended the office in the range."""
    from .models import OfficeAttendance

    return OfficeAttendance.objects.filter(
        user_id=user_id, date__gte=from_date, date__lte=to_date, check_in_time__isnull=False,
    ).count()


def _office_hours(user_id, from_date, to_date):
    from django.db.models import Sum

    from .models import OfficeAttendance

    total = OfficeAttendance.objects.filter(
        user_id=user_id, date__gte=from_date, date__lte=to_date,
    ).aggregate(s=Sum("working_hours"))["s"]
    return float(total or 0)


def _on_leave(user_id, on_date):
    from .models import LeaveRequest

    return LeaveRequest.objects.filter(
        user_id=user_id, status=LeaveRequest.Status.APPROVED,
        from_date__lte=on_date, to_date__gte=on_date,
    ).exists()


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("attendance.present_days", "ATT", _present_days)
    capabilities.provide("attendance.office_hours", "ATT", _office_hours)
    capabilities.provide("attendance.on_leave", "ATT", _on_leave)
