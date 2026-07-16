"""
FIELD domain services. Cross-module reads go through the capability registry;
cross-module effects are emitted as events — FIELD never imports another module.
"""
import math
from decimal import Decimal

from django.db.models import Count, Min, Sum
from django.utils import timezone

from apps.foundation.integration import capabilities, events

from .models import Collection, FieldOrder, FieldOrderItem, SalesCityTarget, SalesTarget, Visit

VISIT_GEOFENCE_M = 250.0  # a checkin is GPS-verified if within this of the tracked position


def _haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


# ------------------------------------------------------------------- visits
def check_in_visit(visit: Visit, *, lat, lng, address="", selfie_url="") -> Visit:
    visit.actual_checkin_time = timezone.now()
    visit.checkin_location = {"lat": lat, "lng": lng, "address": address}
    if selfie_url:
        visit.checkin_selfie = selfie_url
    visit.status = Visit.Status.IN_PROGRESS
    visit.gps_verified = _verify_against_tracking(visit.agent_id, lat, lng)
    visit.save()
    events.emit("field.visit_checked_in", agent_id=visit.agent_id, visit_id=visit.pk)
    return visit


def _verify_against_tracking(agent_id, lat, lng) -> bool:
    """Cross-check the check-in against TRACK's live location. Degrades to False
    (unverified) when TRACK isn't entitled/installed — the visit still works."""
    if lat is None or lng is None:
        return False
    loc = capabilities.call("tracking.last_location", agent_id, default=None)
    if not loc or loc.get("lat") is None or loc.get("lng") is None:
        return False
    return _haversine_m(float(lat), float(lng), float(loc["lat"]), float(loc["lng"])) <= VISIT_GEOFENCE_M


def check_out_visit(visit: Visit, *, lat=None, lng=None, address="", notes="", outcome="", lead_status="") -> Visit:
    visit.actual_checkout_time = timezone.now()
    if lat is not None and lng is not None:
        visit.checkout_location = {"lat": lat, "lng": lng, "address": address}
    visit.checkout_notes = notes or visit.checkout_notes
    visit.outcome = outcome or visit.outcome
    visit.status = Visit.Status.COMPLETED
    visit.save()
    events.emit("field.visit_completed", agent_id=visit.agent_id, visit_id=visit.pk, party_id=visit.party_id)
    return visit


# ------------------------------------------------------------------- orders
def book_order(agent, *, party_id, order_date, items, notes="", client_uuid="") -> FieldOrder:
    """Create a field order + items, recompute totals server-side, emit event."""
    if client_uuid:
        existing = FieldOrder.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return existing

    subtotal = tax_total = Decimal("0")
    prepared = []
    for line in items:
        qty = Decimal(str(line.get("quantity", 1)))
        rate = Decimal(str(line.get("rate", 0)))
        tax_rate = Decimal(str(line.get("tax_rate", 0)))
        line_amount = (qty * rate).quantize(Decimal("0.01"))
        line_tax = (line_amount * tax_rate / 100).quantize(Decimal("0.01"))
        subtotal += line_amount
        tax_total += line_tax
        prepared.append((line, qty, rate, tax_rate, line_amount))

    order = FieldOrder.objects.create(
        order_number="FO-" + timezone.now().strftime("%y%m%d%H%M%S%f")[:16],
        agent=agent, party_id=party_id, order_date=order_date,
        subtotal=subtotal, tax_amount=tax_total, total=subtotal + tax_total,
        notes=notes, client_uuid=client_uuid,
    )
    for line, qty, rate, tax_rate, line_amount in prepared:
        FieldOrderItem.objects.create(
            order=order, item_id=line["item"], item_name=line.get("item_name", ""),
            quantity=qty, rate=rate, tax_rate=tax_rate, amount=line_amount,
        )
    events.emit(
        "field.order_booked",
        order_id=order.pk, order_number=order.order_number,
        agent_id=agent.pk, party_id=party_id, total=str(order.total),
    )
    return order


def record_collection(agent, *, party_id, amount, mode, reference="", against_invoice="", client_uuid="") -> Collection:
    if client_uuid:
        existing = Collection.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return existing
    collection = Collection.objects.create(
        agent=agent, party_id=party_id, amount=Decimal(str(amount)), mode=mode,
        reference=reference, against_invoice=against_invoice, client_uuid=client_uuid,
    )
    events.emit(
        "field.collection_recorded",
        collection_id=collection.pk, agent_id=agent.pk, party_id=party_id,
        amount=str(collection.amount), mode=mode,
    )
    return collection


# ------------------------------------------------------------------- targets
def resolve_target(agent_id, month, year):
    """Three-tier fallback: agent-specific -> global-monthly -> default."""
    target = SalesTarget.objects.filter(
        agent_id=agent_id, month=month, year=year, is_default=False
    ).first()
    kind = "agent_specific"
    if target is None:
        target = SalesTarget.objects.filter(
            agent__isnull=True, month=month, year=year, is_default=False
        ).first()
        kind = "global_monthly"
    if target is None:
        target = SalesTarget.objects.filter(is_default=True).first()
        kind = "default"
    if target is None:
        kind = "none"
    return target, kind


def _actuals(agent_id, month, year):
    """Actuals computed from FIELD's OWN data + login-hours pulled from TRACK."""
    visits = Visit.objects.filter(
        agent_id=agent_id, visit_date__month=month, visit_date__year=year,
        status=Visit.Status.COMPLETED,
    ).count()
    order_stats = FieldOrder.objects.filter(
        agent_id=agent_id, order_date__month=month, order_date__year=year,
    ).aggregate(n=Count("id"), revenue=Sum("total"))
    # New clients: parties whose FIRST completed visit by this agent is this month.
    first_visits = (
        Visit.objects.filter(agent_id=agent_id, status=Visit.Status.COMPLETED, party__isnull=False)
        .values("party_id").annotate(first=Min("visit_date"))
    )
    new_clients = sum(
        1 for row in first_visits
        if row["first"] and row["first"].month == month and row["first"].year == year
    )
    login_hours = capabilities.call("tracking.month_hours", agent_id, year, month, default=0.0)
    return {
        "visits": visits,
        "orders": order_stats["n"] or 0,
        "revenue": float(order_stats["revenue"] or 0),
        "stock_requests": 0,          # DIST-owned; pulled via capability when DIST lands
        "stock_request_revenue": 0.0,
        "new_clients": new_clients,
        "login_hours": float(login_hours or 0),
    }


def _pct(actual, target):
    return round(float(actual) / float(target) * 100, 1) if target else 0.0


def target_performance(agent_id, month, year):
    target, kind = resolve_target(agent_id, month, year)
    actuals = _actuals(agent_id, month, year)
    t = target
    targets = {
        "visits": t.visit_target if t else 0,
        "orders": t.order_target if t else 0,
        "stock_requests": t.stock_request_target if t else 0,
        "revenue": float(t.revenue_target) if t else 0.0,
        "stock_request_revenue": float(t.stock_request_revenue_target) if t else 0.0,
        "new_clients": t.new_client_target if t else 0,
        "login_hours": float(t.login_hours_target) if t else 0.0,
    }
    percentages = {k: _pct(actuals[k], targets[k]) for k in targets}
    return {
        "agent_id": agent_id, "month": month, "year": year, "target_type": kind,
        "targets": targets, "actuals": actuals, "performance_percentages": percentages,
    }
