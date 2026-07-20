"""
TRACK domain services: batch GPS ingest + the nightly/periodic maintenance
jobs (offline detection, auto punch-out, route rollup).

Cross-module effects go through the foundation EVENT BUS (events.emit), never a
direct import — so a manager-notification module can subscribe later, and
standalone TRACK just no-ops. visit_count for the route rollup is PULLED from
the FIELD module via the capability registry (0 when FIELD absent).
"""
from decimal import Decimal

from django.utils import timezone

from apps.foundation.integration import capabilities, events

from . import gps
from .models import DutyDay, RouteHistory, TrackingSettings


def ingest_points(report: DutyDay, raw_points: list) -> tuple[int, int]:
    """Parse, gate, append, sort, re-flag, compact one batch into a report.
    Returns (accepted, skipped). Re-arms offline state on a fresh point."""
    accepted, skipped, newest_ts = 0, 0, None
    mocked_in_batch = 0
    for raw in raw_points:
        parsed = gps.parse_incoming_point(raw)
        if parsed is None:
            skipped += 1
            continue
        point, ts = parsed
        report.location_track.append(point)
        accepted += 1
        if point["is_mocked"]:
            mocked_in_batch += 1
        if ts and (newest_ts is None or ts > newest_ts):
            newest_ts = ts

    if accepted == 0:
        return 0, skipped

    cleaned, flagged = gps.clean_route(report.location_track)
    report.location_track = cleaned
    report.mock_point_count += mocked_in_batch
    report.mock_detected = flagged > 0
    report.distance_traveled_km = Decimal(str(gps.route_distance_km(cleaned)))
    if newest_ts:
        prev = report.last_location_at
        report.last_location_at = max(prev, newest_ts) if prev else newest_ts

    # Only a LIVE point (recent) means the agent is back online. A stale
    # offline-buffer flush must NOT clear the offline flag or fire back-online,
    # or flag_offline_agents would re-fire and managers get alert storms.
    threshold = TrackingSettings.get().offline_threshold_min
    is_live = bool(newest_ts and newest_ts > timezone.now() - timezone.timedelta(minutes=threshold))
    was_offline = report.offline_alert_sent_at is not None
    if is_live:
        report.offline_alert_sent_at = None
    report.save()

    events.emit("track.location_recorded", agent_id=report.agent_id, date=report.date)
    if was_offline and is_live:
        events.emit("track.back_online", agent_id=report.agent_id, date=report.date)
    return accepted, skipped


# ----------------------------------------------------------------- maintenance
def flag_offline_agents(now=None) -> list[int]:
    """Alert managers about agents whose GPS went stale while on duty. Emits
    'track.went_offline' (a notifier module subscribes; standalone = no-op).
    Deduped by offline_alert_sent_at. Returns agent ids newly flagged."""
    now = now or timezone.now()
    threshold = TrackingSettings.get().offline_threshold_min
    stale_before = now - timezone.timedelta(minutes=threshold)
    flagged = []
    open_reports = DutyDay.objects.filter(
        date=timezone.localdate(), punch_in_time__isnull=False, punch_out_time__isnull=True,
        offline_alert_sent_at__isnull=True,
    ).select_related("agent")
    for report in open_reports:
        reference = report.last_location_at or report.punch_in_time
        if reference is None or reference > stale_before:
            continue  # still fresh
        gap_min = int((now - reference).total_seconds() // 60)
        app_alive = bool(report.agent.last_seen and report.agent.last_seen > stale_before)
        report.offline_alert_sent_at = now
        report.save(update_fields=["offline_alert_sent_at", "updated_at"])
        events.emit(
            "track.went_offline",
            agent_id=report.agent_id,
            manager_id=report.agent.reports_to_id,
            gap_min=gap_min,
            app_alive=app_alive,
        )
        flagged.append(report.agent_id)
    return flagged


def auto_punch_out(target_date=None) -> int:
    """Close reports left open past the tenant's auto-punchout time. Returns count."""
    settings = TrackingSettings.get()
    if not settings.auto_punchout_enabled:
        return 0
    day = target_date or (timezone.localdate() - timezone.timedelta(days=1))
    end_time = settings.auto_punchout_time
    count = 0
    for report in DutyDay.objects.filter(
        date=day, punch_in_time__isnull=False, punch_out_time__isnull=True
    ):
        checkout_dt = timezone.make_aware(
            timezone.datetime.combine(day, end_time), timezone.get_current_timezone()
        )
        if checkout_dt < report.punch_in_time:
            checkout_dt = report.punch_in_time
        report.punch_out_time = checkout_dt
        report.punch_out_type = DutyDay.PunchOutType.AUTO
        hours = (checkout_dt - report.punch_in_time).total_seconds() / 3600
        report.working_hours = Decimal(str(round(max(0, hours), 2)))
        report.save()
        count += 1
        events.emit("track.day_closed", agent_id=report.agent_id, date=day, auto=True)
    return count


def build_route_histories(target_date=None) -> int:
    """Roll up each agent's cleaned route + distance for a day. visit_count is
    pulled from FIELD via capability (0 if FIELD not entitled/installed)."""
    day = target_date or (timezone.localdate() - timezone.timedelta(days=1))
    count = 0
    for report in DutyDay.objects.filter(date=day, punch_in_time__isnull=False):
        cleaned, _ = gps.clean_route(report.location_track)
        routes = [
            {"lat": p["lat"], "lng": p["lng"], "timestamp": p.get("timestamp")}
            for p in cleaned
            if p.get("lat") is not None and p.get("lng") is not None
        ]
        distance = Decimal(str(gps.route_distance_km(cleaned)))
        visit_count = capabilities.call(
            "field.visit_count", report.agent_id, day, default=0
        ) or 0
        RouteHistory.objects.update_or_create(
            agent_id=report.agent_id, date=day,
            defaults={
                "routes": routes, "distance_km": distance,
                "visit_count": visit_count, "status": "completed",
            },
        )
        count += 1
    return count


def working_hours_between(punch_in, punch_out, day=None):
    """Hours between two punches, for the manager-correction path.

    Accepts datetimes or ISO strings (the edit form posts strings). Returns
    Decimal hours, 0 when the day is still open, or None when the punches are
    out of order — the caller turns that into a 400 rather than storing a
    negative day.
    """
    from django.utils.dateparse import parse_datetime, parse_time

    def _coerce(value):
        if value in (None, ""):
            return None
        if isinstance(value, str):
            parsed = parse_datetime(value)
            if parsed is None:
                # A bare "09:30" is anchored to the day being edited.
                clock = parse_time(value)
                if clock is None or day is None:
                    return None
                parsed = timezone.datetime.combine(day, clock)
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed
        return value

    start, end = _coerce(punch_in), _coerce(punch_out)
    if start is None:
        return None
    if end is None:
        return Decimal("0")          # punched in, still on duty
    if end < start:
        return None
    return Decimal(str(round((end - start).total_seconds() / 3600, 2)))
