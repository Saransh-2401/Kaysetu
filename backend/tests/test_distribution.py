"""MOD-DIST: Distribution Network — the distributor channel.

Headline: approving a stock request allocates against the company's REAL stock
(asked from INV via capability, recording any shortage), dispatching deducts that
stock, and invoicing posts Dr AR / Cr Sales in BOOKS — with no module importing
another. DIST runs standalone when a tenant has neither INV nor BOOKS.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _item(api, token, name="Soap", price="50"):
    return auth(api, token).post("/api/t/catalog/", {"name": name, "price": price, "tax_rate": "0"}).data["id"]


def _distributor(api, token, name="North Distributor"):
    return auth(api, token).post("/api/t/parties/", {"name": name, "kind": "customer"}).data["id"]


def _request(client, distributor, item, qty=10):
    return client.post("/api/t/dist/stock-requests/", {
        "distributor": distributor,
        "items": [{"item": item, "requested_quantity": qty}]}).data


# ------------------------------------------------------------- standalone (P4)
def test_stock_request_prices_from_catalog(api, make_tenant, tenant_token):
    """Unit price comes from the catalog, never from the client."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token, price="50"), _distributor(api, token)

    req = client.post("/api/t/dist/stock-requests/", {
        "distributor": dist, "total_amount": "999999",   # ignored
        "items": [{"item": item, "requested_quantity": 10, "unit_price": "1"}]}).data
    assert str(req["total_amount"]) == "500.00"          # 10 x catalog 50
    assert req["status"] == "pending" and req["request_number"] == req["number"]
    assert len(req["logs"]) == 1                          # status trail started


def test_request_state_machine_and_rejection(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    req = _request(client, dist, item)

    # cannot dispatch straight from pending
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/").status_code == 400
    # rejection needs a reason
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/reject/", {}).status_code == 400
    rejected = client.post(f"/api/t/dist/stock-requests/{req['id']}/reject/", {"reason": "no stock"})
    assert rejected.status_code == 200 and rejected.data["status"] == "rejected"
    # a rejected request is terminal
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/").status_code == 400


def test_dist_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # FIELD only
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/dist/stock-requests/").status_code == 403


# ------------------------------------------------------------- THE HEADLINE (P4/P8)
def test_approval_allocates_against_real_inv_stock(api, make_tenant, tenant_token):
    """P4 has INV: approving caps the allocation at what's actually in stock and
    records the rest as a shortage — DIST asks INV, it never imports it."""
    tenant, _ = make_tenant(package_code="P4")   # ORDERS + INV + DIST
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 6, "rate": 30})  # only 6 on hand

    req = _request(client, dist, item, qty=10)                                    # asks for 10
    approved = client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/").data
    line = approved["items"][0]
    assert str(line["approved_quantity"]) == "6.000"      # capped by real stock
    assert str(line["shortage_quantity"]) == "4.000"
    assert approved["has_shortage"] is True
    assert str(approved["total_amount"]) == "300.00"      # repriced to 6 x 50


def test_dispatch_moves_stock_company_to_distributor(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 20, "rate": 30})

    req = _request(client, dist, item, qty=8)
    client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/")
    client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/")

    # company stock down (INV, via event)
    levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
    assert str(levels[0]["on_hand"]) == "12.000"          # 20 - 8
    # distributor's own book up (DIST owns it)
    ds = client.get(f"/api/t/dist/distributor-stock/?distributor={dist}").data["results"]
    assert len(ds) == 1 and str(ds[0]["on_hand"]) == "8.000"


def test_invoice_posts_receivable_in_books(api, make_tenant, tenant_token):
    """P8 has BOOKS: invoicing a dispatched request posts Dr AR / Cr Sales and
    shows on the distributor's statement."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 20, "rate": 30})
    req = _request(client, dist, item, qty=8)
    client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/")
    client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/")

    # cannot invoice twice
    inv = client.post(f"/api/t/dist/stock-requests/{req['id']}/invoice/", {})
    assert inv.status_code == 201 and str(inv.data["total_amount"]) == "400.00"
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/invoice/", {}).status_code == 400

    with use_tenant(tenant):
        from apps.books import services
        assert services.party_balance(dist) == 400.0     # distributor owes us
    stmt = client.get(f"/api/t/parties/{dist}/ledger/").data
    assert stmt["closing_balance"] == 400.0

    # settling the invoice clears the request
    client.post(f"/api/t/dist/invoices/{inv.data['id']}/mark_paid/", {})
    assert client.get(f"/api/t/dist/invoices/{inv.data['id']}/").data["status"] == "paid"
    assert client.get(f"/api/t/dist/stock-requests/{req['id']}/").data["payment_status"] == "paid"


def test_dist_invoice_does_not_collide_with_orders_invoice(api, make_tenant, tenant_token):
    """Both channels post through BOOKS' sales-invoice path; their idempotency
    keys are namespaced, so invoice #1 from each must produce TWO journals."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    party = _distributor(api, token)
    with use_tenant(tenant):
        from apps.books.models import JournalEntry
        from apps.books import services
        services.post_sales_invoice(invoice_id=1, party_id=party, total="100",
                                    source_key="orders.invoice")
        services.post_sales_invoice(invoice_id=1, party_id=party, total="250",
                                    source_key="dist.invoice")
        assert JournalEntry.objects.filter(source="sales_invoice").count() == 2
        assert services.party_balance(party) == 350.0


# ------------------------------------------------- review-hardening regressions
def _staff(api, tenant, tenant_token, role_slug, email, party=None):
    owner = tenant_token(tenant)["access"]
    body = {"email": email, "full_name": "Staff", "role_slug": role_slug,
            "password": "staff-pass-123", "password_confirm": "staff-pass-123"}
    uid = auth(api, owner).post("/api/t/users/", body).data["id"]
    if party is not None:
        with use_tenant_ctx(tenant):
            from apps.foundation.models import TenantUser
            TenantUser.objects.filter(pk=uid).update(party_id=party)
    login = api.post("/api/auth/tenant/login",
                     {"org_code": tenant.org_code, "email": email, "password": "staff-pass-123"})
    return login.data["access"]


use_tenant_ctx = use_tenant


def test_privileged_actions_require_a_manager(api, make_tenant, tenant_token):
    """FIX: get_permissions() used to return a hardcoded list, making every
    per-action IsDistManager gate dead code — a distributor could self-approve,
    self-dispatch and self-invoice their own request."""
    tenant, _ = make_tenant(package_code="P4")
    owner = tenant_token(tenant)["access"]
    item, dist = _item(api, owner), _distributor(api, owner)
    auth(api, owner).post("/api/t/inv/receive", {"item": item, "quantity": 50, "rate": 10})
    dist_user = _staff(api, tenant, tenant_token, "distributor", "d1@dist.test", party=dist)

    req = _request(auth(api, dist_user), dist, item, qty=5)      # may raise their own request
    for action in ("approve", "dispatch", "invoice"):
        assert auth(api, dist_user).post(
            f"/api/t/dist/stock-requests/{req['id']}/{action}/", {}).status_code == 403
    assert auth(api, owner).post(f"/api/t/dist/stock-requests/{req['id']}/approve/").status_code == 200


def test_allocation_override_cannot_exceed_real_stock(api, make_tenant, tenant_token):
    """FIX: an explicit allocation used to skip the inventory cap entirely,
    minting phantom stock for the distributor."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 5, "rate": 10})

    req = _request(client, dist, item, qty=10000)
    approved = client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/",
                           {"allocations": {str(item): 10000}}).data
    assert str(approved["items"][0]["approved_quantity"]) == "5.000"   # capped at real stock

    # an override may still REDUCE the allocation (top up stock first — the
    # approval above reserved all 5, so nothing is available until we receive more)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 10, "rate": 10})
    req2 = _request(client, dist, item, qty=4)
    a2 = client.post(f"/api/t/dist/stock-requests/{req2['id']}/approve/",
                     {"allocations": {str(item): 2}}).data
    assert str(a2["items"][0]["approved_quantity"]) == "2.000"


def test_approval_reserves_so_stock_is_not_double_promised(api, make_tenant, tenant_token):
    """FIX: approval only READ stock, so two requests could each be promised the
    same units. It now reserves through INV."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item = _item(api, token)
    d1, d2 = _distributor(api, token, "D1"), _distributor(api, token, "D2")
    client.post("/api/t/inv/receive", {"item": item, "quantity": 100, "rate": 10})

    r1 = _request(client, d1, item, qty=80)
    r2 = _request(client, d2, item, qty=80)
    a1 = client.post(f"/api/t/dist/stock-requests/{r1['id']}/approve/").data
    a2 = client.post(f"/api/t/dist/stock-requests/{r2['id']}/approve/").data
    assert str(a1["items"][0]["approved_quantity"]) == "80.000"
    assert str(a2["items"][0]["approved_quantity"]) == "20.000"   # only 20 left unreserved
    assert a2["has_shortage"] is True

    # rejecting r1 hands its reservation back
    client.post(f"/api/t/dist/stock-requests/{r1['id']}/reject/", {"reason": "cancelled"})
    with use_tenant(tenant):
        from apps.inventory.models import StockLevel
        assert float(StockLevel.objects.get(item_id=item).reserved) == 20.0   # only r2 still holds


def test_duplicate_item_lines_rejected(api, make_tenant, tenant_token):
    """FIX: two lines of the same item were each allocated against the same
    available stock, over-promising within a single request."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    bad = client.post("/api/t/dist/stock-requests/", {
        "distributor": dist,
        "items": [{"item": item, "requested_quantity": 5},
                  {"item": item, "requested_quantity": 5}]})
    assert bad.status_code == 400


def test_distributor_payment_clears_receivable_in_books(api, make_tenant, tenant_token):
    """FIX: dist.payment_received had NO subscriber, so distributor AR was raised
    and never cleared."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 20, "rate": 30})
    req = _request(client, dist, item, qty=8)
    client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/")
    client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/")
    inv = client.post(f"/api/t/dist/stock-requests/{req['id']}/invoice/", {}).data

    with use_tenant(tenant):
        from apps.books import services
        assert services.party_balance(dist) == 400.0
    client.post(f"/api/t/dist/invoices/{inv['id']}/mark_paid/", {})
    with use_tenant(tenant):
        from apps.books import services
        assert services.party_balance(dist) == 0.0          # receivable cleared
    bs = client.get("/api/t/books/reports/balance-sheet/").data
    assert bs["balance_check"]["balanced"] and bs["assets"]["cash_and_bank"] == 400.0


def test_dist_runs_standalone_without_inv_or_books(api, make_tenant, tenant_token):
    """A DIST-only entitlement: approval can't consult stock (approves in full),
    dispatch posts nothing to INV and invoicing nothing to BOOKS."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    with use_tenant(tenant):   # entitle DIST alone
        from apps.foundation.models import EntitlementSnapshot
        EntitlementSnapshot.objects.update_or_create(pk=1, defaults={"modules": ["DIST"]})

    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    req = _request(client, dist, item, qty=10)
    approved = client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/").data
    assert str(approved["items"][0]["approved_quantity"]) == "10.000"   # no INV -> full approval
    assert approved["has_shortage"] is False
    client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/")
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/invoice/", {}).status_code == 201

    with use_tenant(tenant):
        from apps.inventory.models import StockLevel
        from apps.books.models import JournalEntry
        assert StockLevel.objects.count() == 0     # INV not entitled
        assert JournalEntry.objects.count() == 0   # BOOKS not entitled


# ------------------------------------------- back-orders + adjustments (wiring)
def test_shortage_becomes_a_tracked_backorder(api, make_tenant, tenant_token):
    """Approving short must not silently drop the unmet demand — it becomes a
    back-order with its own lifecycle that ships separately."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 6, "rate": 20})

    req = _request(client, dist, item, qty=10)
    client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/")
    shortages = client.get("/api/t/dist/shortages/").data
    assert shortages["count"] == 1
    row = shortages["results"][0]
    assert str(row["shortage_quantity"]) == "4.000" and row["status"] == "pending"

    # ship what existed, leaving the back-order outstanding
    client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/")
    ds = client.get(f"/api/t/dist/distributor-stock/?distributor={dist}").data
    assert str(ds["results"][0]["on_hand"]) == "6.000"

    sid = row["id"]
    # the lifecycle is enforced: cannot deliver straight from pending
    assert client.post(f"/api/t/dist/shortages/{sid}/mark_delivered/").status_code == 400
    client.post(f"/api/t/dist/shortages/{sid}/start_production/")
    client.post(f"/api/t/dist/shortages/{sid}/complete_production/")
    client.post(f"/api/t/dist/shortages/{sid}/mark_packed/")
    client.post(f"/api/t/dist/shortages/{sid}/mark_in_transit/")
    assert client.post(f"/api/t/dist/shortages/{sid}/mark_delivered/").data["status"] == "delivered"

    # delivering the back-order tops the distributor up to the full 10
    ds2 = client.get(f"/api/t/dist/distributor-stock/?distributor={dist}").data
    assert str(ds2["results"][0]["on_hand"]) == "10.000"


def test_distributor_adjustment_cannot_go_negative(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 20, "rate": 20})
    req = _request(client, dist, item, qty=10)
    client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/")
    client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/")

    adj = client.post("/api/t/dist/adjustments/", {
        "distributor": dist, "item": item, "quantity": "-3", "reason": "damage"})
    assert adj.status_code == 201 and str(adj.data["balance_after"]) == "7.000"
    # a correction can never drive a distributor's holding below zero
    assert client.post("/api/t/dist/adjustments/", {
        "distributor": dist, "item": item, "quantity": "-99"}).status_code == 400
    assert client.post("/api/t/dist/adjustments/", {
        "distributor": dist, "item": item, "quantity": "0"}).status_code == 400


def test_check_inventory_and_delete_invoice(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, dist = _item(api, token), _distributor(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 4, "rate": 20})
    req = _request(client, dist, item, qty=10)

    chk = client.get(f"/api/t/dist/stock-requests/{req['id']}/check_inventory/").data
    assert chk["inventory_available"] is True
    assert chk["items"][0]["available_qty"] == 4.0 and chk["items"][0]["shortage"] == 6.0

    client.post(f"/api/t/dist/stock-requests/{req['id']}/approve/")
    client.post(f"/api/t/dist/stock-requests/{req['id']}/dispatch/")
    inv = client.post(f"/api/t/dist/stock-requests/{req['id']}/invoice/", {}).data
    # an unpaid invoice can be voided so a corrected one can be raised
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/delete_invoice/", {}).status_code == 200
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/invoice/", {}).status_code == 201
    # ...but not once it has been part-paid
    inv2 = client.get("/api/t/dist/invoices/").data["results"][0]
    client.post(f"/api/t/dist/invoices/{inv2['id']}/mark_paid/", {"amount": "10"})
    assert client.post(f"/api/t/dist/stock-requests/{req['id']}/delete_invoice/", {}).status_code == 400
