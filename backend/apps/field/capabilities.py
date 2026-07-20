"""
Capabilities FIELD PROVIDES to other modules (via the foundation registry),
and the helpers it uses to CONSUME other modules' capabilities.

Provides:
  field.visit_count(agent_id, date)   -> completed visits that day. TRACK's
      nightly route rollup pulls this so RouteHistory.visit_count is real when
      FIELD is installed, and 0 when it is not — neither module imports the other.

Consumes (see services.py / views.py):
  tracking.is_on_duty / tracking.last_location  -> GPS-verify a visit check-in.
  tracking.month_hours                          -> login-hours actual for target
      performance (the coupling that used to read DailyReport directly).
"""


def _visit_count(agent_id, date):
    from .models import Visit

    return Visit.objects.filter(
        agent_id=agent_id, visit_date=date, status=Visit.Status.COMPLETED
    ).count()


def _visits_for_party(party_id, from_date=None, to_date=None):
    """Every visit made to one party, newest first. The FIRST visit (oldest) is
    flagged as the baseline — that is the 'before' photo the shop audit compares
    later visits against."""
    from .models import Visit

    qs = Visit.objects.filter(party_id=party_id).prefetch_related("images")
    if from_date:
        qs = qs.filter(visit_date__gte=from_date)
    if to_date:
        qs = qs.filter(visit_date__lte=to_date)
    ordered = list(qs.order_by("visit_date", "id"))
    baseline_id = ordered[0].pk if ordered else None
    return [{
        "id": v.pk, "visit_date": v.visit_date.isoformat(), "status": v.status,
        "is_baseline": v.pk == baseline_id,
        "images": [{"image_url": img.image_url, "image_type": img.image_type}
                   for img in v.images.all()],
    } for v in reversed(ordered)]


def register_all():
    """Called from FieldConfig.ready() (no DB access here)."""
    from apps.foundation.integration import capabilities

    capabilities.provide("field.visit_count", "FIELD", _visit_count)
    capabilities.provide("field.visits_for_party", "FIELD", _visits_for_party)
