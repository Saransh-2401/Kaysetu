"""MOD-PURCH: Procurement — the buy-side mirror of ORDERS.

Headline: completing a GRN hands the received quantities to INV (stock in) and
booking the supplier's bill posts Dr Inventory / Dr GST Input / Cr Accounts
Payable in BOOKS — with no module importing another. PURCH runs fully standalone
when a tenant bought neither INV nor BOOKS.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _item(api, token, name="Raw Steel", price="100"):
    return auth(api, token).post("/api/t/catalog/", {"name": name, "price": price, "tax_rate": "0"}).data["id"]


def _supplier(api, token, name="Acme Supplies"):
    return auth(api, token).post("/api/t/purchase/suppliers/", {
        "supplier_name": name, "email": "acme@sup.test", "phone": "9990001111",
        "tax_id": "27AAAPA1234A1Z5", "contact_person": "Ravi", "payment_terms": "Net 30",
    }).data["id"]


def _po(client, supplier, item, *, qty=10, rate="100", tax_rate="0"):
    return client.post("/api/t/purchase/purchase-orders/", {
        "supplier": supplier, "order_date": "2026-07-16",
        "items": [{"item": item, "item_name": "Raw Steel", "quantity": qty,
                   "rate": rate, "tax_rate": tax_rate}],
    }).data


# ------------------------------------------------------------- standalone (P6)
def test_supplier_is_a_foundation_party(api, make_tenant, tenant_token):
    """Suppliers share the one Party registry (kind=supplier); purchase-only
    attributes ride along in Party.extra."""
    tenant, _ = make_tenant(package_code="P6")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    sid = _supplier(api, token)

    row = client.get("/api/t/purchase/suppliers/").data["results"][0]
    assert row["supplier_name"] == "Acme Supplies"
    assert row["tax_id"] == "27AAAPA1234A1Z5"
    assert row["contact_person"] == "Ravi" and row["payment_terms"] == "Net 30"
    assert row["po_count"] == 0 and row["total_spent"] == 0.0
    assert row["supplier_code"] == f"SUP-{sid}"

    with use_tenant(tenant):
        from apps.foundation.models import Party
        party = Party.objects.get(pk=sid)
        assert party.kind == "supplier" and party.gstin == "27AAAPA1234A1Z5"
        assert party.extra["contact_person"] == "Ravi"


def test_material_request_workflow(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P6")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item = _item(api, token)

    mr = client.post("/api/t/purchase/material-requests/", {
        "purpose": "restock", "priority": "high",
        "items": [{"item": item, "item_name": "Raw Steel", "quantity": 5, "estimated_rate": "90"}],
    }).data
    assert mr["status"] == "draft" and str(mr["total_amount"]) == "450.00"
    assert mr["request_number"] == mr["number"]  # portal alias

    # approve before submit is rejected by the state machine
    assert client.post(f"/api/t/purchase/material-requests/{mr['id']}/approve/").status_code == 400
    assert client.post(f"/api/t/purchase/material-requests/{mr['id']}/submit/").status_code == 200
    # reject needs a reason
    assert client.post(f"/api/t/purchase/material-requests/{mr['id']}/reject/", {}).status_code == 400
    assert client.post(f"/api/t/purchase/material-requests/{mr['id']}/approve/").data["status"] == "approved"


def test_purchase_order_money_is_server_side(api, make_tenant, tenant_token):
    """A client-supplied total is ignored — amounts always come from qty x rate."""
    tenant, _ = make_tenant(package_code="P6")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)

    po = client.post("/api/t/purchase/purchase-orders/", {
        "supplier": supplier, "order_date": "2026-07-16", "total": "999999", "subtotal": "1",
        "items": [{"item": item, "item_name": "Raw Steel", "quantity": 10, "rate": "100", "tax_rate": "18"}],
    }).data
    assert str(po["subtotal"]) == "1000.00" and str(po["tax_amount"]) == "180.00"
    assert str(po["total"]) == "1180.00"          # not the client's 999999
    assert po["po_number"] == po["number"]        # portal alias
    assert po["status"] == "draft" and po["receipt_status"] == "pending"

    # a zero/negative quantity is rejected
    bad = client.post("/api/t/purchase/purchase-orders/", {
        "supplier": supplier, "order_date": "2026-07-16",
        "items": [{"item": item, "quantity": 0, "rate": "100"}]})
    assert bad.status_code == 400


def test_goods_receipt_tracks_outstanding(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P6")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)
    po = _po(client, supplier, item, qty=10)

    # cannot receive against a draft PO
    assert client.post(f"/api/t/purchase/purchase-orders/{po['id']}/receive/", {
        "items": [{"item": item, "quantity_accepted": 4}]}).status_code == 400
    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/approve/")

    partial = client.post(f"/api/t/purchase/purchase-orders/{po['id']}/receive/", {
        "items": [{"item": item, "quantity_accepted": 4, "quantity_rejected": 1}]})
    assert partial.status_code == 201
    assert client.get(f"/api/t/purchase/purchase-orders/{po['id']}/").data["receipt_status"] == "partial"

    # over-receipt beyond the outstanding 6 is rejected
    assert client.post(f"/api/t/purchase/purchase-orders/{po['id']}/receive/", {
        "items": [{"item": item, "quantity_accepted": 99}]}).status_code == 400

    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/receive/", {
        "items": [{"item": item, "quantity_accepted": 6}]})
    assert client.get(f"/api/t/purchase/purchase-orders/{po['id']}/").data["receipt_status"] == "received"


def test_purch_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # FIELD only
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/purchase/suppliers/").status_code == 403
    assert auth(api, token).get("/api/t/purchase/purchase-orders/").status_code == 403


def test_purch_runs_standalone_without_inv_or_books(api, make_tenant, tenant_token):
    """P6 = PURCH only: receiving goods and booking a bill must work, and simply
    post nothing to stock or the ledger (both subscribers are entitlement-gated)."""
    tenant, _ = make_tenant(package_code="P6")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)
    po = _po(client, supplier, item, qty=10)
    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/approve/")
    assert client.post(f"/api/t/purchase/purchase-orders/{po['id']}/receive/", {
        "items": [{"item": item, "quantity_accepted": 10}]}).status_code == 201
    assert client.post(f"/api/t/purchase/purchase-orders/{po['id']}/bill/", {}).status_code == 201

    with use_tenant(tenant):
        from apps.inventory.models import StockLevel
        from apps.books.models import JournalEntry
        assert StockLevel.objects.count() == 0      # INV not entitled -> no stock
        assert JournalEntry.objects.count() == 0    # BOOKS not entitled -> no ledger


# ------------------------------------------------- review-hardening regressions
def _staff(api, tenant, tenant_token, role_slug, email):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": "Staff", "role_slug": role_slug,
        "password": "staff-pass-123", "password_confirm": "staff-pass-123"})
    login = api.post("/api/auth/tenant/login",
                     {"org_code": tenant.org_code, "email": email, "password": "staff-pass-123"})
    return login.data["access"]


def test_duplicate_grn_lines_cannot_over_receive(api, make_tenant, tenant_token):
    """FIX: the same item listed twice in one GRN must be summed before the
    outstanding check — otherwise each line validates against a stale baseline."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)
    po = _po(client, supplier, item, qty=10)
    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/approve/")

    over = client.post(f"/api/t/purchase/purchase-orders/{po['id']}/receive/", {
        "items": [{"item": item, "quantity_accepted": 10},
                  {"item": item, "quantity_accepted": 10}]})   # 20 against an order of 10
    assert over.status_code == 400
    with use_tenant(tenant):
        from apps.inventory.models import StockLevel
        assert StockLevel.objects.count() == 0   # no phantom stock created


def test_purchase_order_can_only_be_billed_once(api, make_tenant, tenant_token):
    """FIX: BOOKS is idempotent per BILL, so a second bill would be a genuine
    second payable — block it at the source."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)
    po = _po(client, supplier, item, qty=10)
    assert client.post(f"/api/t/purchase/purchase-orders/{po['id']}/bill/", {}).status_code == 400  # draft
    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/approve/")
    assert client.post(f"/api/t/purchase/purchase-orders/{po['id']}/bill/", {}).status_code == 201
    assert client.post(f"/api/t/purchase/purchase-orders/{po['id']}/bill/", {}).status_code == 400  # no double

    with use_tenant(tenant):
        from apps.books import services
        assert services.party_balance(supplier) == -1000.0   # one payable, not two


def test_adhoc_bill_amounts_are_validated(api, make_tenant, tenant_token):
    """FIX: a negative tax used to build an unbalanced journal that BOOKS silently
    swallowed, leaving a bill with no ledger entry at all."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    supplier = _supplier(api, token)
    bad = client.post("/api/t/purchase/bills/", {
        "supplier": supplier, "invoice_date": "2026-07-16", "subtotal": "1000", "tax_amount": "-999"})
    assert bad.status_code == 400
    with use_tenant(tenant):
        from apps.books.models import JournalEntry
        assert JournalEntry.objects.count() == 0


def test_purchase_writes_require_purchaser_role(api, make_tenant, tenant_token):
    """FIX: PO PATCH and supplier writes were open to any PURCH-entitled user."""
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    clerk = _staff(api, tenant, tenant_token, "sales_agent", "clerk@pu.test")
    item, supplier = _item(api, owner), _supplier(api, owner)
    po = _po(auth(api, owner), supplier, item)

    assert auth(api, clerk).get("/api/t/purchase/purchase-orders/").status_code == 200   # read ok
    assert auth(api, clerk).patch(f"/api/t/purchase/purchase-orders/{po['id']}/",
                                  {"notes": "hi"}).status_code == 403
    assert auth(api, clerk).post("/api/t/purchase/suppliers/",
                                 {"supplier_name": "Rogue"}).status_code == 403
    # suppliers are shared party rows -> no destroy
    assert auth(api, owner).delete(f"/api/t/purchase/suppliers/{supplier}/").status_code == 405
    # the supplier on a PO cannot be swapped after creation
    other = auth(api, owner).post("/api/t/purchase/suppliers/", {"supplier_name": "Other"}).data["id"]
    auth(api, owner).patch(f"/api/t/purchase/purchase-orders/{po['id']}/", {"supplier": other})
    assert auth(api, owner).get(f"/api/t/purchase/purchase-orders/{po['id']}/").data["supplier"] == supplier


def test_material_request_state_machine_not_bypassed_by_po(api, make_tenant, tenant_token):
    """FIX: creating a PO from a draft/rejected MR used to force it to ORDERED,
    and one approved MR could back unlimited POs."""
    tenant, _ = make_tenant(package_code="P6")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)
    mr = client.post("/api/t/purchase/material-requests/", {
        "items": [{"item": item, "item_name": "Raw Steel", "quantity": 5, "estimated_rate": "90"}]}).data

    body = {"supplier": supplier, "order_date": "2026-07-16", "material_request": mr["id"],
            "items": [{"item": item, "quantity": 5, "rate": "90"}]}
    assert client.post("/api/t/purchase/purchase-orders/", body).status_code == 400  # still draft

    client.post(f"/api/t/purchase/material-requests/{mr['id']}/submit/")
    client.post(f"/api/t/purchase/material-requests/{mr['id']}/approve/")
    assert client.post("/api/t/purchase/purchase-orders/", body).status_code == 201
    assert client.post("/api/t/purchase/purchase-orders/", body).status_code == 400  # already ordered
    assert client.get(f"/api/t/purchase/material-requests/{mr['id']}/").data["status"] == "ordered"


def test_supplier_and_amounts_are_validated(api, make_tenant, tenant_token):
    """FIX: a customer party could be used as a supplier, and NaN sailed through."""
    tenant, _ = make_tenant(package_code="P6")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item = _item(api, token)
    customer = client.post("/api/t/parties/", {"name": "A Customer", "kind": "customer"}).data["id"]

    assert client.post("/api/t/purchase/purchase-orders/", {
        "supplier": customer, "order_date": "2026-07-16",
        "items": [{"item": item, "quantity": 1, "rate": "10"}]}).status_code == 400
    assert client.post("/api/t/purchase/purchase-orders/", {
        "supplier": _supplier(api, token), "order_date": "2026-07-16",
        "items": [{"item": item, "quantity": "NaN", "rate": "10"}]}).status_code == 400


# ------------------------------------------------------------- THE HEADLINE (P8)
def test_grn_adds_stock_in_inv(api, make_tenant, tenant_token):
    """A completed GRN hands quantities to INV — the mirror of dispatch-deducts."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)
    po = _po(client, supplier, item, qty=50, rate="40")
    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/approve/")
    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/receive/", {
        "items": [{"item": item, "quantity_accepted": 50}]})

    levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
    assert len(levels) == 1 and str(levels[0]["on_hand"]) == "50.000"   # stock arrived
    ledger = client.get(f"/api/t/inv/stock-ledger/?item={item}").data["results"]
    assert any(r["movement"] == "receipt" for r in ledger)              # receipt row written


def test_bill_posts_payable_in_books(api, make_tenant, tenant_token):
    """Booking a supplier bill posts Dr Inventory / Dr GST Input / Cr AP, shows on
    the supplier ledger, and keeps the balance sheet balanced. Paying clears AP."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, supplier = _item(api, token), _supplier(api, token)
    po = _po(client, supplier, item, qty=10, rate="100", tax_rate="18")  # 1000 + 180 = 1180
    client.post(f"/api/t/purchase/purchase-orders/{po['id']}/approve/")
    bill = client.post(f"/api/t/purchase/purchase-orders/{po['id']}/bill/", {}).data
    assert str(bill["total"]) == "1180.00"

    with use_tenant(tenant):
        from apps.books import services
        assert services.account_ledger(services.account_by_key("INVENTORY"))["closing_balance"] == 1000.0
        assert services.account_ledger(services.account_by_key("GST_INPUT"))["closing_balance"] == 180.0
        assert services.account_ledger(services.account_by_key("ACCOUNTS_PAYABLE"))["closing_balance"] == -1180.0
        assert services.party_balance(supplier) == -1180.0   # negative = we owe them

    bs = client.get("/api/t/books/reports/balance-sheet/").data
    assert bs["liabilities"]["accounts_payable"] == 1180.0 and bs["balance_check"]["balanced"]

    # supplier statement via the shared foundation party-ledger URL
    stmt = client.get(f"/api/t/parties/{supplier}/ledger/").data
    assert stmt["closing_balance"] == -1180.0 and len(stmt["lines"]) == 1

    # paying the bill clears the payable
    client.post(f"/api/t/purchase/bills/{bill['id']}/record-payment/", {"amount": "1180", "mode": "bank"})
    assert client.get(f"/api/t/purchase/bills/{bill['id']}/").data["status"] == "paid"
    with use_tenant(tenant):
        from apps.books import services
        assert services.party_balance(supplier) == 0.0
    assert client.get("/api/t/books/reports/balance-sheet/").data["balance_check"]["balanced"]


def test_bill_posting_is_idempotent(api, make_tenant, tenant_token):
    """A replayed purchase.bill_issued must not double-book the payable."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    supplier = _supplier(api, token)
    with use_tenant(tenant):
        from apps.books.models import JournalEntry
        from apps.books import services
        first = services.post_purchase_bill(bill_id=555, party_id=supplier, total="500",
                                            subtotal="500", tax_amount="0")
        again = services.post_purchase_bill(bill_id=555, party_id=supplier, total="500",
                                            subtotal="500", tax_amount="0")
        assert first.pk == again.pk
        assert JournalEntry.objects.filter(source_ref="purchase.bill:555").count() == 1
