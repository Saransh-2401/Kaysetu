"""
Capabilities CRM provides. Other modules read lead pipeline data by string
name, never by importing apps.crm.
"""


def _lead_stats(agent_id=None):
    """Funnel counts by status (optionally scoped to an agent)."""
    from django.db.models import Count

    from .models import Lead

    qs = Lead.objects.all()
    if agent_id is not None:
        qs = qs.filter(assigned_to_id=agent_id)
    counts = {row["status"]: row["n"] for row in qs.values("status").annotate(n=Count("id"))}
    return {"total": sum(counts.values()), "by_status": counts}


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("crm.lead_stats", "CRM", _lead_stats)
