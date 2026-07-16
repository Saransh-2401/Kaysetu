"""
GPS math + track cleaning — ported verbatim in behaviour from the previous
platform's field_sales.views helpers. Pure functions; no DB, no imports of
other modules.

Pipeline for a batch of points ingested into a DutyDay.location_track:
  parse+accuracy-gate -> append -> sort chronologically -> re-flag teleports
  -> compact (collapse jitter, drop out-and-back spikes) -> integrity rollup.
"""
import math
from datetime import datetime, timezone as dt_timezone

# Tunables (same values as the previous platform).
MOCK_TELEPORT_MAX_KMH = 220.0
MAX_ACCEPTABLE_ACCURACY_M = 40.0
MIN_POINT_DISTANCE_M = 6.0
SPIKE_EXCURSION_M = 60.0


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _parse_ts(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=dt_timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def is_teleport(prev, curr) -> bool:
    """True if the implied speed between two points exceeds the mock threshold."""
    t1, t2 = _parse_ts(prev.get("timestamp")), _parse_ts(curr.get("timestamp"))
    if t1 is None or t2 is None:
        return False
    seconds = abs((t2 - t1).total_seconds())
    if seconds < 1:
        return False
    try:
        km = haversine_km(prev["lat"], prev["lng"], curr["lat"], curr["lng"])
    except (KeyError, TypeError):
        return False
    kmh = km / (seconds / 3600.0)
    return kmh > MOCK_TELEPORT_MAX_KMH


def sort_track(track: list) -> list:
    """Chronological; points with no timestamp sink to the end."""
    def key(pt):
        ts = _parse_ts(pt.get("timestamp"))
        return (0, ts) if ts else (1, datetime.max.replace(tzinfo=dt_timezone.utc))

    return sorted(track, key=key)


def compact_track(track: list) -> list:
    """Remove stationary jitter and out-and-back spikes. Mocked points are never
    collapsed or dropped (kept as spoof evidence)."""
    if len(track) <= 2:
        return list(track)

    # 1) collapse consecutive non-mock points closer than MIN_POINT_DISTANCE_M.
    collapsed = [track[0]]
    for pt in track[1:]:
        last = collapsed[-1]
        if pt.get("is_mocked") or last.get("is_mocked"):
            collapsed.append(pt)
            continue
        try:
            metres = haversine_km(last["lat"], last["lng"], pt["lat"], pt["lng"]) * 1000
        except (KeyError, TypeError):
            collapsed.append(pt)
            continue
        if metres < MIN_POINT_DISTANCE_M:
            collapsed[-1] = pt  # keep the latest fix
        else:
            collapsed.append(pt)

    # 2) drop interior spikes: a non-mock point far from BOTH neighbours while
    #    the neighbours are close to each other (an out-and-back GPS excursion).
    if len(collapsed) <= 2:
        return collapsed
    cleaned = [collapsed[0]]
    for i in range(1, len(collapsed) - 1):
        prev, cur, nxt = collapsed[i - 1], collapsed[i], collapsed[i + 1]
        if cur.get("is_mocked"):
            cleaned.append(cur)
            continue
        try:
            d_prev = haversine_km(prev["lat"], prev["lng"], cur["lat"], cur["lng"]) * 1000
            d_next = haversine_km(cur["lat"], cur["lng"], nxt["lat"], nxt["lng"]) * 1000
            d_span = haversine_km(prev["lat"], prev["lng"], nxt["lat"], nxt["lng"]) * 1000
        except (KeyError, TypeError):
            cleaned.append(cur)
            continue
        if d_prev > SPIKE_EXCURSION_M and d_next > SPIKE_EXCURSION_M and d_span < SPIKE_EXCURSION_M:
            continue  # spike — drop
        cleaned.append(cur)
    cleaned.append(collapsed[-1])
    return cleaned


def route_distance_km(cleaned: list) -> float:
    """Sum haversine over consecutive points, EXCLUDING any segment that touches
    a mocked or teleport-suspect point — spoofed/glitched jumps must not inflate
    the distance (it feeds Travel Allowance reimbursement)."""
    total = 0.0
    for a, b in zip(cleaned, cleaned[1:]):
        if a.get("is_mocked") or a.get("suspect") or b.get("is_mocked") or b.get("suspect"):
            continue
        try:
            total += haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
        except (KeyError, TypeError):
            continue
    return round(total, 2)


def clean_route(track: list) -> tuple[list, int]:
    """Return (cleaned points, flagged_count) computed FROM the cleaned track —
    the trustworthy flagged count (stored mock_point_count over-counts)."""
    sorted_track = sort_track(track)
    for i in range(1, len(sorted_track)):
        if is_teleport(sorted_track[i - 1], sorted_track[i]):
            sorted_track[i]["suspect"] = True
    cleaned = compact_track(sorted_track)
    flagged = sum(1 for p in cleaned if p.get("is_mocked") or p.get("suspect"))
    return cleaned, flagged


def parse_incoming_point(raw: dict):
    """Normalise + accuracy-gate one uploaded point. Returns a stored-point dict
    or None if it should be dropped. Mocked points bypass the accuracy gate."""
    lat = raw.get("latitude", raw.get("lat"))
    lng = raw.get("longitude", raw.get("lng"))
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    is_mocked = bool(raw.get("is_mocked"))
    accuracy = raw.get("accuracy")
    try:
        accuracy = float(accuracy) if accuracy is not None else None
    except (TypeError, ValueError):
        accuracy = None
    if not is_mocked and accuracy is not None and accuracy > MAX_ACCEPTABLE_ACCURACY_M:
        return None  # too imprecise, and not spoof evidence
    ts = _parse_ts(raw.get("recorded_at") or raw.get("timestamp"))
    point = {
        "timestamp": (ts or datetime.now(dt_timezone.utc)).isoformat(),
        "lat": lat,
        "lng": lng,
        "accuracy": accuracy,
        "is_mocked": is_mocked,
        "suspect": False,
    }
    for extra in ("speed", "heading", "motion_state"):
        if raw.get(extra) is not None:
            point[extra] = raw[extra]
    return point, ts
