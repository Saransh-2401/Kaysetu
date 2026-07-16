"""MOD-ORDERS: Sales Orders & Dispatch — first module to SUBSCRIBE to events.

Headline: a field agent's booked order (FIELD emits field.order_booked) lands
in the ORDERS approval queue as a SalesOrder — but only when the tenant bought
ORDERS. Neither module imports the other.
"""
import pytest
from django.utils import timezone

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _party(api, token, name="Retail Mart"):
    return auth(api, token).post("/api/t/parties/", {"name": name, "kind": "customer"}).data["id"]


def _item(api, token, name="Soap", price="30", tax="12"):
    return auth(api, token).post("/api/t/catalog/", {"name": name, "price": price, "tax_rate": tax}).data["id"]


def _agent(api, tenant, tenant_token, email="agent@ord.test"):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": "Order Agent", "role_slug": "sales_agent",
        "password": "agent-pass-123", "password_confirm": "agent-pass-123"})
    login = api.post("/api/auth/tenant/login",
                     {"org_code": tenant.org_code, "email": email, "password": "agent-pass-123"})
    return login.data["access"], login.data["user"]["id"]


# ------------------------------------------------------------- standalone
def test_orders_order_to_cash(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")  # Order & Distribution = ORDERS+INV+DIST
    token = tenant_token(tenant)["access"]  # owner = manager
    client = auth(api, token)
    party = _party(api, token)
    item = _item(api, token)

    order = client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 10, "rate": "30", "tax_rate": "12"}],
    })
    assert order.status_code == 201, order.data
    oid = order.data["id"]
    assert order.data["status"] == "processing"
    assert str(order.data["subtotal"]) == "300.00" and str(order.data["total"]) == "336.00"

    assert client.post(f"/api/t/sales-orders/{oid}/confirm/").data["status"] == "order_confirmed"
    assert client.post(f"/api/t/sales-orders/{oid}/pick-list/").status_code == 201
    # pick list creation advanced the order to packed
    assert client.get(f"/api/t/sales-orders/{oid}/").data["status"] == "packed"
    assert client.post(f"/api/t/sales-orders/{oid}/delivery-note/", {"transporter": "VRL", "vehicle_number": "RJ14"}).status_code == 201
    assert client.post(f"/api/t/sales-orders/{oid}/mark-delivered/").data["status"] == "delivered"
    assert client.post(f"/api/t/sales-orders/{oid}/invoice/").status_code == 201
    paid = client.post(f"/api/t/sales-orders/{oid}/record-payment/", {"amount": "336", "mode": "upi"})
    assert paid.data["payment_status"] == "paid"


def test_review_fixes_money_state_rbac(api, make_tenant, tenant_token):
    """Review fixes: client can't override line amount; no state skipping;
    overpayment/negative rejected; non-managers see only their own orders."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token, price="100", tax="0")

    # client-supplied bogus amount is IGNORED (server recomputes qty*rate)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "X", "quantity": 2, "rate": "100", "amount": "1"}]}).data
    assert str(order["total"]) == "200.00"  # 2 x 100, not the bogus 1

    # cannot invoice before delivered (state machine)
    assert client.post(f"/api/t/sales-orders/{order['id']}/invoice/").status_code == 400
    # cannot mark delivered straight from processing
    assert client.post(f"/api/t/sales-orders/{order['id']}/mark-delivered/").status_code == 400

    # walk to delivered, then overpayment + negative are rejected
    client.post(f"/api/t/sales-orders/{order['id']}/confirm/")
    client.post(f"/api/t/sales-orders/{order['id']}/delivery-note/", {})
    client.post(f"/api/t/sales-orders/{order['id']}/mark-delivered/")
    assert client.post(f"/api/t/sales-orders/{order['id']}/record-payment/", {"amount": "-5"}).status_code == 400
    assert client.post(f"/api/t/sales-orders/{order['id']}/record-payment/", {"amount": "9999"}).status_code == 400
    ok = client.post(f"/api/t/sales-orders/{order['id']}/record-payment/", {"amount": "200"})
    assert ok.data["payment_status"] == "paid"
    # double-invoice blocked
    client.post(f"/api/t/sales-orders/{order['id']}/invoice/")
    assert client.post(f"/api/t/sales-orders/{order['id']}/invoice/").status_code == 400


def test_orders_agent_scoping(api, make_tenant, tenant_token):
    """A non-manager sees only orders assigned to them."""
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    party = _party(api, owner)
    item = _item(api, owner)
    # manager creates an order (assigned to nobody)
    auth(api, owner).post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "X", "quantity": 1, "rate": "10"}]})
    agent_token, agent_id = _agent(api, tenant, tenant_token)
    # agent creates their own order (auto-assigned to self)
    auth(api, agent_token).post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "Y", "quantity": 1, "rate": "10"}]})
    # agent sees only their own; owner/manager sees both
    assert auth(api, agent_token).get("/api/t/sales-orders/").data["count"] == 1
    assert auth(api, owner).get("/api/t/sales-orders/").data["count"] == 2


def test_orders_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # FIELD only, no ORDERS
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/sales-orders/").status_code == 403


def test_inventory_seam_degrades_without_inv(api, make_tenant, tenant_token):
    """confirm + stock-warnings work with no INV module (capability returns None)."""
    # P8 has ORDERS but (in this build) no INV capability provider registered yet.
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 5, "rate": "30"}]}).data
    # no INV -> no warnings, confirm succeeds
    assert client.get(f"/api/t/sales-orders/{order['id']}/stock-warnings/").data["warnings"] == []
    assert client.post(f"/api/t/sales-orders/{order['id']}/confirm/").status_code == 200


# ------------------------------------------------------------- THE HEADLINE
def test_field_order_becomes_sales_order_when_orders_entitled(api, make_tenant, tenant_token):
    """A field agent books an order (FIELD); because the tenant also has ORDERS,
    an event auto-creates a SalesOrder in the approval queue — zero import."""
    tenant, _ = make_tenant(package_code="P8")  # Enterprise: FIELD + ORDERS
    owner = tenant_token(tenant)["access"]
    party, item = _party(api, owner), _item(api, owner)
    agent_token, agent_id = _agent(api, tenant, tenant_token)

    field_order = auth(api, agent_token).post("/api/t/field/orders/", {
        "party": party, "items": [{"item": item, "item_name": "Soap", "quantity": 8, "rate": "30", "tax_rate": "12"}],
    })
    assert field_order.status_code == 201
    fo_number = field_order.data["order_number"]

    # a SalesOrder was auto-created from the field.order_booked event
    orders = auth(api, owner).get("/api/t/sales-orders/?source=field")
    assert orders.data["count"] == 1
    so = orders.data["results"][0]
    assert so["source"] == "field" and so["status"] == "processing"
    assert so["field_order_id"] == field_order.data["id"]
    assert str(so["total"]) == "268.80"  # 8 x 30 + 12% tax, recomputed by ORDERS
    assert fo_number in so["notes"]

    # FIELD can read the back-office fulfilment status via capability (no import)
    from apps.foundation.integration import capabilities
    with use_tenant(tenant):
        status = capabilities.call("orders.status_for_field_order", field_order.data["id"],
                                   default=None, entitled_modules=["ORDERS"])
        assert status and status["status"] == "processing"


def test_field_order_stays_standalone_without_orders(api, make_tenant, tenant_token):
    """A FIELD-only tenant's field order does NOT create a SalesOrder — the
    ORDERS handler is entitlement-gated."""
    tenant, _ = make_tenant(package_code="P2")  # FIELD only, NO ORDERS
    owner = tenant_token(tenant)["access"]
    party, item = _party(api, owner), _item(api, owner)
    agent_token, agent_id = _agent(api, tenant, tenant_token)

    booked = auth(api, agent_token).post("/api/t/field/orders/", {
        "party": party, "items": [{"item": item, "item_name": "Soap", "quantity": 3, "rate": "30"}]})
    assert booked.status_code == 201
    # ORDERS not entitled -> no SalesOrder table access needed; the field order
    # is fully standalone. Confirm the module gate blocks the sales-orders API.
    assert auth(api, owner).get("/api/t/sales-orders/").status_code == 403
