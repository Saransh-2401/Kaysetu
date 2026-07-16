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


def register_all():
    """Called from FieldConfig.ready() (no DB access here)."""
    from apps.foundation.integration import capabilities

    capabilities.provide("field.visit_count", "FIELD", _visit_count)
