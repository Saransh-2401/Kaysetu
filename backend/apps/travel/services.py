"""
TA domain services. Distance comes from TRACK's GPS when installed (asked via
capability, never imported); the amount is always computed server-side from the
policy rate and caps — a claimed amount is never taken from the client.
"""
import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.foundation.integration import capabilities, events
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import AllowanceClaim, PolicyConfig, Trip

logger = logging.getLogger("salexa.travel")

CENT = Decimal("0.01")
MAX_KM_PER_DAY = Decimal("2000")


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))


def _num(prefix="TA"):
    import secrets

    return f"{prefix}-{timezone.now().strftime('%y%m%d%H%M%S%f')}-{secrets.token_hex(2)}"


def _dec(value, field):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field: f"invalid number: {value!r}"})
    if not parsed.is_finite():
        raise ValidationError({field: f"invalid number: {value!r}"})
    return parsed


def _as_date(value, field):
    """API dates arrive as ISO strings — coerce before any date math/filtering."""
    from datetime import date as date_cls

    if isinstance(value, date_cls):
        return value
    try:
        return date_cls.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ValidationError({field: f"invalid date: {value!r}"})


def policy_for(*, city="", vehicle_type=PolicyConfig.Vehicle.BIKE):
    """Most specific active policy: exact city first, then the catch-all."""
    qs = PolicyConfig.objects.filter(is_active=True, vehicle_type=vehicle_type)
    return qs.filter(city__iexact=city).first() or qs.filter(city="").first()


def record_trip(agent, *, date, distance_km=None, transport_mode=PolicyConfig.Vehicle.BIKE,
                notes=""):
    """Log a day's travel. When TRACK is installed the GPS distance is authoritative
    and the client's figure is ignored; without it the entered value is used."""
    date = _as_date(date, "date")
    tracked = capabilities.call("tracking.distance_for", agent.pk, date, default=None)
    # A tracked distance of 0 means "no GPS recorded for that day", NOT "travelled
    # nothing" — treating it as authoritative would silently zero a real claim.
    if tracked is not None and _dec(tracked, "distance_km") > 0:
        distance = _dec(tracked, "distance_km")
        source = Trip.Source.GPS
    else:
        if distance_km is None:
            raise ValidationError({"distance_km": "distance is required (no GPS data)."})
        distance = _dec(distance_km, "distance_km")
        source = Trip.Source.MANUAL
    if distance < 0:
        raise ValidationError({"distance_km": "cannot be negative."})
    if distance > MAX_KM_PER_DAY:
        raise ValidationError({"distance_km": f"exceeds the {MAX_KM_PER_DAY} km daily sanity limit."})

    with _tenant_atomic():
        trip, created = Trip.objects.select_for_update().get_or_create(
            agent=agent, date=date,
            defaults={"distance_km": distance, "transport_mode": transport_mode,
                      "source": source, "notes": notes},
        )
        if not created:
            if trip.claim_id is not None:
                raise ValidationError("That day is already part of a submitted claim.")
            trip.distance_km = distance
            trip.transport_mode = transport_mode
            trip.source = source
            trip.notes = notes
            trip.save(update_fields=["distance_km", "transport_mode", "source", "notes"])
    return trip


def build_claim(agent, *, period_start, period_end, city=""):
    """Roll every unclaimed trip in the period into one claim, priced by policy."""
    period_start = _as_date(period_start, "period_start")
    period_end = _as_date(period_end, "period_end")
    if period_end < period_start:
        raise ValidationError({"period_end": "cannot be before the start date."})

    with _tenant_atomic():
        trips = list(Trip.objects.select_for_update().filter(
            agent=agent, date__gte=period_start, date__lte=period_end, claim__isnull=True,
        ))
        if not trips:
            raise ValidationError("There are no unclaimed trips in that period.")

        total_km = Decimal("0")
        amount = Decimal("0")
        for trip in trips:
            policy = policy_for(city=city, vehicle_type=trip.transport_mode)
            rate = policy.rate_per_km if policy else Decimal("0")
            day_amount = (trip.distance_km * rate).quantize(CENT)
            if policy and policy.max_daily_limit is not None:
                day_amount = min(day_amount, policy.max_daily_limit)
            total_km += trip.distance_km
            amount += day_amount

        # a monthly cap applies to the claim as a whole
        monthly_policy = policy_for(city=city, vehicle_type=trips[0].transport_mode)
        if monthly_policy and monthly_policy.max_monthly_limit is not None:
            amount = min(amount, monthly_policy.max_monthly_limit)

        claim = AllowanceClaim.objects.create(
            number=_num(), agent=agent, period_start=period_start, period_end=period_end,
            total_distance_km=total_km, system_amount=amount, approved_amount=amount,
        )
        Trip.objects.filter(pk__in=[t.pk for t in trips]).update(claim=claim)
    return claim


_TRANSITIONS = {
    AllowanceClaim.Status.DRAFT: {AllowanceClaim.Status.SUBMITTED},
    AllowanceClaim.Status.SUBMITTED: {AllowanceClaim.Status.MANAGER_APPROVED,
                                      AllowanceClaim.Status.REJECTED},
    AllowanceClaim.Status.MANAGER_APPROVED: {AllowanceClaim.Status.FINANCE_APPROVED,
                                             AllowanceClaim.Status.REJECTED},
    AllowanceClaim.Status.FINANCE_APPROVED: {AllowanceClaim.Status.PAID,
                                             AllowanceClaim.Status.REJECTED},
    AllowanceClaim.Status.PAID: set(),
    AllowanceClaim.Status.REJECTED: set(),
}


def _advance(claim, target, *, actor=None, note="", approved_amount=None, reference=""):
    with _tenant_atomic():
        locked = AllowanceClaim.objects.select_for_update().get(pk=claim.pk)
        if target not in _TRANSITIONS.get(locked.status, set()):
            raise ValidationError(
                f"Cannot move a {locked.get_status_display()} claim to {target}."
            )
        fields = ["status", "decision_note", "updated_at"]
        locked.status = target
        locked.decision_note = note

        if target == AllowanceClaim.Status.MANAGER_APPROVED:
            locked.manager_approved_by = actor
            fields.append("manager_approved_by")
        elif target == AllowanceClaim.Status.FINANCE_APPROVED:
            locked.finance_approved_by = actor
            fields.append("finance_approved_by")
            if approved_amount is not None:
                approved = _dec(approved_amount, "approved_amount")
                if approved < 0 or approved > locked.system_amount:
                    raise ValidationError(
                        {"approved_amount": f"must be between 0 and {locked.system_amount}."}
                    )
                locked.approved_amount = approved
                fields.append("approved_amount")
        elif target == AllowanceClaim.Status.PAID:
            locked.paid_at = timezone.now()
            locked.payment_reference = reference
            fields += ["paid_at", "payment_reference"]
        elif target == AllowanceClaim.Status.REJECTED:
            locked.approved_amount = Decimal("0")
            fields.append("approved_amount")
            # release the trips so a corrected claim can be raised
            locked.trips.update(claim=None)
        locked.save(update_fields=fields)
        paid_amount, agent_id, number = locked.approved_amount, locked.agent_id, locked.number

    if target == AllowanceClaim.Status.PAID and paid_amount > 0:
        # BOOKS records the payout: Dr Operating Expenses / Cr Cash.
        events.emit("ta.claim_paid", claim_id=claim.pk, claim_number=number,
                    user_id=agent_id, amount=str(paid_amount), reference=reference)
    claim.refresh_from_db()
    return claim


def submit_claim(claim, *, actor=None):
    return _advance(claim, AllowanceClaim.Status.SUBMITTED, actor=actor)


def manager_approve(claim, *, actor=None, note=""):
    return _advance(claim, AllowanceClaim.Status.MANAGER_APPROVED, actor=actor, note=note)


def finance_approve(claim, *, actor=None, note="", approved_amount=None):
    return _advance(claim, AllowanceClaim.Status.FINANCE_APPROVED, actor=actor, note=note,
                    approved_amount=approved_amount)


def mark_paid(claim, *, actor=None, reference=""):
    return _advance(claim, AllowanceClaim.Status.PAID, actor=actor, reference=reference)


def reject_claim(claim, *, actor=None, note=""):
    if not note:
        raise ValidationError({"note": "a rejection reason is required."})
    return _advance(claim, AllowanceClaim.Status.REJECTED, actor=actor, note=note)
