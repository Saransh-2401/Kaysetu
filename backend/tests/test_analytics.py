"""ANALYTICS: dashboards across every module — without importing one.

Headline: analytics resolves other modules' models by LABEL at call time and
gates each on entitlement, so it couples to nothing and a tenant on the smallest
package still gets a dashboard (with the blocks they didn't buy reporting zero
rather than erroring).
"""
import pytest
from django.utils import timezone

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _party(api, token, name="Retail Mart", kind="customer"):
    return auth(api, token).post("/api/t/parties/", {"name": name, "kind": kind}).data["id"]


def _item(api, token, name="Soap", price="30", tax="12"):
    return auth(api, token).post("/api/t/catalog/", {
        "name": name, "price": price, "tax_rate": tax}).data["id"]


def _order(client, party, item, name="Soap", qty=10, rate="30"):
    return client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": name, "quantity": qty,
                   "rate": rate, "tax_rate": "12"}]}).data


# ------------------------------------------------------------- THE HEADLINE
def test_dashboard_degrades_to_zero_without_the_modules(api, make_tenant, tenant_token):
    """A TRACK-only tenant gets a real dashboard, not a 403 or a crash."""
    tenant, _ = make_tenant(package_code="P1")   # TRACK only
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    data = client.get("/api/analytics/admin/dashboard/")
    assert data.status_code == 200
    body = data.data
    # blocks fed by unbought modules report zero...
    assert body["kpis"]["secondary_revenue"]["value"] == 0.0
    assert body["kpis"]["primary_revenue"]["value"] == 0.0
    assert body["production"]["work_orders_total"] == 0
    assert body["purchase"]["pending_pos"] == 0
    # ...but the shape the screen destructures is fully present
    for key in ("revenue_trend", "sales_by_area", "agent_performance",
                "attendance_trend", "warehouse", "period", "available_cities"):
        assert key in body

    # and every other report answers too
    for path in ("/api/analytics/sales/overview/", "/api/analytics/purchase/overview/",
                 "/api/analytics/crm/leads-funnel/", "/api/analytics/field-sales/overview/",
                 "/api/analytics/warehouse/stock-levels/", "/api/analytics/sales/reports/"):
        assert client.get(path).status_code == 200, path


def test_sales_overview_counts_real_orders(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    _order(client, party, item)                     # 10 x 30 = 300 + 12% = 336

    overview = client.get("/api/analytics/sales/overview/").data["overview"]
    assert overview["total_sales_value"] == 336.0
    assert overview["pending_orders_count"] == 1    # still processing
    assert overview["outstanding_amount"] == 336.0  # nothing paid yet
    assert len(overview["sales_trend"]) == 6

    top = client.get("/api/analytics/sales/by-customer/").data["top_customers"]
    assert top[0]["customer_name"] == "Retail Mart" and top[0]["total_sales"] == 336.0


def test_dashboard_separates_primary_from_secondary_revenue(api, make_tenant, tenant_token):
    """The point of the screen: stock leaving us vs stock actually selling."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    customer, item = _party(api, token), _item(api, token)
    _order(client, customer, item)                  # secondary = 336

    body = client.get("/api/analytics/admin/dashboard/").data
    assert body["kpis"]["secondary_revenue"]["value"] == 336.0
    assert body["kpis"]["primary_revenue"]["value"] == 0.0     # no distributor billing yet
    assert body["revenue_split"] == {"primary": 0.0, "secondary": 336.0}
    assert body["kpis"]["total_revenue"]["value"] == 336.0
    assert body["sales_by_product"][0]["name"] == "Soap"
    # The product mix must be on the SAME tax basis as the KPI above it. Line
    # amounts are ex-tax while SalesOrder.total includes tax, so summing them
    # raw put two figures on one screen ~12% apart and made the product table
    # irreconcilable with the headline.
    assert body["sales_by_product"][0]["secondary"] == 336.0
    assert (sum(row["secondary"] for row in body["sales_by_product"])
            == body["kpis"]["secondary_revenue"]["value"])
    assert (sum(row["secondary"] for row in body["sales_by_area"])
            == body["kpis"]["secondary_revenue"]["value"])


def test_admin_dashboard_is_manager_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": "agent@an.test", "full_name": "Agent", "role_slug": "sales_agent",
        "password": "agent-pass-123", "password_confirm": "agent-pass-123"})
    agent = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": "agent@an.test",
        "password": "agent-pass-123"}).data["access"]

    assert auth(api, agent).get("/api/analytics/admin/dashboard/").status_code == 403
    assert auth(api, agent).get("/api/analytics/sales/reports/").status_code == 403
    # ...but an agent can always see their OWN numbers
    assert auth(api, agent).get("/api/analytics/sales-agent/overview/").status_code == 200


def test_agent_overview_is_scoped_to_the_caller(api, make_tenant, tenant_token):
    """An agent must not be able to read a colleague's figures by guessing an id."""
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    client = auth(api, owner)
    party, item = _party(api, owner), _item(api, owner)

    for email in ("a1@sc.test", "a2@sc.test"):
        auth(api, owner).post("/api/t/users/", {
            "email": email, "full_name": email, "role_slug": "sales_agent",
            "password": "agent-pass-123", "password_confirm": "agent-pass-123"})
    login_one = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": "a1@sc.test", "password": "agent-pass-123"}).data
    login_two = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": "a2@sc.test", "password": "agent-pass-123"}).data

    # agent two books an order
    auth(api, login_two["access"]).post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 10, "rate": "30"}]})

    # agent one asking for agent two's id gets their OWN (empty) figures back
    mine = auth(api, login_one["access"]).get(
        f"/api/analytics/sales-agent/overview/?agent_id={login_two['user']['id']}").data
    assert mine["agent_name"] == "a1@sc.test"
    assert mine["kpis"]["total_sales"] == 0.0

    # the owner may look at anyone
    theirs = auth(api, owner).get(
        f"/api/analytics/sales-agent/overview/?agent_id={login_two['user']['id']}").data
    assert theirs["agent_name"] == "a2@sc.test" and theirs["kpis"]["total_sales"] == 300.0


def test_warehouse_report_reads_real_stock(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item = _item(api, token, "Widget", price="20")
    client.post("/api/t/inv/receive", {"item": item, "quantity": 50, "rate": 20})

    report = client.get("/api/analytics/warehouse/stock-levels/?movement_days=14").data
    assert report["movement_days"] == 14
    assert len(report["movement_trend"]) == 14
    assert report["overview"]["total_items"] == 1
    assert report["overview"]["estimated_stock_value"] == 1000.0     # 50 x 20
    # stock accuracy needs a counted-vs-system pair the ledger doesn't record —
    # reported as unavailable rather than as a made-up percentage
    assert report["kpis"]["accuracy"] == "—"
    assert report["kpis"]["accuracy_status"] == "no_audit"
    # an out-of-range movement window falls back rather than erroring
    assert client.get(
        "/api/analytics/warehouse/stock-levels/?movement_days=999").data["movement_days"] == 7


def test_entity_detail_requires_type_and_id(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    assert client.get("/api/analytics/admin/entity-detail/").status_code == 400
    assert client.get("/api/analytics/admin/entity-detail/?type=agent&id=999999").status_code == 404

    party, item = _party(api, token), _item(api, token)
    me = client.get("/api/auth/users/me/").data["id"]
    _order(client, party, item)
    detail = client.get(f"/api/analytics/admin/entity-detail/?type=agent&id={me}").data
    assert detail["type"] == "agent" and "period" in detail and "revenue" in detail


def test_report_targets_are_real_not_invented(api, make_tenant, tenant_token):
    """The previous platform used `target = actual * 1.1` and a flat 100000
    quota, which made attainment meaningless. With no target set, report 0."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    _order(client, party, item)

    reports = client.get("/api/analytics/sales/reports/").data
    assert all(row["target"] == 0.0 for row in reports["revenue_trend"])
    assert reports["kpis"]["quota_attainment"] == 0.0
    assert reports["kpis"]["total_deals"] == 1
    assert reports["kpis"]["avg_deal_size"] == 336.0
    # the funnel is drawn from Lead statuses that exist, not a deleted model
    assert [row["name"] for row in reports["funnel_data"]] == [
        "Total Leads", "Qualified", "Interested", "Converted"]


def test_analytics_needs_a_tenant_token(api, make_tenant, admin_token):
    make_tenant(package_code="P8")
    assert auth(api, admin_token).get("/api/analytics/admin/dashboard/").status_code == 403
    api.credentials()
    assert api.get("/api/analytics/sales/overview/").status_code == 401


def test_read_scoping_holds_across_documents_and_figures(api, make_tenant, tenant_token):
    """An agent uninvolved in a document must not see it — anywhere.

    Regression for a real hole: /sales/invoices/ and /sales/payments/ applied
    no user scoping at all (the sibling manual-invoice viewset did), so a field
    agent could list every invoice, customer and total in the company.
    """
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    party = auth(api, owner).post(
        "/api/t/parties/", {"name": "Secret Mart", "kind": "customer"}).data["id"]
    item = _item(api, owner, "Soap", price="100", tax="18")

    invoice = auth(api, owner).post("/api/sales/invoices/", {
        "customer": party, "invoice_date": str(timezone.localdate()),
        "items": [{"item": item, "quantity": 10, "rate": "100", "tax_rate": "18"}]}).data
    auth(api, owner).post("/api/sales/payments/", {
        "amount": "500", "sales_invoice": invoice["id"], "mode": "bank"})

    auth(api, owner).post("/api/t/users/", {
        "email": "agent21@sc.test", "full_name": "Agent21", "role_slug": "sales_agent",
        "password": "agent-pass-123", "password_confirm": "agent-pass-123"})
    agent = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": "agent21@sc.test",
        "password": "agent-pass-123"}).data["access"]

    # the customer is not assigned to this agent, so none of it is theirs
    assert auth(api, agent).get("/api/sales/invoices/").data["count"] == 0
    assert auth(api, agent).get("/api/sales/payments/").data["count"] == 0
    # manual invoices are an accounts instrument — not merely empty, refused
    assert auth(api, agent).get("/api/sales/manual-invoices/").status_code == 403

    # ...and the owner still sees everything
    assert auth(api, owner).get("/api/sales/invoices/").data["count"] == 1


def test_monthly_target_does_not_double_count_the_global_row(api, make_tenant, tenant_token):
    """SalesTarget stores a GLOBAL monthly target (agent is null) alongside
    per-agent rows. Summing both inflated the target and halved attainment."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    today = timezone.localdate()
    me = client.get("/api/auth/users/me/").data["id"]

    client.post("/api/t/field/targets/", {
        "agent": me, "month": today.month, "year": today.year,
        "revenue_target": "100000"}, format="json")
    client.post("/api/t/field/targets/", {           # global row, agent omitted
        "month": today.month, "year": today.year,
        "revenue_target": "500000"}, format="json")

    reports = client.get("/api/analytics/sales/reports/").data
    row = next(r for r in reports["revenue_trend"] if r["month"] == today.strftime("%b"))
    # the per-agent rows are the target; the company row is not added on top
    assert row["target"] == 100000.0
