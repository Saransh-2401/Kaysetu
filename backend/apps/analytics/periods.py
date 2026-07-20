"""
Date-window parsing shared by every analytics endpoint.

The ported screens speak in human range names ("This Quarter", "This Year (FY)")
AND in explicit from/to dates, sometimes both. Explicit dates always win — a
screen that sends them has already decided the window.
"""
from datetime import date, timedelta

from django.utils import timezone

# India's fiscal year starts in April. Overridable per tenant later; hardcoding
# it here would be wrong for a non-Indian tenant, so it reads OrgSettings.
DEFAULT_FY_START_MONTH = 4


def _fy_start_month():
    from apps.foundation.models import OrgSettings

    settings = OrgSettings.objects.filter(pk=1).first()
    return getattr(settings, "fy_start_month", None) or DEFAULT_FY_START_MONTH


def parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def fy_start(day=None):
    """First day of the fiscal year containing `day`.

    Reads OrgSettings rather than assuming January — the tenants this is built
    for run an April-March year, so a January assumption gets the "year to
    date" figure wrong for ten months out of twelve.
    """
    day = day or timezone.localdate()
    month = _fy_start_month()
    year = day.year if day.month >= month else day.year - 1
    return date(year, month, 1)


def resolve(params, *, default_range="This Month"):
    """Return (from_date, to_date) for a request's query params.

    A malformed date is treated as absent rather than raising: a dashboard that
    500s because someone typed a bad date in a URL is worse than one that shows
    its default window.
    """
    explicit_from = parse_date(params.get("from_date"))
    explicit_to = parse_date(params.get("to_date"))
    if explicit_from and explicit_to:
        if explicit_to < explicit_from:            # swapped by the caller
            explicit_from, explicit_to = explicit_to, explicit_from
        return explicit_from, explicit_to

    today = timezone.localdate()
    name = (params.get("range") or default_range).strip()
    fy_month = _fy_start_month()

    if name == "Today":
        return today, today
    if name == "This Week":
        return today - timedelta(days=today.weekday()), today
    if name == "This Quarter":
        quarter_start_month = 1 + 3 * ((today.month - 1) // 3)
        return today.replace(month=quarter_start_month, day=1), today
    if name in ("This Year (FY)", "Year to Date", "YTD"):
        year = today.year if today.month >= fy_month else today.year - 1
        return date(year, fy_month, 1), today
    if name == "Last Year (FY)":
        year = today.year - 1 if today.month >= fy_month else today.year - 2
        start = date(year, fy_month, 1)
        return start, _add_months(start, 12) - timedelta(days=1)
    # "This Month" and anything unrecognised
    return today.replace(day=1), today


def previous_window(from_date, to_date):
    """The equally-long window immediately before this one, for % change."""
    span = (to_date - from_date).days
    prev_to = from_date - timedelta(days=1)
    return prev_to - timedelta(days=span), prev_to


def _add_months(day, months):
    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    return date(year, month_index % 12 + 1, 1)


def month_buckets(from_date, to_date, *, cap=36, rolling=6):
    """Calendar-month buckets across the window.

    Without an explicit window the screens want the last `rolling` months
    regardless of the range, which is why this takes both.
    """
    if from_date is None or to_date is None:
        today = timezone.localdate()
        first = today.replace(day=1)
        return [_add_months(first, -i) for i in range(rolling - 1, -1, -1)]
    buckets, cursor = [], from_date.replace(day=1)
    while cursor <= to_date and len(buckets) < cap:
        buckets.append(cursor)
        cursor = _add_months(cursor, 1)
    return buckets


def bucket_end(month_start):
    return _add_months(month_start, 1) - timedelta(days=1)


def pct_change(current, previous):
    """Percentage change, with the divide-by-zero case answered honestly:
    growth from nothing is 100% when there is now something, else 0."""
    current, previous = float(current or 0), float(previous or 0)
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)
