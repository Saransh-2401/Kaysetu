"""MOD-BOOKS: Accounts & Finance — double-entry general ledger.

Headline: a tenant with ORDERS+BOOKS issues an invoice from a delivered order and
BOOKS auto-posts a balanced Dr Accounts-Receivable / Cr Sales journal + updates the
customer's ledger — zero manual bookkeeping, zero import. Recording the payment
posts a receipt and the balance sheet stays balanced throughout.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _item(api, token, name="Widget", price="100"):
    return auth(api, token).post("/api/t/catalog/", {"name": name, "price": price, "tax_rate": "0"}).data["id"]


def _party(api, token, name="Buyer Co"):
    return auth(api, token).post("/api/t/parties/", {"name": name, "kind": "customer"}).data["id"]


def _deliver_and_invoice(client, order_id):
    client.post(f"/api/t/sales-orders/{order_id}/confirm/")
    client.post(f"/api/t/sales-orders/{order_id}/delivery-note/", {})
    client.post(f"/api/t/sales-orders/{order_id}/mark-delivered/")
    return client.post(f"/api/t/sales-orders/{order_id}/invoice/")


# ------------------------------------------------------------- standalone (P7)
def test_books_provisions_chart_of_accounts(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P7")  # Books & Accounts
    token = tenant_token(tenant)["access"]
    accts = auth(api, token).get("/api/t/books/accounts/").data["results"]
    by_code = {a["account_number"]: a for a in accts}
    assert by_code["1300"]["account_name"] == "Accounts Receivable"
    assert by_code["1300"]["account_type"] == "asset"
    assert by_code["4100"]["account_type"] == "income"  # Sales Revenue
    assert any(a["is_group"] for a in accts)             # group headers exist
    # portal-compat aliases present on every row
    assert "account_number" in accts[0] and "account_name" in accts[0]


def test_books_manual_journal_balanced_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P7")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    accts = {a["account_number"]: a["id"] for a in client.get("/api/t/books/accounts/").data["results"]}
    cash, sales = accts["1100"], accts["4100"]

    ok = client.post("/api/t/books/journal-entries/", {
        "posting_date": "2026-07-16", "narration": "cash sale",
        "lines": [{"account": cash, "debit": "500", "credit": "0"},
                  {"account": sales, "debit": "0", "credit": "500"}]})
    assert ok.status_code == 201 and str(ok.data["total_debit"]) == "500.00"

    bad = client.post("/api/t/books/journal-entries/", {
        "posting_date": "2026-07-16",
        "lines": [{"account": cash, "debit": "500"}, {"account": sales, "credit": "400"}]})
    assert bad.status_code == 400  # debits != credits

    led = client.get(f"/api/t/books/accounts/{cash}/ledger/").data
    assert led["closing_balance"] == 500.0 and len(led["lines"]) == 1

    tb = client.get("/api/t/books/reports/trial-balance/").data
    assert tb["balanced"] and tb["total_debit"] == tb["total_credit"] == 500.0


def test_books_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # FIELD only, no BOOKS
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/books/accounts/").status_code == 403
    assert auth(api, token).get("/api/t/books/reports/balance-sheet/").status_code == 403


# ------------------------------------------------------------- THE HEADLINE (P8)
def test_orders_invoice_and_payment_autopost_to_books(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")  # Enterprise: ORDERS + BOOKS + INV
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token, price="100"), _party(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "Widget", "quantity": 3, "rate": "100"}]}).data

    assert _deliver_and_invoice(client, order["id"]).status_code == 201

    with use_tenant(tenant):
        from apps.books.models import JournalEntry
        from apps.books import services
        je = JournalEntry.objects.filter(source="sales_invoice")
        assert je.count() == 1
        entry = je.first()
        assert float(entry.total_debit) == float(entry.total_credit) == 300.0  # balanced
        ar = services.account_by_key("ACCOUNTS_RECEIVABLE")
        assert services.account_ledger(ar)["closing_balance"] == 300.0   # AR debited
        assert services.party_balance(party) == 300.0                     # customer owes 300

    # customer statement via the foundation URL (decoupled: foundation asks BOOKS)
    pl = client.get(f"/api/t/parties/{party}/ledger/").data
    assert pl["closing_balance"] == 300.0 and len(pl["lines"]) == 1

    # ORDERS refuses a second invoice -> no double event -> still one journal
    assert client.post(f"/api/t/sales-orders/{order['id']}/invoice/").status_code == 400

    # payment posts a receipt: AR cleared, cash up, books still balanced
    client.post(f"/api/t/sales-orders/{order['id']}/record-payment/", {"amount": "300", "mode": "cash"})
    with use_tenant(tenant):
        from apps.books import services
        assert services.party_balance(party) == 0.0

    bs = client.get("/api/t/books/reports/balance-sheet/").data
    assert bs["balance_check"]["balanced"]
    assert bs["assets"]["accounts_receivable"] == 0.0
    assert bs["assets"]["cash_and_bank"] == 300.0

    pl2 = client.get("/api/t/books/reports/profit-loss/").data
    assert pl2["income"]["sales_revenue"] == 300.0 and pl2["profit"]["net_profit"] == 300.0


def test_books_posting_is_idempotent(api, make_tenant, tenant_token):
    """A replayed orders.invoice_issued must not double-book (source_ref guard)."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    party = _party(api, token)
    with use_tenant(tenant):
        from apps.books.models import JournalEntry
        from apps.books import services
        first = services.post_sales_invoice(invoice_id=999, party_id=party, total="250", order_id=7)
        again = services.post_sales_invoice(invoice_id=999, party_id=party, total="250", order_id=7)
        assert first.pk == again.pk
        assert JournalEntry.objects.filter(source_ref="orders.invoice:999").count() == 1


# ------------------------------------------------- review-hardening regressions
def _user(api, tenant, tenant_token, role_slug, email):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": "Staff", "role_slug": role_slug,
        "password": "staff-pass-123", "password_confirm": "staff-pass-123"})
    login = api.post("/api/auth/tenant/login",
                     {"org_code": tenant.org_code, "email": email, "password": "staff-pass-123"})
    return login.data["access"]


def test_invoice_splits_gst_out_of_revenue(api, make_tenant, tenant_token):
    """FIX: a taxed invoice must credit NET revenue to Sales and the tax to GST
    Payable — not book the GST-inclusive total as revenue."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token, price="100"), _party(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party,
        "items": [{"item": item, "item_name": "Widget", "quantity": 3, "rate": "100", "tax_rate": "18"}]}).data
    assert _deliver_and_invoice(client, order["id"]).status_code == 201  # subtotal 300, tax 54, total 354

    with use_tenant(tenant):
        from apps.books import services
        ar = services.account_by_key("ACCOUNTS_RECEIVABLE")
        sales = services.account_by_key("SALES")
        gst = services.account_by_key("GST_OUTPUT")
        assert services.account_ledger(ar)["closing_balance"] == 354.0        # AR = grand total
        assert services.account_ledger(sales)["closing_balance"] == -300.0    # Sales credited NET 300
        assert services.account_ledger(gst)["closing_balance"] == -54.0       # GST Payable credited 54

    pnl = client.get("/api/t/books/reports/profit-loss/").data
    assert pnl["income"]["sales_revenue"] == 300.0   # net, not 354
    bs = client.get("/api/t/books/reports/balance-sheet/").data
    assert bs["liabilities"]["total_liabilities"] == 54.0 and bs["balance_check"]["balanced"]


def test_chart_of_accounts_writes_require_accountant(api, make_tenant, tenant_token):
    """FIX: any BOOKS user can READ the chart; only accountants/owner may mutate it."""
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    agent = _user(api, tenant, tenant_token, "sales_agent", "clerk@bk.test")

    assert auth(api, agent).get("/api/t/books/accounts/").status_code == 200          # read ok
    body = {"account_name": "Petty Cash", "account_number": "1150", "account_type": "asset"}
    assert auth(api, agent).post("/api/t/books/accounts/", body).status_code == 403   # non-accountant blocked
    assert auth(api, owner).post("/api/t/books/accounts/", body).status_code == 201   # owner allowed


def test_manual_journal_rejects_bad_lines_with_400(api, make_tenant, tenant_token):
    """FIX: malformed lines return 400, never a 500."""
    tenant, _ = make_tenant(package_code="P7")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    accts = {a["account_number"]: a["id"] for a in client.get("/api/t/books/accounts/").data["results"]}
    cash, sales = accts["1100"], accts["4100"]
    # a line with BOTH debit and credit
    both = client.post("/api/t/books/journal-entries/", {
        "posting_date": "2026-07-16",
        "lines": [{"account": cash, "debit": "100", "credit": "100"},
                  {"account": sales, "credit": "100"}]})
    assert both.status_code == 400
    # a negative amount
    neg = client.post("/api/t/books/journal-entries/", {
        "posting_date": "2026-07-16",
        "lines": [{"account": cash, "debit": "-50"}, {"account": sales, "credit": "-50"}]})
    assert neg.status_code == 400


def test_distinct_posts_get_distinct_numbers(api, make_tenant, tenant_token):
    """FIX: journal numbers carry entropy, so rapid distinct posts never collide."""
    tenant, _ = make_tenant(package_code="P7")
    tenant_token(tenant)  # ensure provisioned
    with use_tenant(tenant):
        from apps.foundation.models import Party
        from apps.books import services
        p = Party.objects.create(name="X", kind="customer").id
        nums = {services.post_sales_invoice(invoice_id=i, party_id=p, total="10", order_id=i).number
                for i in range(1, 8)}
        assert len(nums) == 7  # all unique


def test_payment_mode_routes_bank_vs_cash(api, make_tenant, tenant_token):
    """FIX: a UPI/bank payment settles to Bank, not Cash."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token, price="100"), _party(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "Widget", "quantity": 2, "rate": "100"}]}).data
    _deliver_and_invoice(client, order["id"])
    client.post(f"/api/t/sales-orders/{order['id']}/record-payment/", {"amount": "200", "mode": "upi"})
    with use_tenant(tenant):
        from apps.books import services
        assert services.account_ledger(services.account_by_key("BANK"))["closing_balance"] == 200.0
        assert services.account_ledger(services.account_by_key("CASH"))["closing_balance"] == 0.0


def test_books_ignores_events_when_not_entitled(api, make_tenant, tenant_token):
    """P4 has ORDERS but NOT BOOKS: invoicing must not post a journal (handler is
    entitlement-gated) and the party-ledger URL degrades to an empty statement."""
    tenant, _ = make_tenant(package_code="P4")  # ORDERS + INV + DIST, no BOOKS
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "Widget", "quantity": 2, "rate": "50"}]}).data
    assert _deliver_and_invoice(client, order["id"]).status_code == 201  # ORDERS runs standalone

    pl = client.get(f"/api/t/parties/{party}/ledger/").data
    assert pl["lines"] == [] and pl["closing_balance"] == 0.0  # BOOKS capability un-entitled -> empty
    with use_tenant(tenant):
        from apps.books.models import JournalEntry
        assert JournalEntry.objects.count() == 0  # nothing posted
