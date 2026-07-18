"""Capabilities TA provides — reimbursement facts for payroll/analytics."""


def _claimed_amount(user_id, from_date, to_date):
    """Approved travel allowance paid to a user across a period."""
    from django.db.models import Sum

    from .models import AllowanceClaim

    total = AllowanceClaim.objects.filter(
        agent_id=user_id, status=AllowanceClaim.Status.PAID,
        period_start__gte=from_date, period_end__lte=to_date,
    ).aggregate(s=Sum("approved_amount"))["s"]
    return float(total or 0)


def _distance_claimed(user_id, from_date, to_date):
    from django.db.models import Sum

    from .models import Trip

    total = Trip.objects.filter(
        agent_id=user_id, date__gte=from_date, date__lte=to_date,
    ).aggregate(s=Sum("distance_km"))["s"]
    return float(total or 0)


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("ta.claimed_amount", "TA", _claimed_amount)
    capabilities.provide("ta.distance_claimed", "TA", _distance_claimed)
