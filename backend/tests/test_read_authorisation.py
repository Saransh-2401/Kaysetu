"""Entitlement is not authorisation.

Every module gate answers "did this tenant BUY the module?". That is not the
same question as "may THIS user see this data", and where the second gate was
missing a field sales agent could read the company's general ledger, its
supplier pricing, and every colleague's Aadhaar number — all through ordinary
GETs on endpoints their own UI never links to.

Found by walking a live P8 (all-modules) tenant end to end.
"""
import pytest

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")

PACKAGE = "P8"          # every module, so nothing is hidden by entitlement


def _user(api, tenant, tenant_token, email, role):
    owner = tenant_token(tenant)["access"]
    created = auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": role.replace("_", " ").title(), "role_slug": role,
        "password": "role-pass-123", "password_confirm": "role-pass-123",
    })
    assert created.status_code == 201, created.data
    login = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": email, "password": "role-pass-123"})
    assert login.status_code == 200, login.data
    return login.data["access"], created.data["id"]


# --------------------------------------------------------------- the books
BOOKS_READS = [
    "/api/t/books/journal-entries/",
    "/api/t/books/reports/trial-balance/",
    "/api/t/books/reports/profit-loss/",
    "/api/t/books/reports/balance-sheet/",
    "/api/t/books/reports/cash-flow/",
]


@pytest.mark.parametrize("path", BOOKS_READS)
def test_sales_agent_cannot_read_the_books(api, make_tenant, tenant_token, path):
    tenant, _ = make_tenant(package_code=PACKAGE)
    token, _id = _user(api, tenant, tenant_token, "agent@books.test", "sales_agent")
    assert auth(api, token).get(path).status_code == 403, f"{path} is readable by a sales agent"


@pytest.mark.parametrize("path", BOOKS_READS)
def test_accounts_officer_still_reads_the_books(api, make_tenant, tenant_token, path):
    """The gate must not lock out the role whose job this is."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    token, _id = _user(api, tenant, tenant_token, "acc@books.test", "accounts_officer")
    assert auth(api, token).get(path).status_code == 200, f"{path} blocked for accounts_officer"


def test_chart_of_accounts_stays_readable_but_its_ledger_does_not(api, make_tenant, tenant_token):
    """The chart is a list of account names that pickers need; the per-account
    ledger is the transaction history and is not."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    account_id = auth(api, owner).get("/api/t/books/accounts/").data["results"][0]["id"]

    token, _id = _user(api, tenant, tenant_token, "agent2@books.test", "sales_agent")
    client = auth(api, token)
    assert client.get("/api/t/books/accounts/").status_code == 200
    assert client.get(f"/api/t/books/accounts/{account_id}/ledger/").status_code == 403


def test_customer_statement_still_works_for_the_agent_who_owns_it(api, make_tenant, tenant_token):
    """Locking the books must NOT take away a customer's own statement: it is
    served through the books.party_ledger CAPABILITY behind the foundation party
    URL, scoped to one party rather than the whole company."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    party = auth(api, owner).post(
        "/api/t/parties/", {"name": "A Customer", "kind": "customer"}).data["id"]

    token, _id = _user(api, tenant, tenant_token, "agent3@books.test", "sales_agent")
    statement = auth(api, token).get(f"/api/t/parties/{party}/ledger/")
    assert statement.status_code == 200, statement.data


# ----------------------------------------------------------- procurement
PURCH_READS = [
    "/api/t/purchase/suppliers/",
    "/api/t/purchase/purchase-orders/",
    "/api/t/purchase/goods-receipts/",
    "/api/t/purchase/bills/",
]


@pytest.mark.parametrize("path", PURCH_READS)
def test_sales_agent_cannot_read_procurement(api, make_tenant, tenant_token, path):
    """Supplier identities and negotiated rates are the company's cost base."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    token, _id = _user(api, tenant, tenant_token, "agent@purch.test", "sales_agent")
    assert auth(api, token).get(path).status_code == 403, f"{path} is readable by a sales agent"


@pytest.mark.parametrize("role", ["purchase_manager", "accounts_officer", "warehouse_manager"])
def test_procurement_roles_still_read_procurement(api, make_tenant, tenant_token, role):
    """The accounts officer settles the bills and the warehouse receives the
    goods — gating reads to purchase_manager alone would have broken both."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    token, _id = _user(api, tenant, tenant_token, f"{role}@purch.test", role)
    client = auth(api, token)
    for path in PURCH_READS:
        assert client.get(path).status_code == 200, f"{path} blocked for {role}"


# ------------------------------------------------------------------ KYC
KYC = ["aadhaar_number", "pan_number", "aadhaar_card", "pan_card",
       "gst_number", "home_latitude", "home_longitude"]


def test_agent_cannot_harvest_colleagues_kyc(api, make_tenant, tenant_token):
    """The user list is deliberately readable by everyone (pickers need names),
    so the identity documents on it have to be redacted per-viewer."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    created = auth(api, owner).post("/api/t/users/", {
        "email": "victim@kyc.test", "full_name": "Victim", "role_slug": "sales_manager",
        "password": "role-pass-123", "password_confirm": "role-pass-123",
        "aadhaar_number": "123456789012", "pan_number": "ABCDE1234F",
    })
    assert created.status_code == 201, created.data
    assert created.data["aadhaar_number"] == "123456789012"   # admin sees it

    token, agent_id = _user(api, tenant, tenant_token, "agent@kyc.test", "sales_agent")
    listing = auth(api, token).get("/api/t/users/")
    assert listing.status_code == 200
    victim = next(u for u in listing.data["results"] if u["email"] == "victim@kyc.test")
    leaked = [f for f in KYC if victim.get(f) not in (None, "")]
    assert not leaked, f"agent can read colleagues' {leaked}"
    assert victim["full_name"] == "Victim"      # the list itself still works

    own = next(u for u in listing.data["results"] if u["id"] == agent_id)
    assert "aadhaar_number" in own, "a user must still see their own record's fields"


def test_admin_still_sees_kyc(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": "kyc2@kyc.test", "full_name": "Has KYC", "role_slug": "sales_agent",
        "password": "role-pass-123", "password_confirm": "role-pass-123",
        "aadhaar_number": "123456789012", "pan_number": "ABCDE1234F"})

    listing = auth(api, owner).get("/api/t/users/")
    row = next(u for u in listing.data["results"] if u["email"] == "kyc2@kyc.test")
    assert row["aadhaar_number"] == "123456789012"
    assert row["pan_number"] == "ABCDE1234F"
