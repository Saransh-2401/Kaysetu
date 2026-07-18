"""MOD-PROD: Production — BOM to finished goods.

Headline: completing a work order turns raw stock into finished stock inside INV
— materials consumed, goods produced — computed from the BOM, with neither
module importing the other. PROD runs standalone when INV isn't bought.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _item(api, token, name, price="10"):
    return auth(api, token).post("/api/t/catalog/", {"name": name, "price": price, "tax_rate": "0"}).data["id"]


def _bom(client, finished, raws, output=1):
    return client.post("/api/t/prod/boms/", {
        "item": finished, "output_quantity": output,
        "materials": [{"raw_material": r, "quantity": q, "rate": "10"} for r, q in raws],
    }).data


def _wo(client, bom_id, qty):
    return client.post("/api/t/prod/work-orders/", {"bom": bom_id, "planned_quantity": qty}).data


# ------------------------------------------------------------- standalone (P5)
def test_bom_validation_and_cost(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P5")   # PROD + INV
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    fg = _item(api, token, "Chair")
    wood, screw = _item(api, token, "Wood"), _item(api, token, "Screws")

    bom = _bom(client, fg, [(wood, 2), (screw, 8)])
    assert bom["bom_number"] == bom["number"]
    assert str(bom["material_cost"]) == "100.00"      # (2 + 8) x 10
    assert len(bom["materials"]) == 2

    # an item cannot be its own material, and duplicates are rejected
    assert client.post("/api/t/prod/boms/", {
        "item": fg, "materials": [{"raw_material": fg, "quantity": 1}]}).status_code == 400
    assert client.post("/api/t/prod/boms/", {
        "item": fg, "materials": [{"raw_material": wood, "quantity": 1},
                                  {"raw_material": wood, "quantity": 2}]}).status_code == 400


def test_work_order_explodes_bom_and_enforces_state_machine(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P5")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    fg, wood, screw = (_item(api, token, "Chair"), _item(api, token, "Wood"),
                       _item(api, token, "Screws"))
    bom = _bom(client, fg, [(wood, 2), (screw, 8)], output=1)

    wo = _wo(client, bom["id"], 5)                     # 5 chairs -> 10 wood, 40 screws
    required = {m["raw_material"]: m["required_quantity"] for m in wo["materials"]}
    assert str(required[wood]) == "10.000" and str(required[screw]) == "40.000"
    assert wo["status"] == "draft"

    # cannot complete straight from draft
    assert client.post(f"/api/t/prod/work-orders/{wo['id']}/complete/", {}).status_code == 400
    client.post(f"/api/t/prod/work-orders/{wo['id']}/release/")
    client.post(f"/api/t/prod/work-orders/{wo['id']}/start/")
    done = client.post(f"/api/t/prod/work-orders/{wo['id']}/complete/", {}).data
    assert done["status"] == "completed" and str(done["produced_quantity"]) == "5.000"
    # a completed order is terminal
    assert client.post(f"/api/t/prod/work-orders/{wo['id']}/complete/", {}).status_code == 400


def test_prod_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")   # FIELD only
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/prod/boms/").status_code == 403
    assert auth(api, token).get("/api/t/prod/work-orders/").status_code == 403


# ------------------------------------------------------------- THE HEADLINE
def test_completion_consumes_raw_and_produces_finished_stock(api, make_tenant, tenant_token):
    """The manufacturing run: raw stock down, finished stock up — all in INV."""
    tenant, _ = make_tenant(package_code="P5")   # PROD + INV
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    fg, wood, screw = (_item(api, token, "Chair"), _item(api, token, "Wood"),
                       _item(api, token, "Screws"))
    client.post("/api/t/inv/receive", {"item": wood, "quantity": 100, "rate": 10})
    client.post("/api/t/inv/receive", {"item": screw, "quantity": 500, "rate": 1})

    bom = _bom(client, fg, [(wood, 2), (screw, 8)])
    wo = _wo(client, bom["id"], 5)
    client.post(f"/api/t/prod/work-orders/{wo['id']}/release/")
    client.post(f"/api/t/prod/work-orders/{wo['id']}/start/")
    client.post(f"/api/t/prod/work-orders/{wo['id']}/complete/", {})

    def on_hand(item):
        rows = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
        return rows[0]["on_hand"] if rows else "0"

    assert str(on_hand(wood)) == "90.000"     # 100 - (5 x 2)
    assert str(on_hand(screw)) == "460.000"   # 500 - (5 x 8)
    assert str(on_hand(fg)) == "5.000"        # finished goods created


def test_release_flags_material_shortage_from_inv(api, make_tenant, tenant_token):
    """Release records availability from INV so a shortage shows before the run."""
    tenant, _ = make_tenant(package_code="P5")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    fg, wood = _item(api, token, "Chair"), _item(api, token, "Wood")
    client.post("/api/t/inv/receive", {"item": wood, "quantity": 3, "rate": 10})

    bom = _bom(client, fg, [(wood, 2)])
    wo = _wo(client, bom["id"], 5)            # needs 10 wood, only 3 on hand
    released = client.post(f"/api/t/prod/work-orders/{wo['id']}/release/").data
    assert released["has_shortage"] is True
    line = released["materials"][0]
    assert str(line["available_at_release"]) == "3.000" and line["shortfall"] == 7.0


def test_partial_yield_scales_consumption(api, make_tenant, tenant_token):
    """Producing less than planned consumes proportionally less."""
    tenant, _ = make_tenant(package_code="P5")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    fg, wood = _item(api, token, "Chair"), _item(api, token, "Wood")
    client.post("/api/t/inv/receive", {"item": wood, "quantity": 100, "rate": 10})
    bom = _bom(client, fg, [(wood, 2)])
    wo = _wo(client, bom["id"], 10)           # plans 10 chairs = 20 wood
    client.post(f"/api/t/prod/work-orders/{wo['id']}/release/")
    client.post(f"/api/t/prod/work-orders/{wo['id']}/start/")
    client.post(f"/api/t/prod/work-orders/{wo['id']}/complete/", {"produced_quantity": 4})

    levels = {r["item"]: r["on_hand"] for r in
              client.get("/api/t/inv/stock-levels/").data["results"]}
    assert str(levels[wood]) == "92.000"      # only 8 consumed for 4 chairs
    assert str(levels[fg]) == "4.000"
    # over-producing beyond plan is rejected
    wo2 = _wo(client, bom["id"], 2)
    client.post(f"/api/t/prod/work-orders/{wo2['id']}/release/")
    client.post(f"/api/t/prod/work-orders/{wo2['id']}/start/")
    assert client.post(f"/api/t/prod/work-orders/{wo2['id']}/complete/",
                       {"produced_quantity": 99}).status_code == 400


def test_prod_runs_standalone_without_inv(api, make_tenant, tenant_token):
    """PROD entitled alone: the run completes and simply moves no stock."""
    tenant, _ = make_tenant(package_code="P5")
    token = tenant_token(tenant)["access"]
    with use_tenant(tenant):
        from apps.foundation.models import EntitlementSnapshot
        EntitlementSnapshot.objects.update_or_create(pk=1, defaults={"modules": ["PROD"]})
    client = auth(api, token)
    fg, wood = _item(api, token, "Chair"), _item(api, token, "Wood")
    bom = _bom(client, fg, [(wood, 2)])
    wo = _wo(client, bom["id"], 5)
    released = client.post(f"/api/t/prod/work-orders/{wo['id']}/release/").data
    assert released["has_shortage"] is False          # no INV to consult
    assert released["materials"][0]["available_at_release"] is None
    client.post(f"/api/t/prod/work-orders/{wo['id']}/start/")
    assert client.post(f"/api/t/prod/work-orders/{wo['id']}/complete/", {}).data["status"] == "completed"
    with use_tenant(tenant):
        from apps.inventory.models import StockLevel
        assert StockLevel.objects.count() == 0


# --------------------------------------------------- planning layer (portal wiring)
def test_material_availability_aggregates_shared_materials(api, make_tenant, tenant_token):
    """A material used by TWO planned products must be counted ONCE against one
    pool of stock — otherwise the same units look available to both."""
    tenant, _ = make_tenant(package_code="P5")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    wood = _item(api, token, "Wood")
    chair, table = _item(api, token, "Chair"), _item(api, token, "Table")
    _bom(client, chair, [(wood, 2)])
    _bom(client, table, [(wood, 3)])
    client.post("/api/t/inv/receive", {"item": wood, "quantity": 40, "rate": 10})

    rows = client.post("/api/t/prod/plans/check_material_availability/", {
        "items": [{"item_id": chair, "quantity": 10},    # 20 wood
                  {"item_id": table, "quantity": 10}]}).data  # 30 wood -> 50 total
    assert len(rows) == 1                                # one aggregated row, not two
    assert rows[0]["qty_needed"] == 50.0 and rows[0]["available_qty"] == 40.0
    assert rows[0]["shortage"] == 10.0 and rows[0]["is_available"] is False


def test_plan_and_job_card_lifecycle(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P5")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    fg, wood = _item(api, token, "Chair"), _item(api, token, "Wood")
    bom = _bom(client, fg, [(wood, 2)])

    plan = client.post("/api/t/prod/plans/", {
        "from_date": "2026-07-16", "to_date": "2026-07-31",
        "items": [{"item": fg, "planned_qty": 10, "priority": "high"}]}).data
    assert plan["plan_number"] and plan["batch_no"] and plan["status"] == "draft"
    # stop before start is refused by the state machine
    assert client.post(f"/api/t/prod/plans/{plan['id']}/stop_production/").status_code == 400
    assert client.post(f"/api/t/prod/plans/{plan['id']}/start_production/").data["plan_status"] == "in_progress"

    wo = _wo(client, bom["id"], 5)
    card = client.post("/api/t/prod/job-cards/", {"work_order": wo["id"], "for_quantity": 5}).data
    assert card["job_card_number"] and card["status"] == "pending"
    assert client.post(f"/api/t/prod/job-cards/{card['id']}/complete/",
                       {"quantity": 99}).status_code == 400     # beyond the card
    done = client.post(f"/api/t/prod/job-cards/{card['id']}/complete/", {"quantity": 5})
    assert done.status_code == 200 and done.data["status"] == "completed"
    assert client.post(f"/api/t/prod/job-cards/{card['id']}/complete/",
                       {"quantity": 5}).status_code == 400      # already complete
