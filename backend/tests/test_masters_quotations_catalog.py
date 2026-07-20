"""Masters, CRM quotations, the client-profile drawer, and the catalog aliases.

Headline for the drawer: `/t/parties/{id}/detail/` assembles orders, visits and
distributor history from THREE modules that foundation must not import — every
section comes through the capability registry, so a tenant sees exactly the
sections they bought and the drawer still opens for everyone else.
"""
import pytest
from django.utils import timezone

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _party(api, token, name="Retail Mart", kind="customer"):
    return auth(api, token).post("/api/t/parties/", {"name": name, "kind": kind}).data["id"]


def _item(api, token, name="Soap", price="30", tax="12"):
    return auth(api, token).post("/api/t/catalog/", {
        "name": name, "price": price, "tax_rate": tax}).data["id"]


# ---------------------------------------------------------------- masters
def test_tax_slabs_and_uom(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")     # core: no module needed
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    slab = client.post("/api/masters/tax-slabs/", {
        "name": "GST 18%", "percentage": "18", "hsn_codes": [" 3401 ", "3402", ""],
        "description": "Standard rate"})
    assert slab.status_code == 201
    # codes are normalised so a lookup by HSN can't miss on stray whitespace
    assert slab.data["hsn_codes"] == ["3401", "3402"]

    assert client.post("/api/masters/tax-slabs/", {
        "name": "Nonsense", "percentage": "150"}).status_code == 400

    client.post("/api/masters/uom/", {"uom_name": "Piece", "symbol": "pcs",
                                      "is_base_unit": True})
    client.post("/api/masters/uom/", {"uom_name": "Box", "symbol": "box",
                                      "conversion_factor": "12"})
    listing = client.get("/api/masters/uom/").data
    assert listing["count"] == 2
    assert [r["uom_name"] for r in listing["results"]] == ["Box", "Piece"]

    filtered = client.get("/api/masters/tax-slabs/?is_active=true").data
    assert filtered["count"] == 1


def test_masters_writes_are_admin_only(api, make_tenant, tenant_token):
    """Changing a tax slab changes what every future invoice charges."""
    tenant, _ = make_tenant(package_code="P2")
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": "agent@mst.test", "full_name": "Agent", "role_slug": "sales_agent",
        "password": "agent-pass-123", "password_confirm": "agent-pass-123"})
    agent = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": "agent@mst.test",
        "password": "agent-pass-123"}).data["access"]

    assert auth(api, agent).get("/api/masters/tax-slabs/").status_code == 200
    assert auth(api, agent).post("/api/masters/tax-slabs/", {
        "name": "Free", "percentage": "0"}).status_code == 403


# ------------------------------------------------------------- quotations
def test_quotation_prices_itself_and_winning_converts_the_lead(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P3")   # CRM
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    lead = client.post("/api/t/crm/leads/", {
        "name": "Nova Retail", "company_name": "Nova", "phone": "9876500000"}).data
    quote = client.post("/api/t/crm/quotations/", {
        "party": lead["party_id"], "lead": lead["id"],
        "quotation_date": str(timezone.localdate()),
        "items": [{"item": _item(api, token), "quantity": 10, "rate": "50", "tax_rate": "18"}],
    })
    assert quote.status_code == 201
    assert str(quote.data["subtotal"]) == "500.00"     # computed, not sent
    assert str(quote.data["tax_amount"]) == "90.00"
    assert str(quote.data["total"]) == "590.00"
    assert quote.data["status"] == "draft" and quote.data["quotation_number"]

    qid = quote.data["id"]
    # you cannot win a quotation that was never sent
    assert client.post(f"/api/t/crm/quotations/{qid}/mark_won/").status_code == 400
    assert client.post(f"/api/t/crm/quotations/{qid}/submit/").data["status"] == "submitted"

    won = client.post(f"/api/t/crm/quotations/{qid}/mark_won/")
    assert won.status_code == 200 and won.data["status"] == "won"
    # winning converts the lead behind it — otherwise the pipeline shows a won
    # deal still sitting in the funnel
    assert client.get(f"/api/t/crm/leads/{lead['id']}/").data["status"] == "converted"
    # a won quotation is terminal
    assert client.post(f"/api/t/crm/quotations/{qid}/mark_lost/",
                       {"reason": "changed mind"}).status_code == 400


def test_quotation_is_served_on_both_prefixes_and_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P3")
    token = tenant_token(tenant)["access"]
    # the ported screens call /crm/, the API's own path is /t/crm/
    assert auth(api, token).get("/api/crm/quotations/").status_code == 200
    assert auth(api, token).get("/api/t/crm/quotations/").status_code == 200

    other, _ = make_tenant(package_code="P1")    # TRACK only — no CRM
    assert auth(api, tenant_token(other)["access"]).get(
        "/api/t/crm/quotations/").status_code == 403


# --------------------------------------------------- the client-profile drawer
def test_party_detail_assembles_across_modules_without_importing_them(
        api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")   # everything
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)

    client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 10, "rate": "30"}]})

    detail = client.get(f"/api/t/parties/{party}/detail/")
    assert detail.status_code == 200
    assert detail.data["order_count"] == 1
    assert detail.data["total_order_amount"] == 300.0
    assert detail.data["product_sales"][0]["product"] == "Soap"
    assert detail.data["ledger_available"] is True      # BOOKS is entitled here


def test_party_detail_still_opens_without_the_modules(api, make_tenant, tenant_token):
    """A tenant who bought neither ORDERS nor FIELD gets empty sections, not a
    500 and not a 404."""
    tenant, _ = make_tenant(package_code="P1")   # TRACK only
    token = tenant_token(tenant)["access"]
    party = _party(api, token)

    detail = auth(api, token).get(f"/api/t/parties/{party}/detail/")
    assert detail.status_code == 200
    assert detail.data["orders"] == [] and detail.data["order_count"] == 0
    assert detail.data["visits"] == []
    assert detail.data["distributor"] is None
    # ...and the screen is told the ledger isn't available, so it can say so
    # rather than render an empty statement that looks like a zero balance
    assert detail.data["ledger_available"] is False


# ------------------------------------------------------- catalog compatibility
def test_warehouse_paths_serve_the_one_catalog(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")   # ORDERS + INV + DIST
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    created = client.post("/api/warehouse/items/", {
        "item_name": "Detergent", "item_code": "DET-1", "selling_price": "80",
        "tax_rate": "18", "uom": "pcs", "hsn_code": "3402"})
    assert created.status_code == 201
    assert created.data["item_name"] == "Detergent" and created.data["sku"] == "DET-1"

    # /warehouse/products/ is the SAME table — the previous platform kept two
    assert client.get("/api/warehouse/products/").data["count"] == 1
    # ...and so is /t/catalog/
    assert client.get("/api/t/catalog/").data["count"] == 1

    item_id = created.data["id"]
    # stock is INV's, reached through the capability registry
    assert client.post(f"/api/warehouse/items/{item_id}/set-stock/",
                       {"quantity": 40}).data["on_hand"] == 40.0
    assert client.get(f"/api/warehouse/items/{item_id}/").data["quantity"] == 40.0


def test_catalog_quantity_is_null_not_zero_without_inv(api, make_tenant, tenant_token):
    """A screen must be able to tell 'we don't track stock' from 'we have none'."""
    tenant, _ = make_tenant(package_code="P2")   # FIELD only — no INV
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    client.post("/api/warehouse/items/", {"item_name": "Detergent", "selling_price": "80"})

    row = client.get("/api/warehouse/items/").data["results"][0]
    assert row["quantity"] is None
    # low-stock is empty rather than claiming everything is out of stock
    assert client.get("/api/warehouse/items/low_stock/").data["count"] == 0
    # ...and correcting stock says why it can't, instead of silently doing nothing
    refused = client.post(f"/api/warehouse/items/{row['id']}/set-stock/", {"quantity": 5})
    assert refused.status_code == 400 and "Inventory" in refused.data["detail"]
