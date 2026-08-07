"""Primary vs secondary sales — the distributor-led FMCG shape.

Primary orders are what a DISTRIBUTOR buys from the company (DIST module);
secondary orders are what a SALES AGENT books at a RETAILER on that
distributor's behalf (FIELD module). The link that makes the two reportable
against one distributor is `Party.distributor` — a retailer pointing at the
very party DIST raises its stock requests against.

Everything here is about that link holding: that it can only point at a real
distributor, that a booked order snapshots it rather than following it, and
that both halves of the business roll up to the same party without FIELD and
DIST importing each other.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")

PACKAGE = "P9"          # Primary & Secondary Sales — TRACK + FIELD + DIST + INV


def _distributor(api, token, name="North Distributor"):
    """A party flagged as a distributor — the convention the pickers rely on."""
    resp = auth(api, token).post("/api/t/parties/", {
        "name": name, "kind": "customer", "extra": {"is_distributor": True},
    })
    assert resp.status_code == 201, resp.data
    return resp.data["id"]


def _retailer(api, token, name="Sharma Kirana", distributor=None):
    body = {"name": name, "kind": "customer"}
    if distributor is not None:
        body["distributor"] = distributor
    resp = auth(api, token).post("/api/t/parties/", body)
    assert resp.status_code == 201, resp.data
    return resp.data["id"]


def _item(api, token, name="Soap", price="50"):
    return auth(api, token).post(
        "/api/t/catalog/", {"name": name, "price": price, "tax_rate": "0"}).data["id"]


def _agent(api, tenant, tenant_token, email="agent@ps.test"):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": "Field Agent", "role_slug": "sales_agent",
        "password": "agent-pass-123", "password_confirm": "agent-pass-123",
    })
    login = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": email, "password": "agent-pass-123"})
    return login.data["access"], login.data["user"]["id"]


# ---------------------------------------------------------------- the link
def test_retailer_links_to_its_distributor(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code=PACKAGE)
    token = tenant_token(tenant)["access"]
    dist = _distributor(api, token)

    retailer = auth(api, token).post("/api/t/parties/", {
        "name": "Sharma Kirana", "kind": "customer", "distributor": dist})
    assert retailer.status_code == 201, retailer.data
    assert retailer.data["distributor"] == dist
    assert retailer.data["distributor_name"] == "North Distributor"


def test_only_a_flagged_distributor_may_serve_a_retailer(api, make_tenant, tenant_token):
    """An ordinary customer set as someone's distributor would corrupt every
    primary-vs-secondary figure while still adding up, so it is rejected."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    token = tenant_token(tenant)["access"]
    plain_customer = _retailer(api, token, name="Just A Shop")

    rejected = auth(api, token).post("/api/t/parties/", {
        "name": "Another Shop", "kind": "customer", "distributor": plain_customer})
    assert rejected.status_code == 400
    assert "not a distributor" in str(rejected.data).lower()


def test_party_cannot_be_its_own_distributor(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code=PACKAGE)
    token = tenant_token(tenant)["access"]
    dist = _distributor(api, token)

    resp = auth(api, token).patch(f"/api/t/parties/{dist}/", {"distributor": dist})
    assert resp.status_code == 400
    assert "own distributor" in str(resp.data).lower()


def test_distributor_can_be_cleared(api, make_tenant, tenant_token):
    """Un-assigning must work — a retailer changing hands is routine."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    token = tenant_token(tenant)["access"]
    dist = _distributor(api, token)
    retailer = _retailer(api, token, distributor=dist)

    cleared = auth(api, token).patch(f"/api/t/parties/{retailer}/", {"distributor": None})
    assert cleared.status_code == 200, cleared.data
    assert cleared.data["distributor"] is None


# ------------------------------------------------------- secondary orders
def test_secondary_order_inherits_the_retailers_distributor(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    token, _agent_id = _agent(api, tenant, tenant_token)
    dist = _distributor(api, owner)
    retailer = _retailer(api, owner, distributor=dist)
    item = _item(api, owner)

    order = auth(api, token).post("/api/t/field/orders/", {
        "party": retailer, "items": [{"item": item, "quantity": 2, "rate": "50"}]})
    assert order.status_code == 201, order.data
    assert order.data["distributor"] == dist
    assert order.data["distributor_name"] == "North Distributor"


def test_secondary_order_distributor_can_be_overridden(api, make_tenant, tenant_token):
    """One shop is often served by more than one distributor."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    token, _agent_id = _agent(api, tenant, tenant_token)
    usual = _distributor(api, owner, "Usual Distributor")
    other = _distributor(api, owner, "Other Distributor")
    retailer = _retailer(api, owner, distributor=usual)
    item = _item(api, owner)

    order = auth(api, token).post("/api/t/field/orders/", {
        "party": retailer, "distributor": other,
        "items": [{"item": item, "quantity": 1, "rate": "50"}]})
    assert order.status_code == 201, order.data
    assert order.data["distributor"] == other


def test_reassigning_a_retailer_does_not_rewrite_booked_orders(api, make_tenant, tenant_token):
    """The order snapshots its distributor. Following `party.distributor` at
    read time would silently move historical sales between distributors every
    time a retailer changed hands — and quietly restate last month's numbers."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    token, _agent_id = _agent(api, tenant, tenant_token)
    old = _distributor(api, owner, "Old Distributor")
    new = _distributor(api, owner, "New Distributor")
    retailer = _retailer(api, owner, distributor=old)
    item = _item(api, owner)

    order = auth(api, token).post("/api/t/field/orders/", {
        "party": retailer, "items": [{"item": item, "quantity": 1, "rate": "50"}]}).data
    auth(api, owner).patch(f"/api/t/parties/{retailer}/", {"distributor": new})

    reread = auth(api, token).get(f"/api/t/field/orders/{order['id']}/")
    assert reread.data["distributor"] == old, "a booked order must keep its distributor"


def test_secondary_orders_filter_by_distributor(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    token, _agent_id = _agent(api, tenant, tenant_token)
    north = _distributor(api, owner, "North Distributor")
    south = _distributor(api, owner, "South Distributor")
    item = _item(api, owner)
    # Every retailer up front: auth() rebinds the shared client, so creating one
    # mid-loop would silently book the order as the owner instead of the agent —
    # and the agent's own list would then come back empty.
    shops = [(_retailer(api, owner, name=name, distributor=dist))
             for name, dist in (("Shop A", north), ("Shop B", north), ("Shop C", south))]
    for shop in shops:
        booked = auth(api, token).post("/api/t/field/orders/", {
            "party": shop, "items": [{"item": item, "quantity": 1, "rate": "50"}]})
        assert booked.status_code == 201, booked.data

    listed = auth(api, token).get(f"/api/t/field/orders/?distributor={north}")
    assert listed.status_code == 200
    rows = listed.data.get("results", listed.data)
    assert len(rows) == 2
    assert {r["distributor"] for r in rows} == {north}


def test_order_booked_event_carries_the_distributor(api, make_tenant, tenant_token):
    """A subscribing module must be able to attribute the order without
    reaching back into FIELD."""
    from apps.foundation.models import EventDelivery

    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    token, _agent_id = _agent(api, tenant, tenant_token)
    dist = _distributor(api, owner)
    retailer = _retailer(api, owner, distributor=dist)
    item = _item(api, owner)

    auth(api, token).post("/api/t/field/orders/", {
        "party": retailer, "items": [{"item": item, "quantity": 1, "rate": "50"}]})

    with use_tenant(tenant):
        delivery = EventDelivery.objects.filter(event="field.order_booked").first()
    assert delivery is not None, "field.order_booked was not recorded"
    assert delivery.payload["distributor_id"] == dist


# ------------------------------------------------------------ party lists
def test_party_list_filters_retailers_and_distributors(api, make_tenant, tenant_token):
    """`?distributor=` is the beat list an agent works; `?is_distributor=` is
    what a distributor picker asks for."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    token = tenant_token(tenant)["access"]
    dist = _distributor(api, token)
    _retailer(api, token, name="Shop A", distributor=dist)
    _retailer(api, token, name="Shop B", distributor=dist)
    _retailer(api, token, name="Unassigned Shop")
    client = auth(api, token)

    mine = client.get(f"/api/t/parties/?distributor={dist}")
    rows = mine.data.get("results", mine.data)
    assert {r["name"] for r in rows} == {"Shop A", "Shop B"}

    distributors = client.get("/api/t/parties/?is_distributor=true")
    rows = distributors.data.get("results", distributors.data)
    assert {r["name"] for r in rows} == {"North Distributor"}

    retailers = client.get("/api/t/parties/?is_distributor=false")
    rows = retailers.data.get("results", retailers.data)
    assert "North Distributor" not in {r["name"] for r in rows}


# ------------------------------------------------------- both halves, one party
def test_primary_and_secondary_roll_up_to_the_same_distributor(api, make_tenant, tenant_token):
    """The whole point: a distributor's own purchases (primary, DIST) and the
    orders agents booked for it (secondary, FIELD) hang off ONE party record,
    with neither module importing the other."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    token, _agent_id = _agent(api, tenant, tenant_token)
    dist = _distributor(api, owner)
    retailer = _retailer(api, owner, distributor=dist)
    item = _item(api, owner, price="50")

    primary = auth(api, owner).post("/api/t/dist/stock-requests/", {
        "distributor": dist, "items": [{"item": item, "requested_quantity": 10}]})
    assert primary.status_code == 201, primary.data
    assert str(primary.data["total_amount"]) == "500.00"

    secondary = auth(api, token).post("/api/t/field/orders/", {
        "party": retailer, "items": [{"item": item, "quantity": 3, "rate": "50"}]})
    assert secondary.status_code == 201, secondary.data

    with use_tenant(tenant):
        from apps.distribution.models import StockRequest
        from apps.field.models import FieldOrder
        assert StockRequest.objects.filter(distributor_id=dist).count() == 1
        assert FieldOrder.objects.filter(distributor_id=dist).count() == 1


def test_attribution_survives_the_hop_into_orders(api, make_tenant, tenant_token):
    """A tenant that also bought ORDERS gets a back-office copy of the field
    order — and the portal lists THAT, so it has to keep the distributor."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    owner = tenant_token(tenant)["access"]
    token, _agent_id = _agent(api, tenant, tenant_token)
    dist = _distributor(api, owner)
    retailer = _retailer(api, owner, distributor=dist)
    item = _item(api, owner)

    booked = auth(api, token).post("/api/t/field/orders/", {
        "party": retailer, "items": [{"item": item, "quantity": 2, "rate": "50"}]})
    assert booked.status_code == 201, booked.data

    back_office = auth(api, owner).get(f"/api/t/sales-orders/?distributor={dist}")
    rows = back_office.data.get("results", back_office.data)
    assert len(rows) == 1, f"expected one back-office order, got {rows}"
    assert rows[0]["distributor"] == dist
    assert rows[0]["distributor_name"] == "North Distributor"
    assert rows[0]["source"] == "field"


# ---------------------------------------------------------------- packaging
def test_p9_bundles_exactly_what_this_business_needs(api, make_tenant, tenant_token):
    """No pre-existing package fit: P3 had no DIST, P4 had no TRACK/FIELD, and
    P8 forced production and accounts on a business that wants neither."""
    from apps.control.models import Package

    package = Package.objects.filter(code=PACKAGE).first()
    assert package is not None, "P9 was not seeded"
    codes = set(package.modules.values_list("code", flat=True))
    assert codes == {"TRACK", "FIELD", "ORDERS", "DIST", "INV"}
    assert not (codes & {"PROD", "BOOKS"}), "P9 must not include production or accounts"


def test_p9_tenant_gets_tracking_field_and_distribution(api, make_tenant, tenant_token):
    """Entitlement is what actually gates the URLs, so assert on live calls."""
    tenant, _ = make_tenant(package_code=PACKAGE)
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    assert client.get("/api/t/field/orders/").status_code == 200
    assert client.get("/api/t/dist/stock-requests/").status_code == 200
    assert client.get("/api/t/track/attendance").status_code == 200
    # The back office lists sales orders, not field orders — without ORDERS the
    # secondary orders agents book would be invisible in the portal.
    assert client.get("/api/t/sales-orders/").status_code == 200
    # ...and nothing it did not buy
    assert client.get("/api/t/books/journal-entries/").status_code == 403
    assert client.get("/api/t/prod/work-orders/").status_code == 403
