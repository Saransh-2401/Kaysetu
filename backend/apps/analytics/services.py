"""
Analytics aggregations.

Two rules run through all of this:

1. **Every block degrades.** A tenant on the smallest package still gets a
   dashboard; the blocks fed by modules they didn't buy report zero rather than
   erroring. Nothing here imports a module — see `sources`.

2. **Nothing is invented.** Where the previous platform hardcoded a number
   (revenue targets of 100000, "target = actual x 1.1"), this reads the real
   SalesTarget or reports null. A made-up denominator makes a chart that lies.
"""
from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from apps.foundation.models import CatalogItem, Party, TenantUser

from . import sources
from .periods import (
    bucket_end, fy_start, month_buckets, pct_change, previous_window, resolve,
)

ZERO = Decimal("0")


def _f(value):
    return float(value or 0)


def _as_int(value):
    """Query-string ids are text. A non-numeric one is a bad request, not a 500."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _sum(qs, field):
    return qs.aggregate(s=Sum(field))["s"] or ZERO


def _city_of(user):
    return (getattr(user, "city", "") or "").strip()


def _party_city(party):
    """Party addresses are JSON here, not a column."""
    return ((party.address or {}).get("city") or "").strip()


# --------------------------------------------------------------------- scoping
FULL_VIEW_ROLES = {"admin", "sales_manager", "field_manager", "accounts", "accounts_officer"}


def scoped_agent_ids(user):
    """Whose figures this user may see. None means 'everyone'.

    A manager sees their own team; an agent sees only themselves. Returning
    None for a manager would quietly show them the whole company.
    """
    if getattr(user, "is_owner", False):
        return None
    slug = getattr(getattr(user, "role", None), "slug", "")
    if slug in ("admin",):
        return None
    if slug in ("sales_manager", "field_manager"):
        team = list(TenantUser.objects.filter(reports_to_id=user.pk).values_list("pk", flat=True))
        return [user.pk, *team]
    return [user.pk]


# ------------------------------------------------------------ revenue primitives
def _secondary_revenue(from_date, to_date, *, agent_ids=None, modules=None):
    """Sales to end customers — what ORDERS bills."""
    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    if SalesOrder is None:
        return ZERO, 0
    qs = SalesOrder.objects.filter(order_date__range=(from_date, to_date)).exclude(
        status=SalesOrder.Status.REJECTED)
    if agent_ids is not None:
        qs = qs.filter(assigned_agent_id__in=agent_ids)
    return _sum(qs, "total"), qs.count()


def _primary_revenue(from_date, to_date, *, modules=None, party_ids=None):
    """Sales into the channel — what DIST bills distributors."""
    DistributorInvoice = sources.model("distribution", "DistributorInvoice", modules=modules)
    if DistributorInvoice is None:
        return ZERO, 0
    qs = DistributorInvoice.objects.filter(invoice_date__range=(from_date, to_date))
    if party_ids is not None:
        qs = qs.filter(distributor_id__in=party_ids)
    return _sum(qs, "total_amount"), qs.count()


def _outstanding(*, modules=None):
    """Money owed to us, from both channels."""
    total = ZERO
    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    if SalesOrder is not None:
        for order in SalesOrder.objects.exclude(
            payment_status=SalesOrder.PaymentStatus.PAID
        ).exclude(status=SalesOrder.Status.REJECTED).only("total", "amount_paid"):
            total += max(ZERO, (order.total or ZERO) - (order.amount_paid or ZERO))
    DistributorInvoice = sources.model("distribution", "DistributorInvoice", modules=modules)
    if DistributorInvoice is not None:
        for invoice in DistributorInvoice.objects.exclude(status="paid").only(
                "total_amount", "paid_amount"):
            total += max(ZERO, (invoice.total_amount or ZERO) - (invoice.paid_amount or ZERO))
    return total


# ------------------------------------------------------- /analytics/sales/overview/
def sales_overview(params, user):
    modules = sources.entitled_modules()
    from_date, to_date = resolve(params)
    agent_ids = scoped_agent_ids(user)
    today = timezone.localdate()

    period_value, period_count = _secondary_revenue(from_date, to_date,
                                                    agent_ids=agent_ids, modules=modules)
    # The month and year tiles mean the calendar month and the FISCAL year —
    # not "whatever range is selected". Reusing the period value made them
    # duplicate the headline figure on any range but the default.
    month_value, month_count = _secondary_revenue(today.replace(day=1), today,
                                                  agent_ids=agent_ids, modules=modules)
    year_value, year_count = _secondary_revenue(fy_start(today), today,
                                                agent_ids=agent_ids, modules=modules)

    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    pending_value, pending_count = ZERO, 0
    if SalesOrder is not None:
        pending = SalesOrder.objects.filter(status=SalesOrder.Status.PROCESSING)
        if agent_ids is not None:
            pending = pending.filter(assigned_agent_id__in=agent_ids)
        pending_value, pending_count = _sum(pending, "total"), pending.count()

    trend = []
    for month_start in month_buckets(None, None, rolling=6):
        value, _ = _secondary_revenue(month_start, bucket_end(month_start),
                                      agent_ids=agent_ids, modules=modules)
        trend.append({"name": month_start.strftime("%b"), "value": _f(value)})

    return {"overview": {
        "total_sales_value": _f(period_value),
        "total_invoices": period_count,
        "month_sales_value": _f(month_value),
        "month_invoices": month_count,
        "year_sales_value": _f(year_value),
        "year_invoices": year_count,
        "pending_orders_value": _f(pending_value),
        "pending_orders_count": pending_count,
        "outstanding_amount": _f(_outstanding(modules=modules)),
        "sales_trend": trend,
    }}


def sales_by_customer(params, user):
    modules = sources.entitled_modules()
    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    if SalesOrder is None:
        return {"top_customers": []}
    agent_ids = scoped_agent_ids(user)
    qs = SalesOrder.objects.exclude(status=SalesOrder.Status.REJECTED)
    if agent_ids is not None:
        qs = qs.filter(assigned_agent_id__in=agent_ids)
    rows = (qs.values("customer", "customer__name")
              .annotate(total_sales=Sum("total"), invoice_count=Count("id"))
              .order_by("-total_sales")[:10])
    return {"top_customers": [{
        "customer": r["customer"], "customer__customer_name": r["customer__name"],
        "customer_name": r["customer__name"],
        "total_sales": _f(r["total_sales"]), "invoice_count": r["invoice_count"],
    } for r in rows]}


# -------------------------------------------------------- /analytics/sales/reports/
def sales_reports(params, user):
    modules = sources.entitled_modules()
    from_date, to_date = resolve(params, default_range="This Quarter")
    agent_ids = scoped_agent_ids(user)
    today = timezone.localdate()

    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    SalesTarget = sources.model("field", "SalesTarget", modules=modules)
    Lead = sources.model("crm", "Lead", modules=modules)

    total_revenue, total_deals = _secondary_revenue(from_date, to_date,
                                                    agent_ids=agent_ids, modules=modules)
    month_revenue, _ = _secondary_revenue(today.replace(day=1), today,
                                          agent_ids=agent_ids, modules=modules)
    # The FISCAL year to date — not a second copy of the selected range.
    year_revenue, _ = _secondary_revenue(fy_start(today), today,
                                         agent_ids=agent_ids, modules=modules)

    # Revenue trend against the REAL monthly target. The previous platform used
    # `actual * 1.1` here, which made attainment meaningless by construction.
    revenue_trend = []
    for month_start in month_buckets(None, None, rolling=6):
        actual, _ = _secondary_revenue(month_start, bucket_end(month_start),
                                       agent_ids=agent_ids, modules=modules)
        target = ZERO
        if SalesTarget is not None:
            # Per-agent rows only. SalesTarget also stores a GLOBAL monthly
            # target (agent is null); summing both counted the company figure
            # twice and made attainment look half what it is.
            target = _sum(SalesTarget.objects.filter(
                month=month_start.month, year=month_start.year,
                agent__isnull=False), "revenue_target")
            if not target:
                target = _sum(SalesTarget.objects.filter(
                    month=month_start.month, year=month_start.year,
                    agent__isnull=True), "revenue_target")
        revenue_trend.append({
            "month": month_start.strftime("%b"),
            "target": _f(target),          # 0 = no target set, not a guess
            "actual": _f(actual),
        })

    agent_stats, quota_total = [], ZERO
    agents = TenantUser.objects.filter(is_active=True).select_related("role")
    if agent_ids is not None:
        agents = agents.filter(pk__in=agent_ids)
    for agent in agents:
        if not (agent.role and agent.role.slug in ("sales_agent", "field_agent", "sales_manager")):
            continue
        sales, deals = ZERO, 0
        if SalesOrder is not None:
            owned = SalesOrder.objects.filter(
                assigned_agent_id=agent.pk, order_date__range=(from_date, to_date)
            ).exclude(status=SalesOrder.Status.REJECTED)
            sales, deals = _sum(owned, "total"), owned.count()
        quota = ZERO
        if SalesTarget is not None:
            quota = _sum(SalesTarget.objects.filter(
                agent_id=agent.pk, month=today.month, year=today.year), "revenue_target")
        quota_total += quota
        agent_stats.append({
            "id": agent.pk, "name": agent.full_name, "sales": _f(sales),
            "quota": _f(quota), "deals": deals,
            "avgDeal": round(_f(sales) / deals, 2) if deals else 0.0,
        })
    agent_stats.sort(key=lambda r: r["sales"], reverse=True)

    # The old funnel had an Opportunity stage; that model no longer exists, so
    # the funnel is drawn from the Lead statuses that DO exist rather than
    # fabricating a stage.
    funnel = [
        {"name": "Total Leads", "value": 0, "fill": "#E0E0E0"},
        {"name": "Qualified", "value": 0, "fill": "#90CAF9"},
        {"name": "Interested", "value": 0, "fill": "#42A5F5"},
        {"name": "Converted", "value": 0, "fill": "#2ECC71"},
    ]
    if Lead is not None:
        leads = Lead.objects.all()
        if agent_ids is not None:
            leads = leads.filter(assigned_to_id__in=agent_ids)
        funnel[0]["value"] = leads.count()
        funnel[1]["value"] = leads.filter(status="qualified").count()
        funnel[2]["value"] = leads.filter(status="interested").count()
        funnel[3]["value"] = leads.filter(status="converted").count()

    category = [{"name": r["customer_name"], "value": r["total_sales"]}
                for r in sales_by_customer(params, user)["top_customers"][:5]]

    return {
        "revenue_trend": revenue_trend,
        "agent_stats": agent_stats,
        "funnel_data": funnel,
        "category_data": category,
        "kpis": {
            "total_revenue": _f(total_revenue),
            "month_revenue": _f(month_revenue),
            "year_revenue": _f(year_revenue),
            "quota_attainment": (round(_f(total_revenue) / _f(quota_total) * 100, 1)
                                 if quota_total else 0.0),
            "avg_deal_size": round(_f(total_revenue) / total_deals, 2) if total_deals else 0.0,
            "total_deals": total_deals,
        },
    }


# ----------------------------------------------------- /analytics/purchase/overview/
def purchase_overview(params, user):
    modules = sources.entitled_modules()
    today = timezone.localdate()
    PurchaseOrder = sources.model("purchase", "PurchaseOrder", modules=modules)
    MaterialRequest = sources.model("purchase", "MaterialRequest", modules=modules)
    PurchaseBill = sources.model("purchase", "PurchaseBill", modules=modules)

    overview = {
        "total_purchase_value": 0.0, "total_purchase_orders": 0,
        "month_purchase_value": 0.0, "month_purchase_orders": 0,
        "pending_material_requests": 0, "pending_pos_count": 0, "pending_pos_value": 0.0,
    }
    if PurchaseOrder is not None:
        live = PurchaseOrder.objects.exclude(status__in=[
            PurchaseOrder.Status.CANCELLED, PurchaseOrder.Status.DRAFT])
        overview["total_purchase_value"] = _f(_sum(live, "total"))
        overview["total_purchase_orders"] = live.count()
        this_month = live.filter(order_date__gte=today.replace(day=1), order_date__lte=today)
        overview["month_purchase_value"] = _f(_sum(this_month, "total"))
        overview["month_purchase_orders"] = this_month.count()
        pending = PurchaseOrder.objects.filter(status__in=[
            PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.PENDING_APPROVAL])
        overview["pending_pos_count"] = pending.count()
        overview["pending_pos_value"] = _f(_sum(pending, "total"))
    if MaterialRequest is not None:
        overview["pending_material_requests"] = MaterialRequest.objects.filter(
            status__in=[MaterialRequest.Status.DRAFT,
                        MaterialRequest.Status.PENDING_APPROVAL]).count()
    if PurchaseBill is not None:
        # Unbilled payables belong in the pending figure — this replaces the old
        # ManualInvoice component, whose model no longer exists.
        unpaid = PurchaseBill.objects.exclude(status=PurchaseBill.Status.PAID)
        residual = sum((max(ZERO, (b.total or ZERO) - (b.paid_amount or ZERO)) for b in unpaid), ZERO)
        overview["pending_pos_value"] += _f(residual)
    return {"overview": overview}


# --------------------------------------------------- /analytics/crm/leads-funnel/
def crm_funnel(params, user):
    modules = sources.entitled_modules()
    from_date, to_date = resolve(params)
    agent_ids = scoped_agent_ids(user)
    Lead = sources.model("crm", "Lead", modules=modules)

    funnel = {"total": 0, "open": 0, "qualified": 0, "converted": 0, "conversion_rate": 0.0}
    if Lead is not None:
        qs = Lead.objects.filter(created_at__date__range=(from_date, to_date))
        if agent_ids is not None:
            qs = qs.filter(assigned_to_id__in=agent_ids)
        funnel["total"] = qs.count()
        funnel["open"] = qs.filter(status="open").count()
        funnel["qualified"] = qs.filter(status="qualified").count()
        funnel["converted"] = qs.filter(status="converted").count()
        if funnel["total"]:
            funnel["conversion_rate"] = round(funnel["converted"] / funnel["total"] * 100, 1)

    return {
        "leads_funnel": funnel,
        # The Opportunity model was removed from the platform, so a pipeline
        # value would be fabricated. Reported as unavailable, not as zero.
        "opportunities": {"total": 0, "open": 0, "won": 0, "win_rate": 0.0,
                          "pipeline_value": 0.0, "avg_probability": 0.0,
                          "available": False},
        "customers": {"total": Party.objects.filter(
            kind__in=[Party.Kind.CUSTOMER, Party.Kind.BOTH], is_active=True).count()},
    }


# ----------------------------------------------- /analytics/field-sales/overview/
def field_sales_overview(params, user):
    modules = sources.entitled_modules()
    from_date, to_date = resolve(params)
    agent_ids = scoped_agent_ids(user)
    today = timezone.localdate()

    Visit = sources.model("field", "Visit", modules=modules)
    SalesTarget = sources.model("field", "SalesTarget", modules=modules)
    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    DutyDay = sources.model("tracking", "DutyDay", modules=modules)

    overview = {"total_visits": 0, "completed_visits": 0, "pending_visits": 0,
                "completion_rate": 0.0, "today_planned": 0, "today_completed": 0,
                "agent_performance": []}

    visits = None
    if Visit is not None:
        visits = Visit.objects.filter(visit_date__range=(from_date, to_date))
        if agent_ids is not None:
            visits = visits.filter(agent_id__in=agent_ids)
        overview["total_visits"] = visits.count()
        overview["completed_visits"] = visits.filter(status="completed").count()
        overview["pending_visits"] = visits.filter(status="scheduled").count()
        if overview["total_visits"]:
            overview["completion_rate"] = round(
                overview["completed_visits"] / overview["total_visits"] * 100, 1)
        todays = Visit.objects.filter(visit_date=today)
        if agent_ids is not None:
            todays = todays.filter(agent_id__in=agent_ids)
        overview["today_planned"] = todays.count()
        overview["today_completed"] = todays.filter(status="completed").count()

    # The leaderboard window is independent of the main range (the screen has
    # its own month picker).
    month_param = (params.get("month") or "").strip()
    lead_from, lead_to = from_date, to_date
    if month_param:
        try:
            year, month = (int(x) for x in month_param.split("-")[:2])
            lead_from = today.replace(year=year, month=month, day=1)
            lead_to = bucket_end(lead_from)
        except (ValueError, TypeError):
            pass                                    # keep the main range

    agents = TenantUser.objects.filter(is_active=True).select_related("role")
    if agent_ids is not None:
        agents = agents.filter(pk__in=agent_ids)
    rows = []
    for agent in agents:
        slug = getattr(agent.role, "slug", "") or ""
        if slug not in ("sales_agent", "field_agent"):
            continue
        agent_visits = 0
        if Visit is not None:
            agent_visits = Visit.objects.filter(
                agent_id=agent.pk, visit_date__range=(lead_from, lead_to),
                status="completed").count()
        sales = ZERO
        if SalesOrder is not None:
            sales = _sum(SalesOrder.objects.filter(
                assigned_agent_id=agent.pk, order_date__range=(lead_from, lead_to)
            ).exclude(status=SalesOrder.Status.REJECTED), "total")
        target = ZERO
        if SalesTarget is not None:
            target = _sum(SalesTarget.objects.filter(
                agent_id=agent.pk, month=lead_from.month, year=lead_from.year), "revenue_target")
            if not target:
                target = _sum(SalesTarget.objects.filter(is_default=True), "revenue_target")
        attendance_days = 0
        if DutyDay is not None:
            attendance_days = DutyDay.objects.filter(
                agent_id=agent.pk, date__range=(lead_from, lead_to),
                punch_in_time__isnull=False).count()
        rows.append({
            "id": agent.pk, "name": agent.full_name,
            "role": slug.replace("_", " ").title(),
            "city": _city_of(agent),
            "sales": _f(sales), "visits": agent_visits,
            "attendance_days": attendance_days,
            "target": _f(target),
            "progress": min(100, round(_f(sales) / _f(target) * 100)) if target else 0,
        })
    rows.sort(key=lambda r: r["progress"], reverse=True)
    overview["agent_performance"] = rows
    return {"overview": overview}


# ------------------------------------------------- /analytics/sales-agent/overview/
def sales_agent_overview(params, user):
    modules = sources.entitled_modules()
    today = timezone.localdate()

    agent = user
    requested = _as_int(params.get("agent_id"))
    if requested:
        # Scoped, not role-gated: a manager may look at THEIR team, not at
        # everyone. Falling back to the caller keeps the screen working instead
        # of erroring, and never leaks another team's figures.
        visible = scoped_agent_ids(user)
        if visible is None or requested in visible:
            agent = TenantUser.objects.filter(pk=requested).first() or user

    Visit = sources.model("field", "Visit", modules=modules)
    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    SalesTarget = sources.model("field", "SalesTarget", modules=modules)

    def day_sales(day):
        if SalesOrder is None:
            return ZERO, 0
        qs = SalesOrder.objects.filter(assigned_agent_id=agent.pk, order_date=day).exclude(
            status=SalesOrder.Status.REJECTED)
        return _sum(qs, "total"), qs.count()

    today_sales, today_orders = day_sales(today)
    todays_visits = (Visit.objects.filter(agent_id=agent.pk, visit_date=today)
                     .select_related("party") if Visit is not None else [])

    targets = None
    if SalesTarget is not None:
        row = SalesTarget.objects.filter(
            agent_id=agent.pk, month=today.month, year=today.year).first()
        if row is not None:
            targets = {"revenue": _f(row.revenue_target), "visits": row.visit_target,
                       "orders": row.order_target}

    weekly = []
    for offset in range(6, -1, -1):
        day = today - timezone.timedelta(days=offset)
        value, _ = day_sales(day)
        weekly.append({"day": day.strftime("%a"), "date": day.isoformat(), "sales": _f(value)})

    trend = []
    for month_start in month_buckets(None, None, rolling=6):
        value, _ = _secondary_revenue(month_start, bucket_end(month_start),
                                      agent_ids=[agent.pk], modules=modules)
        trend.append({"month": month_start.strftime("%b"), "sales": _f(value)})

    month_start = today.replace(day=1)
    mtd_sales, mtd_orders = _secondary_revenue(month_start, today,
                                               agent_ids=[agent.pk], modules=modules)
    mtd_visits = (Visit.objects.filter(agent_id=agent.pk,
                                       visit_date__range=(month_start, today)).count()
                  if Visit is not None else 0)
    # "New clients" was Customer.created_by, a field the Party model doesn't
    # carry. Ownership is the closest honest substitute.
    new_clients = Party.objects.filter(
        assigned_agent_id=agent.pk, created_at__date__range=(month_start, today)).count()

    return {
        "agent_name": agent.full_name,
        "today": {"sales": _f(today_sales), "orders": today_orders,
                  "visits_done": sum(1 for v in todays_visits if v.status == "completed"),
                  "visits_total": len(todays_visits)},
        "targets": targets,
        "todays_route": [{
            "id": v.pk,
            "time": v.scheduled_time.isoformat() if v.scheduled_time else None,
            "customer": v.party.name if v.party_id else "",
            "address": ", ".join(x for x in [
                (v.party.address or {}).get("line1") if v.party_id else None,
                _party_city(v.party) if v.party_id else None] if x),
            "status": v.status,
        } for v in todays_visits],
        "weekly_sales": weekly,
        "sales_trend": trend,
        "activity_mix": [
            {"name": "Visits", "value": mtd_visits},
            {"name": "Orders", "value": mtd_orders},
            {"name": "New Clients", "value": new_clients},
        ],
        "kpis": {
            "total_sales": _f(mtd_sales), "orders": mtd_orders, "visits": mtd_visits,
            "conversion": round(mtd_orders / mtd_visits * 100, 1) if mtd_visits else 0.0,
        },
    }


def stock_summary(modules=None):
    """Just the stock headline: item count, value, low-stock rows.

    Split out of warehouse_stock_levels because the dashboard only needs these
    three numbers, and the full report materialises the ENTIRE append-only
    stock ledger into Python to compute ageing and slow movers. Calling it from
    a dashboard made every page load scan a table that only grows.
    """
    StockLevel = sources.model("inventory", "StockLevel", modules=modules)
    if StockLevel is None:
        return {"total_products": 0, "low_stock": 0, "inventory_value": 0.0,
                "product_inventory": [], "low_stock_alerts": []}

    by_item = defaultdict(lambda: {"on_hand": ZERO, "reorder": ZERO, "item": None})
    for level in StockLevel.objects.select_related("item"):
        entry = by_item[level.item_id]
        entry["on_hand"] += level.on_hand or ZERO
        entry["reorder"] = max(entry["reorder"], level.reorder_level or ZERO)
        entry["item"] = level.item

    value_total, rows, low = ZERO, [], []
    for entry in by_item.values():
        item = entry["item"]
        value = (entry["on_hand"] or ZERO) * (item.price or ZERO)
        value_total += value
        is_low = entry["reorder"] > 0 and entry["on_hand"] <= entry["reorder"]
        rows.append({"name": item.name, "stock": _f(entry["on_hand"]),
                     "threshold": _f(entry["reorder"]), "value": _f(value),
                     "status": ("critical" if entry["on_hand"] <= 0
                                else "low" if is_low else "healthy")})
        if is_low:
            low.append({"name": item.name, "sku": item.code or "",
                        "stock": _f(entry["on_hand"]), "threshold": _f(entry["reorder"])})
    rows.sort(key=lambda r: r["value"], reverse=True)
    return {"total_products": len(by_item), "low_stock": len(low),
            "inventory_value": _f(value_total),
            "product_inventory": rows[:12], "low_stock_alerts": low[:10]}


# ------------------------------------------------ /analytics/warehouse/stock-levels/
def warehouse_stock_levels(params, user):
    modules = sources.entitled_modules()
    StockLevel = sources.model("inventory", "StockLevel", modules=modules)
    StockLedger = sources.model("inventory", "StockLedger", modules=modules)
    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)

    try:
        movement_days = int(params.get("movement_days", 7))
    except (TypeError, ValueError):
        movement_days = 7
    if movement_days not in (7, 14, 30):
        movement_days = 7

    empty = {
        "kpis": {"inventory_turnover": "N/A", "inventory_turnover_target": "4.0x",
                 "dead_stock_value": "0.00", "fill_rate": "0.0%",
                 "accuracy": "—", "accuracy_status": "no_audit"},
        "movement_days": movement_days, "movement_trend": [], "aging_data": [],
        "slow_moving_items": [], "top_movers": [], "low_stock_items": [],
        "overview": {"total_items": 0, "estimated_stock_value": 0.0, "low_stock_count": 0},
    }
    if StockLevel is None or StockLedger is None:
        return empty

    now = timezone.now()
    levels = list(StockLevel.objects.select_related("item", "warehouse"))
    # StockLevel is per (item, warehouse) — sum across warehouses or a
    # multi-warehouse tenant's item counts are wrong.
    by_item, low_stock = defaultdict(lambda: {"on_hand": ZERO, "reorder": ZERO}), []
    for level in levels:
        entry = by_item[level.item_id]
        entry["on_hand"] += level.on_hand or ZERO
        entry["reorder"] = max(entry["reorder"], level.reorder_level or ZERO)
        entry["item"] = level.item

    stock_value = ZERO
    product_inventory = []
    for item_id, entry in by_item.items():
        item = entry["item"]
        value = (entry["on_hand"] or ZERO) * (item.price or ZERO)
        stock_value += value
        is_low = entry["reorder"] > 0 and entry["on_hand"] <= entry["reorder"]
        if is_low:
            low_stock.append({"item_code": item.code or "", "item_name": item.name,
                              "name": item.name, "sku": item.code or "",
                              "stock": _f(entry["on_hand"]), "threshold": _f(entry["reorder"])})
        product_inventory.append({
            "name": item.name, "stock": _f(entry["on_hand"]),
            "threshold": _f(entry["reorder"]), "value": _f(value),
            "status": ("critical" if entry["on_hand"] <= 0 else "low" if is_low else "healthy"),
        })
    product_inventory.sort(key=lambda r: r["value"], reverse=True)

    trend = []
    for offset in range(movement_days - 1, -1, -1):
        day = (now - timezone.timedelta(days=offset)).date()
        rows = StockLedger.objects.filter(at__date=day)
        trend.append({
            "day": day.strftime("%a") if movement_days <= 7 else day.strftime("%d %b"),
            "inbound": rows.filter(quantity__gt=0).count(),
            "outbound": rows.filter(quantity__lt=0).count(),
        })

    # Ageing by the last movement on each item.
    last_move = {}
    for row in StockLedger.objects.order_by("item_id", "-at").values("item_id", "at"):
        last_move.setdefault(row["item_id"], row["at"])
    buckets = {"0-30 Days": 0, "31-60 Days": 0, "61-90 Days": 0, "> 90 Days": 0}
    colors = {"0-30 Days": "#2E7D32", "31-60 Days": "#F9A825",
              "61-90 Days": "#EF6C00", "> 90 Days": "#C62828"}
    slow, dead_value = [], ZERO
    for item_id, entry in by_item.items():
        moved_at = last_move.get(item_id)
        days = (now - moved_at).days if moved_at else 9999
        label = ("0-30 Days" if days <= 30 else "31-60 Days" if days <= 60
                 else "61-90 Days" if days <= 90 else "> 90 Days")
        buckets[label] += 1
        if days > 90 and entry["on_hand"] > 0:
            value = entry["on_hand"] * (entry["item"].price or ZERO)
            dead_value += value
            slow.append({"id": entry["item"].code or str(item_id), "name": entry["item"].name,
                         "warehouse": "", "days": min(days, 9999),
                         "qty": _f(entry["on_hand"]), "value": _f(value)})
    slow.sort(key=lambda r: r["value"], reverse=True)

    outbound = defaultdict(Decimal)
    since = now - timezone.timedelta(days=30)
    for row in StockLedger.objects.filter(at__gte=since, quantity__lt=0).select_related("item"):
        outbound[row.item.name] += abs(row.quantity or ZERO)
    top_movers = [{"name": name, "category": "", "value": _f(qty)}
                  for name, qty in sorted(outbound.items(), key=lambda kv: kv[1], reverse=True)[:5]]

    fill_rate = "0.0%"
    if SalesOrder is not None:
        total_orders = SalesOrder.objects.exclude(status=SalesOrder.Status.REJECTED).count()
        if total_orders:
            delivered = SalesOrder.objects.filter(status=SalesOrder.Status.DELIVERED).count()
            fill_rate = f"{round(delivered / total_orders * 100, 1)}%"

    turnover = "N/A"
    if stock_value:
        out_30 = sum((abs(r.quantity or ZERO) * (r.valuation_rate or ZERO)
                      for r in StockLedger.objects.filter(at__gte=since, quantity__lt=0)), ZERO)
        turnover = f"{round(_f(out_30) * 12 / _f(stock_value), 1)}x"

    return {
        "kpis": {
            "inventory_turnover": turnover, "inventory_turnover_target": "4.0x",
            "dead_stock_value": f"{_f(dead_value):.2f}", "fill_rate": fill_rate,
            # Stock accuracy needs a counted-vs-system audit pair. StockLedger
            # records the adjustment but not what was counted, so a number here
            # would be invented.
            "accuracy": "—", "accuracy_status": "no_audit",
        },
        "movement_days": movement_days,
        "overview": {"total_items": len(by_item), "estimated_stock_value": _f(stock_value),
                     "low_stock_count": len(low_stock)},
        "movement_trend": trend,
        "aging_data": [{"name": k, "value": v, "color": colors[k]} for k, v in buckets.items()],
        "slow_moving_items": slow[:20],
        "top_movers": top_movers,
        "low_stock_items": low_stock[:5],
        "product_inventory": product_inventory[:12],
        "low_stock_alerts": low_stock[:10],
    }
