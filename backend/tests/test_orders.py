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
    """ORDERS runs standalone: when INV is not entitled, the inventory.* seams
    return None and ORDERS degrades gracefully (no warnings, confirm still works).

    Every shipped package that includes ORDERS also bundles INV, so we simulate
    an ORDERS-only entitlement by dropping INV from the snapshot — proving the
    capability is entitlement-gated, not merely provider-presence-gated."""
    from apps.foundation.models import EntitlementSnapshot
    from apps.tenancy.context import use_tenant

    tenant, _ = make_tenant(package_code="P4")
    with use_tenant(tenant):  # entitle ORDERS only — INV provider stays registered but un-entitled
        EntitlementSnapshot.objects.update_or_create(pk=1, defaults={"modules": ["ORDERS"]})

    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 5, "rate": "30"}]}).data
    # INV not entitled -> capability returns None -> no warnings, confirm succeeds
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


# ------------------------------------------------- portal action-name aliases
# The ported order screens speak the previous platform's vocabulary
# (submit/pack/mark_dispatched/deliver/generate_invoice/mark_paid). Those names
# are served as aliases over the same services, so the imported UI works
# untouched. This walks the whole lifecycle using ONLY the portal's names.
def test_portal_order_lifecycle_via_alias_actions(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")   # ORDERS + INV + DIST
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 100, "rate": 30})

    order = client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 10, "rate": "30", "tax_rate": "12"}],
    }).data
    oid = order["id"]

    assert client.post(f"/api/t/sales-orders/{oid}/submit/", {}).status_code == 200
    details = client.get(f"/api/t/sales-orders/{oid}/stock_details/").data
    assert details[0]["on_hand"] == 100.0 and details[0]["is_sufficient"] is True

    assert client.post(f"/api/t/sales-orders/{oid}/confirm/", {}).status_code == 200
    assert client.post(f"/api/t/sales-orders/{oid}/pack/", {}).data["status"] == "packed"
    assert client.post(f"/api/t/sales-orders/{oid}/mark_dispatched/", {}).data["status"] == "in_transit"
    assert client.post(f"/api/t/sales-orders/{oid}/deliver/", {}).data["status"] == "delivered"

    # dispatching really moved stock (the alias goes through the event, not a
    # bare status flip)
    level = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"][0]
    assert str(level["on_hand"]) == "90.000"

    gen = client.post(f"/api/t/sales-orders/{oid}/generate_invoice/", {})
    assert gen.status_code == 201 and gen.data["invoice_id"]

    paid = client.post(f"/api/t/sales-orders/{oid}/mark_paid/", {"reference": "NEFT-1"}).data
    assert paid["payment_status"] == "paid"        # no amount = settle in full


def test_update_items_changes_quantity_but_never_the_rate(api, make_tenant, tenant_token):
    """A revise-order screen must not be able to reprice a sale."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)   # price 30, tax 12
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 10, "rate": "30", "tax_rate": "12"}],
    }).data
    oid, line_id = order["id"], order["items"][0]["id"]

    revised = client.post(f"/api/t/sales-orders/{oid}/update_items/", {
        "items": [{"id": line_id, "quantity": 4, "rate": "1"}],   # rate MUST be ignored
    }).data
    assert str(revised["items"][0]["rate"]) == "30.00"            # not 1
    assert str(revised["items"][0]["quantity"]) == "4.00"
    assert str(revised["subtotal"]) == "120.00"                   # 4 x 30, re-derived
    assert str(revised["tax_amount"]) == "14.40"

    # a new line prices itself from the catalog, not from the request
    revised = client.post(f"/api/t/sales-orders/{oid}/update_items/", {
        "items": [{"id": line_id, "quantity": 4}, {"item": item, "quantity": 1, "rate": "999"}],
    }).data
    assert str(revised["items"][1]["rate"]) == "30.00"
    # dropping every line is refused — an order with no lines has no meaning
    assert client.post(f"/api/t/sales-orders/{oid}/update_items/", {"items": []}).status_code == 400


def test_update_and_approve_is_atomic(api, make_tenant, tenant_token):
    """If the approval fails the revision must not stick."""
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "order_date": str(timezone.localdate()),
        "items": [{"item": item, "item_name": "Soap", "quantity": 10, "rate": "30", "tax_rate": "12"}],
    }).data
    oid, line_id = order["id"], order["items"][0]["id"]

    approved = client.post(f"/api/t/sales-orders/{oid}/update_and_approve/", {
        "items": [{"id": line_id, "quantity": 6}], "notes": "trimmed"}).data
    assert approved["status"] == "order_confirmed" and str(approved["subtotal"]) == "180.00"

    # a second attempt is refused (already confirmed) AND leaves quantities alone
    assert client.post(f"/api/t/sales-orders/{oid}/update_and_approve/", {
        "items": [{"id": line_id, "quantity": 99}]}).status_code == 400
    assert str(client.get(f"/api/t/sales-orders/{oid}/").data["items"][0]["quantity"]) == "6.00"


def test_backordered_lists_only_orders_inv_cannot_cover(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party = _party(api, token)
    plenty, scarce = _item(api, token, "Plenty"), _item(api, token, "Scarce")
    client.post("/api/t/inv/receive", {"item": plenty, "quantity": 500, "rate": 30})
    client.post("/api/t/inv/receive", {"item": scarce, "quantity": 1, "rate": 30})

    for item, name in ((plenty, "Plenty"), (scarce, "Scarce")):
        client.post("/api/t/sales-orders/", {
            "customer": party, "order_date": str(timezone.localdate()),
            "items": [{"item": item, "item_name": name, "quantity": 10, "rate": "30"}]})

    short = client.get("/api/t/sales-orders/backordered/").data
    assert len(short) == 1
    assert short[0]["items"][0]["item_name"] == "Scarce"
