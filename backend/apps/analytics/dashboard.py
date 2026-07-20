"""
The admin dashboard and its drill-down.

Two revenue streams run through this, and keeping them apart is the whole point
of the screen:

  * **primary** — company to distributor (DIST invoices). Stock leaving us.
  * **secondary** — distributor/agent to end customer (ORDERS). Stock actually
    selling through.

A company whose primary is healthy and secondary is flat is stuffing the
channel, which is exactly what this dashboard exists to make visible.
"""
from collections import defaultdict
from decimal import Decimal

from django.utils import timezone

from apps.foundation.models import Party, TenantUser

from . import sources
from .periods import (
    bucket_end, fy_start, month_buckets, parse_date, pct_change, previous_window, resolve,
)
from .services import (
    ZERO, _as_int, _city_of, _f, _party_city, _primary_revenue, _secondary_revenue,
    _sum, scoped_agent_ids,
)


def _kpi(value, previous):
    return {"value": _f(value), "change": pct_change(value, previous)}


def _agent_city_map():
    return {u.pk: _city_of(u) for u in TenantUser.objects.all().only("pk", "city")}


def admin_dashboard(params, user):
    modules = sources.entitled_modules()
    explicit = bool(params.get("from_date") and params.get("to_date"))
    from_date, to_date = resolve(params)
    prev_from, prev_to = previous_window(from_date, to_date)
    city = (params.get("city") or "").strip()
    today = timezone.localdate()

    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    SalesOrderItem = sources.model("orders", "SalesOrderItem", modules=modules)
    DistributorInvoice = sources.model("distribution", "DistributorInvoice", modules=modules)
    StockRequest = sources.model("distribution", "StockRequest", modules=modules)
    Visit = sources.model("field", "Visit", modules=modules)
    Lead = sources.model("crm", "Lead", modules=modules)
    DutyDay = sources.model("tracking", "DutyDay", modules=modules)
    OfficeAttendance = sources.model("attendance", "OfficeAttendance", modules=modules)
    WorkOrder = sources.model("production", "WorkOrder", modules=modules)
    ProductionPlan = sources.model("production", "ProductionPlan", modules=modules)
    PurchaseOrder = sources.model("purchase", "PurchaseOrder", modules=modules)
    MaterialRequest = sources.model("purchase", "MaterialRequest", modules=modules)

    city_of = _agent_city_map()
    # A manager sees THEIR team, not the whole company. This screen is the
    # richest in the product, and it was the only analytics endpoint that
    # ignored scoping entirely — every other one honours it.
    scoped_agents = scoped_agent_ids(user)
    # Territory is a single field on the user here (the previous platform kept a
    # JSON list and split revenue across cities; there is nothing to split now).
    if city:
        in_city = [uid for uid, c in city_of.items() if c.lower() == city.lower()]
        scoped_agents = in_city if scoped_agents is None else [
            uid for uid in scoped_agents if uid in set(in_city)]

    # Distributor parties in the same territory, so the PRIMARY stream is
    # filtered by the same city as the secondary one. Filtering only one of them
    # made the headline total mix a company-wide figure with a city figure.
    scoped_distributors = None
    if city:
        scoped_distributors = [
            p.pk for p in Party.objects.filter(is_active=True).only("pk", "address")
            if _party_city(p).lower() == city.lower()]

    # ---------------------------------------------------------------- revenue
    secondary, order_count = _secondary_revenue(from_date, to_date,
                                                agent_ids=scoped_agents, modules=modules)
    secondary_prev, order_count_prev = _secondary_revenue(prev_from, prev_to,
                                                          agent_ids=scoped_agents, modules=modules)
    primary, _ = _primary_revenue(from_date, to_date, modules=modules,
                                  party_ids=scoped_distributors)
    primary_prev, _ = _primary_revenue(prev_from, prev_to, modules=modules,
                                       party_ids=scoped_distributors)

    year_from = fy_start(today)
    fy_secondary, _ = _secondary_revenue(year_from, today, agent_ids=scoped_agents,
                                         modules=modules)
    fy_primary, _ = _primary_revenue(year_from, today, modules=modules,
                                     party_ids=scoped_distributors)

    revenue_trend = []
    for month_start in month_buckets(from_date if explicit else None,
                                     to_date if explicit else None, rolling=6):
        end = min(bucket_end(month_start), to_date) if explicit else bucket_end(month_start)
        month_secondary, _ = _secondary_revenue(month_start, end,
                                                agent_ids=scoped_agents, modules=modules)
        month_primary, _ = _primary_revenue(month_start, end, modules=modules,
                                            party_ids=scoped_distributors)
        revenue_trend.append({
            "month": month_start.strftime("%b %y") if explicit else month_start.strftime("%b"),
            "primary": _f(month_primary), "secondary": _f(month_secondary),
            "total": _f(month_primary) + _f(month_secondary),
        })

    # ---------------------------------------------------- stock requests, leads
    stock_request_count = stock_request_prev = 0
    if StockRequest is not None:
        stock_request_count = StockRequest.objects.filter(
            requested_at__date__range=(from_date, to_date)).count()
        stock_request_prev = StockRequest.objects.filter(
            requested_at__date__range=(prev_from, prev_to)).count()

    lead_count = lead_prev = 0
    leads_by_status, leads_by_area = [], []
    if Lead is not None:
        lead_count = Lead.objects.filter(created_at__date__range=(from_date, to_date)).count()
        lead_prev = Lead.objects.filter(created_at__date__range=(prev_from, prev_to)).count()
        status_rows = defaultdict(int)
        area_rows = defaultdict(int)
        windowed = Lead.objects.filter(created_at__date__range=(from_date, to_date))
        if scoped_agents is not None:
            windowed = windowed.filter(assigned_to_id__in=scoped_agents)
        for lead in windowed.only("status", "territory"):
            status_rows[lead.status] += 1
            area_rows[(lead.territory or "Unassigned").strip() or "Unassigned"] += 1
        leads_by_status = [{"status": k, "count": v} for k, v in sorted(status_rows.items())]
        leads_by_area = sorted(({"area": k, "count": v} for k, v in area_rows.items()),
                               key=lambda r: r["count"], reverse=True)[:10]

    # New clients: Party has no creator, so ownership + creation date is the
    # closest honest reading of "an agent brought this customer in".
    def _new_clients(start, end, agent_ids=None):
        qs = Party.objects.filter(kind__in=[Party.Kind.CUSTOMER, Party.Kind.BOTH],
                                  created_at__date__range=(start, end))
        if agent_ids is not None:
            qs = qs.filter(assigned_agent_id__in=agent_ids)
        return qs.count()

    new_clients = _new_clients(from_date, to_date, scoped_agents)
    new_clients_prev = _new_clients(prev_from, prev_to, scoped_agents)

    # ------------------------------------------------------------- visits
    visit_total = visit_done = visit_today = visit_today_done = 0
    visits_by_area = []
    if Visit is not None:
        visits = Visit.objects.filter(visit_date__range=(from_date, to_date))
        if scoped_agents is not None:
            visits = visits.filter(agent_id__in=scoped_agents)
        visit_total = visits.count()
        visit_done = visits.filter(status="completed").count()
        todays = Visit.objects.filter(visit_date=today)
        if scoped_agents is not None:
            todays = todays.filter(agent_id__in=scoped_agents)
        visit_today, visit_today_done = todays.count(), todays.filter(status="completed").count()

        area_rows = defaultdict(lambda: {"total": 0, "completed": 0})
        for visit in visits.select_related("party").only("status", "agent_id", "party"):
            area = (_party_city(visit.party) if visit.party_id else "") or \
                   city_of.get(visit.agent_id, "") or "Unassigned"
            area_rows[area]["total"] += 1
            if visit.status == "completed":
                area_rows[area]["completed"] += 1
        visits_by_area = sorted(({"area": k, **v} for k, v in area_rows.items()),
                                key=lambda r: r["total"], reverse=True)[:10]

    # --------------------------------------------------------- attendance
    field_present = office_present = 0
    field_staff = office_staff = 0
    roles = {u.pk: getattr(u.role, "slug", "") for u in
             TenantUser.objects.filter(is_active=True).select_related("role")}
    field_ids = [uid for uid, slug in roles.items() if slug in ("sales_agent", "field_agent")]
    office_ids = [uid for uid, slug in roles.items() if slug not in ("sales_agent", "field_agent")]
    field_staff, office_staff = len(field_ids), len(office_ids)
    if DutyDay is not None:
        field_present = DutyDay.objects.filter(
            date=today, punch_in_time__isnull=False, agent_id__in=field_ids
        ).values("agent_id").distinct().count()
    if OfficeAttendance is not None:
        office_present = OfficeAttendance.objects.filter(
            date=today, check_in_time__isnull=False, user_id__in=office_ids
        ).values("user_id").distinct().count()
    total_staff = field_staff + office_staff
    present = field_present + office_present

    attendance_trend = []
    for offset in range(6, -1, -1):
        day = today - timezone.timedelta(days=offset)
        field_n = (DutyDay.objects.filter(date=day, punch_in_time__isnull=False,
                                          agent_id__in=field_ids).values("agent_id")
                   .distinct().count() if DutyDay is not None else 0)
        office_n = (OfficeAttendance.objects.filter(date=day, check_in_time__isnull=False,
                                                    user_id__in=office_ids).values("user_id")
                    .distinct().count() if OfficeAttendance is not None else 0)
        attendance_trend.append({"day": day.strftime("%a"), "date": day.isoformat(),
                                 "field": field_n, "office": office_n,
                                 "total": field_n + office_n})

    # ------------------------------------------------------ product & area mix
    secondary_products = defaultdict(lambda: {"total": ZERO, "qty": ZERO})
    by_area = defaultdict(lambda: {"primary": ZERO, "secondary": ZERO})
    by_agent_product = defaultdict(lambda: defaultdict(lambda: {"total": ZERO, "qty": ZERO}))
    by_area_product = defaultdict(lambda: defaultdict(lambda: {"total": ZERO, "qty": ZERO}))
    if SalesOrderItem is not None and SalesOrder is not None:
        lines = SalesOrderItem.objects.filter(
            order__order_date__range=(from_date, to_date)
        ).exclude(order__status=SalesOrder.Status.REJECTED).select_related("order", "order__customer")
        if scoped_agents is not None:
            lines = lines.filter(order__assigned_agent_id__in=scoped_agents)
        for line in lines:
            # Line `amount` is EX-TAX (qty x rate), but the revenue KPIs sum
            # SalesOrder.total, which INCLUDES tax. Mixing the two put figures
            # ~12-18% apart on the same screen, and by_area compared them
            # directly against tax-inclusive distributor invoices. Gross the
            # line up so every number on this dashboard reconciles.
            gross = ((line.amount or ZERO)
                     * (1 + (line.tax_rate or ZERO) / 100)).quantize(Decimal("0.01"))
            secondary_products[line.item_name]["total"] += gross
            secondary_products[line.item_name]["qty"] += line.quantity or ZERO
            area = (_party_city(line.order.customer) if line.order.customer_id else "") or \
                   city_of.get(line.order.assigned_agent_id, "") or "Unassigned"
            by_area[area]["secondary"] += gross
            by_area_product[area][line.item_name]["total"] += gross
            by_area_product[area][line.item_name]["qty"] += line.quantity or ZERO
            if line.order.assigned_agent_id:
                bucket = by_agent_product[line.order.assigned_agent_id][line.item_name]
                bucket["total"] += gross
                bucket["qty"] += line.quantity or ZERO

    primary_products = defaultdict(lambda: {"total": ZERO, "qty": ZERO})
    by_distributor_product = defaultdict(lambda: defaultdict(lambda: {"total": ZERO, "qty": ZERO}))
    distributor_totals = defaultdict(lambda: {"total": ZERO, "requests": 0})
    if DistributorInvoice is not None:
        invoices = DistributorInvoice.objects.filter(
            invoice_date__range=(from_date, to_date)
        ).select_related("distributor", "request").prefetch_related("request__items")
        if scoped_distributors is not None:
            invoices = invoices.filter(distributor_id__in=scoped_distributors)
        for invoice in invoices:
            name = invoice.distributor.name if invoice.distributor_id else "Unknown"
            distributor_totals[invoice.distributor_id]["total"] += invoice.total_amount or ZERO
            distributor_totals[invoice.distributor_id]["requests"] += 1
            distributor_totals[invoice.distributor_id]["name"] = name
            area = (_party_city(invoice.distributor) if invoice.distributor_id else "") or "Unassigned"
            by_area[area]["primary"] += invoice.total_amount or ZERO
            if invoice.request_id:
                for line in invoice.request.items.all():
                    primary_products[line.item_name]["total"] += line.total_price or ZERO
                    primary_products[line.item_name]["qty"] += line.approved_quantity or ZERO
                    bucket = by_distributor_product[name][line.item_name]
                    bucket["total"] += line.total_price or ZERO
                    bucket["qty"] += line.approved_quantity or ZERO

    product_names = set(secondary_products) | set(primary_products)
    sales_by_product = sorted(({
        "name": name,
        "primary": _f(primary_products[name]["total"]),
        "secondary": _f(secondary_products[name]["total"]),
        "primary_qty": _f(primary_products[name]["qty"]),
        "secondary_qty": _f(secondary_products[name]["qty"]),
    } for name in product_names),
        key=lambda r: r["primary"] + r["secondary"], reverse=True)[:10]

    sales_by_area = sorted(({"area": k, "primary": _f(v["primary"]), "secondary": _f(v["secondary"])}
                            for k, v in by_area.items()),
                           key=lambda r: r["primary"] + r["secondary"], reverse=True)[:10]

    def _nest(mapping, limit_entities=8, limit_products=5):
        rows = []
        for entity, products in mapping.items():
            top = sorted(({"product": p, "total": _f(v["total"]), "qty": _f(v["qty"])}
                          for p, v in products.items()),
                         key=lambda r: r["total"], reverse=True)[:limit_products]
            rows.append({"entity": str(entity), "products": top})
        rows.sort(key=lambda r: sum(p["total"] for p in r["products"]), reverse=True)
        return rows[:limit_entities]

    agent_names = {u.pk: u.full_name for u in TenantUser.objects.all().only("pk", "full_name")}
    product_by_agent = _nest({agent_names.get(k, str(k)): v for k, v in by_agent_product.items()})
    product_by_distributor = _nest(by_distributor_product)
    product_by_area = _nest(by_area_product)

    # -------------------------------------------------------- leaderboards
    agent_performance = []
    for uid in field_ids:
        if scoped_agents is not None and uid not in scoped_agents:
            continue
        sales = ZERO
        if SalesOrder is not None:
            sales = _sum(SalesOrder.objects.filter(
                assigned_agent_id=uid, order_date__range=(from_date, to_date)
            ).exclude(status=SalesOrder.Status.REJECTED), "total")
        orders_n = (SalesOrder.objects.filter(
            assigned_agent_id=uid, order_date__range=(from_date, to_date)
        ).exclude(status=SalesOrder.Status.REJECTED).count() if SalesOrder is not None else 0)
        visits_n = (Visit.objects.filter(agent_id=uid, visit_date__range=(from_date, to_date),
                                         status="completed").count() if Visit is not None else 0)
        days = (DutyDay.objects.filter(agent_id=uid, date__range=(from_date, to_date),
                                       punch_in_time__isnull=False).count()
                if DutyDay is not None else 0)
        agent_performance.append({
            "id": uid, "name": agent_names.get(uid, ""), "city": city_of.get(uid, ""),
            "secondary_sales": _f(sales), "primary_sales": 0.0, "total_sales": _f(sales),
            "attendance_days": days, "visits": visits_n, "orders": orders_n,
            "new_clients": _new_clients(from_date, to_date, [uid]),
        })
    agent_performance.sort(key=lambda r: r["total_sales"], reverse=True)

    distributor_performance = []
    for party_id, row in distributor_totals.items():
        party = Party.objects.filter(pk=party_id).first()
        distributor_performance.append({
            "id": party_id, "name": row.get("name", ""),
            "city": _party_city(party) if party else "",
            "requests": row["requests"], "primary_revenue": _f(row["total"]),
            # Sell-out per distributor needs an order->distributor link the new
            # ORDERS model doesn't carry. Reported as unavailable, not as 0.
            "secondary_sales": None, "total_clients": None,
        })
    distributor_performance.sort(key=lambda r: r["primary_revenue"], reverse=True)

    sales_by_distributor = [{"name": r["name"], "city": r["city"], "total": r["primary_revenue"]}
                            for r in distributor_performance[:10]]

    # ------------------------------------------------- production / purchase
    production = {"work_orders_total": 0, "work_orders_in_progress": 0,
                  "work_orders_completed": 0, "active_plans": 0}
    if WorkOrder is not None:
        production["work_orders_total"] = WorkOrder.objects.count()
        production["work_orders_in_progress"] = WorkOrder.objects.filter(
            status=WorkOrder.Status.IN_PROGRESS).count()
        production["work_orders_completed"] = WorkOrder.objects.filter(
            status=WorkOrder.Status.COMPLETED).count()
    if ProductionPlan is not None:
        production["active_plans"] = ProductionPlan.objects.exclude(
            status__in=[ProductionPlan.Status.DRAFT, ProductionPlan.Status.COMPLETED]).count()

    purchase = {"pending_pos": 0, "approved_value": 0.0, "approved_count": 0, "pending_mrs": 0}
    if PurchaseOrder is not None:
        pending = PurchaseOrder.objects.filter(status__in=[
            PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.PENDING_APPROVAL])
        approved = PurchaseOrder.objects.filter(status__in=[
            PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.SENT])
        purchase["pending_pos"] = pending.count()
        purchase["approved_count"] = approved.count()
        purchase["approved_value"] = _f(_sum(approved, "total"))
    if MaterialRequest is not None:
        purchase["pending_mrs"] = MaterialRequest.objects.filter(
            status__in=[MaterialRequest.Status.DRAFT,
                        MaterialRequest.Status.PENDING_APPROVAL]).count()

    from .services import _outstanding, stock_summary

    warehouse = stock_summary(modules)
    available_cities = sorted({c for c in city_of.values() if c})

    return {
        "kpis": {
            "total_revenue": {
                **_kpi(_f(primary) + _f(secondary), _f(primary_prev) + _f(secondary_prev)),
                "fy_total": _f(fy_primary) + _f(fy_secondary),
            },
            "primary_revenue": _kpi(primary, primary_prev),
            "secondary_revenue": _kpi(secondary, secondary_prev),
            "orders": _kpi(order_count, order_count_prev),
            "stock_requests": _kpi(stock_request_count, stock_request_prev),
            "new_clients": _kpi(new_clients, new_clients_prev),
            "visits": {"value": visit_total, "completed": visit_done,
                       "today": visit_today, "today_done": visit_today_done},
            "leads": _kpi(lead_count, lead_prev),
            "attendance": {
                "rate": round(present / total_staff * 100, 1) if total_staff else 0.0,
                "present": present, "total": total_staff,
                "field": field_present, "office": office_present,
            },
            "outstanding": _f(_outstanding(modules=modules)),
        },
        "revenue_trend": revenue_trend,
        "revenue_split": {"primary": _f(primary), "secondary": _f(secondary)},
        "sales_by_area": sales_by_area,
        "sales_by_distributor": sales_by_distributor,
        "sales_by_product": sales_by_product,
        "product_by_distributor": product_by_distributor,
        "product_by_agent": product_by_agent,
        "product_by_area": product_by_area,
        "agent_performance": agent_performance[:15],
        "distributor_performance": distributor_performance[:15],
        "visits_by_area": visits_by_area,
        "leads_by_status": leads_by_status,
        "leads_by_area": leads_by_area,
        "attendance_trend": attendance_trend,
        "production": production,
        "purchase": purchase,
        "warehouse": warehouse,
        "available_cities": available_cities,
        "area": city or None,
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
    }


def entity_detail(params, user):
    """Drill-down for one agent or one distributor."""
    modules = sources.entitled_modules()
    entity_type = (params.get("type") or "").strip()
    entity_id = _as_int(params.get("id"))
    if entity_type not in ("agent", "distributor") or not entity_id:
        return None, {"detail": "Query params 'type' (agent|distributor) and a numeric "
                                "'id' are required."}

    today = timezone.localdate()
    from_date = parse_date(params.get("from_date")) or today.replace(day=1)
    to_date = parse_date(params.get("to_date")) or today

    SalesOrder = sources.model("orders", "SalesOrder", modules=modules)
    SalesOrderItem = sources.model("orders", "SalesOrderItem", modules=modules)
    DistributorInvoice = sources.model("distribution", "DistributorInvoice", modules=modules)
    Visit = sources.model("field", "Visit", modules=modules)
    DutyDay = sources.model("tracking", "DutyDay", modules=modules)

    products = defaultdict(lambda: {"total": ZERO, "qty": ZERO})
    trend, extra = [], {}

    if entity_type == "agent":
        agent = TenantUser.objects.filter(pk=entity_id).first()
        if agent is None:
            return None, {"detail": "Entity not found."}
        name, city = agent.full_name, _city_of(agent)
        secondary, orders_n = _secondary_revenue(from_date, to_date,
                                                 agent_ids=[agent.pk], modules=modules)
        primary = ZERO
        if SalesOrderItem is not None and SalesOrder is not None:
            for line in SalesOrderItem.objects.filter(
                order__assigned_agent_id=agent.pk,
                order__order_date__range=(from_date, to_date),
            ).exclude(order__status=SalesOrder.Status.REJECTED):
                products[line.item_name]["total"] += line.amount or ZERO
                products[line.item_name]["qty"] += line.quantity or ZERO
        for month_start in month_buckets(from_date, to_date):
            value, _ = _secondary_revenue(month_start, min(bucket_end(month_start), to_date),
                                          agent_ids=[agent.pk], modules=modules)
            trend.append({"month": month_start.strftime("%b %y"),
                          "primary": 0.0, "secondary": _f(value)})
        extra = {
            "orders": orders_n,
            "visits": (Visit.objects.filter(agent_id=agent.pk, status="completed",
                                            visit_date__range=(from_date, to_date)).count()
                       if Visit is not None else 0),
            "new_clients": Party.objects.filter(
                assigned_agent_id=agent.pk,
                created_at__date__range=(from_date, to_date)).count(),
            "attendance_days": (DutyDay.objects.filter(
                agent_id=agent.pk, date__range=(from_date, to_date),
                punch_in_time__isnull=False).count() if DutyDay is not None else 0),
        }
    else:
        party = Party.objects.filter(pk=entity_id).first()
        if party is None:
            return None, {"detail": "Entity not found."}
        name, city = party.name, _party_city(party)
        secondary = ZERO      # no order->distributor link exists in ORDERS
        primary = ZERO
        requests = 0
        if DistributorInvoice is not None:
            invoices = DistributorInvoice.objects.filter(
                distributor_id=party.pk, invoice_date__range=(from_date, to_date)
            ).select_related("request").prefetch_related("request__items")
            requests = invoices.count()
            for invoice in invoices:
                primary += invoice.total_amount or ZERO
                if invoice.request_id:
                    for line in invoice.request.items.all():
                        products[line.item_name]["total"] += line.total_price or ZERO
                        products[line.item_name]["qty"] += line.approved_quantity or ZERO
            for month_start in month_buckets(from_date, to_date):
                window = invoices.filter(
                    invoice_date__range=(month_start, min(bucket_end(month_start), to_date)))
                trend.append({"month": month_start.strftime("%b %y"),
                              "primary": _f(_sum(window, "total_amount")), "secondary": 0.0})
        extra = {"requests": requests, "total_clients": None}

    top_products = sorted(({"product": k, "total": _f(v["total"]), "qty": _f(v["qty"])}
                           for k, v in products.items()),
                          key=lambda r: r["total"], reverse=True)[:10]

    return {
        "id": entity_id, "name": name, "type": entity_type, "city": city,
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "revenue": {"primary": _f(primary), "secondary": _f(secondary),
                    "total": _f(primary) + _f(secondary)},
        "products": top_products,
        "trend": trend,
        **extra,
    }, None
