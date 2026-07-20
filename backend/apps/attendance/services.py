"""
ATT domain services. Attendance is one row per user per day; leave days exclude
weekends and holidays so a request never over-counts.
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import Holiday, LeaveRequest, LeaveType, OfficeAttendance

logger = logging.getLogger("kaysetu.attendance")


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))


def _as_date(value, field):
    """Dates arrive from the API as ISO strings — coerce before any date math."""
    from datetime import date as date_cls

    if isinstance(value, date_cls):
        return value
    try:
        return date_cls.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ValidationError({field: f"invalid date: {value!r}"})


def check_in(user, *, at=None, notes=""):
    """Open today's attendance row. Re-checking in the same day is a no-op."""
    now = at or timezone.now()
    today = timezone.localdate(now)
    with _tenant_atomic():
        row, created = OfficeAttendance.objects.select_for_update().get_or_create(
            user=user, date=today, defaults={"check_in_time": now, "notes": notes},
        )
        if not created and row.check_in_time is None:
            row.check_in_time = now
            row.save(update_fields=["check_in_time"])
    return row


def check_out(user, *, at=None, kind=OfficeAttendance.CheckOutType.MANUAL, actor=None):
    now = at or timezone.now()
    today = timezone.localdate(now)
    with _tenant_atomic():
        row = OfficeAttendance.objects.select_for_update().filter(user=user, date=today).first()
        if row is None or row.check_in_time is None:
            raise ValidationError("You have not checked in today.")
        if row.check_out_time is not None:
            raise ValidationError("You have already checked out today.")
        if now < row.check_in_time:
            raise ValidationError("Check-out cannot be before check-in.")
        row.check_out_time = now
        row.check_out_type = kind
        row.checked_out_by = actor
        row.working_hours = Decimal(
            str(round((now - row.check_in_time).total_seconds() / 3600, 2))
        )
        row.save(update_fields=["check_out_time", "check_out_type", "checked_out_by", "working_hours"])
    return row


def auto_close_open_days(*, before_date=None):
    """Close attendance rows left open on earlier days (a scheduled job)."""
    cutoff = before_date or timezone.localdate()
    closed = 0
    with _tenant_atomic():
        stale = OfficeAttendance.objects.select_for_update().filter(
            date__lt=cutoff, check_in_time__isnull=False, check_out_time__isnull=True,
        )
        for row in stale:
            end = timezone.make_aware(
                timezone.datetime.combine(row.date, timezone.datetime.min.time())
            ) + timedelta(hours=23, minutes=59)
            row.check_out_time = end
            row.check_out_type = OfficeAttendance.CheckOutType.AUTO
            row.working_hours = Decimal(
                str(round((end - row.check_in_time).total_seconds() / 3600, 2))
            )
            row.save(update_fields=["check_out_time", "check_out_type", "working_hours"])
            closed += 1
    return closed


def working_days_between(from_date, to_date):
    """Calendar days in the range excluding weekends and configured holidays."""
    from_date = _as_date(from_date, "from_date")
    to_date = _as_date(to_date, "to_date")
    holidays = set(
        Holiday.objects.filter(date__gte=from_date, date__lte=to_date, is_optional=False)
        .values_list("date", flat=True)
    )
    days, cursor = Decimal("0"), from_date
    while cursor <= to_date:
        if cursor.weekday() < 5 and cursor not in holidays:
            days += 1
        cursor += timedelta(days=1)
    return days


def apply_for_leave(user, *, leave_type_id, from_date, to_date, reason=""):
    from_date = _as_date(from_date, "from_date")
    to_date = _as_date(to_date, "to_date")
    if to_date < from_date:
        raise ValidationError({"to_date": "cannot be before the start date."})
    leave_type = LeaveType.objects.filter(pk=leave_type_id, is_active=True).first()
    if leave_type is None:
        raise ValidationError({"leave_type": "unknown or inactive leave type."})

    with _tenant_atomic():
        clash = LeaveRequest.objects.filter(
            user=user, status__in=[LeaveRequest.Status.PENDING, LeaveRequest.Status.APPROVED],
            from_date__lte=to_date, to_date__gte=from_date,
        ).exists()
        if clash:
            raise ValidationError("You already have leave covering part of that period.")
        return LeaveRequest.objects.create(
            user=user, leave_type=leave_type, from_date=from_date, to_date=to_date,
            days=working_days_between(from_date, to_date), reason=reason,
        )


def decide_leave(request_obj, *, approve, actor=None, note=""):
    with _tenant_atomic():
        locked = LeaveRequest.objects.select_for_update().get(pk=request_obj.pk)
        if locked.status != LeaveRequest.Status.PENDING:
            raise ValidationError(f"This request is already {locked.get_status_display().lower()}.")
        locked.status = (LeaveRequest.Status.APPROVED if approve
                         else LeaveRequest.Status.REJECTED)
        locked.decision_note = note
        locked.decided_by = actor
        locked.decided_at = timezone.now()
        locked.save(update_fields=["status", "decision_note", "decided_by", "decided_at"])
    request_obj.refresh_from_db()
    return request_obj


def cancel_leave(request_obj, *, actor=None):
    with _tenant_atomic():
        locked = LeaveRequest.objects.select_for_update().get(pk=request_obj.pk)
        if locked.status not in (LeaveRequest.Status.PENDING, LeaveRequest.Status.APPROVED):
            raise ValidationError("Only a pending or approved request can be cancelled.")
        if locked.from_date <= timezone.localdate() and locked.status == LeaveRequest.Status.APPROVED:
            raise ValidationError("Approved leave that has already started cannot be cancelled.")
        locked.status = LeaveRequest.Status.CANCELLED
        locked.decided_by = actor
        locked.save(update_fields=["status", "decided_by"])
    request_obj.refresh_from_db()
    return request_obj
