"""
Capabilities the TRACK module PROVIDES to other modules via the foundation
registry. A consumer (Travel Allowance, Field Sales, analytics) calls these by
string name and never imports apps.tracking. Each is gated on the TRACK
package being entitled for the active tenant.

All provider bodies are lazy and run inside an active tenant context.
"""


def _distance_for(agent_id, date):
    """Kilometres travelled by an agent on a date — for Travel Allowance."""
    from .models import DutyDay, RouteHistory

    rh = RouteHistory.objects.filter(agent_id=agent_id, date=date).first()
    if rh is not None:
        return float(rh.distance_km)
    dd = DutyDay.objects.filter(agent_id=agent_id, date=date).first()
    return float(dd.distance_traveled_km) if dd else 0.0


def _day_summary(agent_id, date):
    """Attendance + tracking summary — for analytics / FIELD."""
    from .models import DutyDay

    dd = DutyDay.objects.filter(agent_id=agent_id, date=date).first()
    if dd is None:
        return None
    return {
        "punched_in": dd.punch_in_time is not None,
        "punch_in_time": dd.punch_in_time,
        "punch_out_time": dd.punch_out_time,
        "working_hours": float(dd.working_hours),
        "distance_km": float(dd.distance_traveled_km),
        "allowance_basis": dd.allowance_basis or None,
        "on_duty": dd.is_punched_in,
    }


def _last_location(agent_id):
    """Most recent GPS point for an agent — for a live map / visit verification."""
    from .models import DutyDay

    dd = (
        DutyDay.objects.filter(agent_id=agent_id)
        .exclude(location_track=[])
        .order_by("-date")
        .first()
    )
    if dd is None or not dd.location_track:
        return None
    point = dd.location_track[-1]
    return {
        "lat": point.get("lat"),
        "lng": point.get("lng"),
        "at": point.get("timestamp"),
        "is_mocked": bool(point.get("is_mocked") or point.get("suspect")),
    }


def _is_on_duty(agent_id):
    from .models import DutyDay
    from django.utils import timezone

    return DutyDay.objects.filter(
        agent_id=agent_id, date=timezone.localdate(), punch_in_time__isnull=False,
        punch_out_time__isnull=True,
    ).exists()


def _month_hours(agent_id, year, month):
    """Total working hours for an agent in a month — for FIELD target performance
    (the login-hours actual that used to couple to DailyReport directly)."""
    from django.db.models import Sum

    from .models import DutyDay

    total = DutyDay.objects.filter(
        agent_id=agent_id, date__year=year, date__month=month
    ).aggregate(s=Sum("working_hours"))["s"]
    return float(total or 0)


def register_all():
    """Called from TrackingConfig.ready() at startup (no DB access here)."""
    from apps.foundation.integration import capabilities

    capabilities.provide("tracking.distance_for", "TRACK", _distance_for)
    capabilities.provide("tracking.day_summary", "TRACK", _day_summary)
    capabilities.provide("tracking.last_location", "TRACK", _last_location)
    capabilities.provide("tracking.is_on_duty", "TRACK", _is_on_duty)
    capabilities.provide("tracking.month_hours", "TRACK", _month_hours)
