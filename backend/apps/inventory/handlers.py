"""
Event subscriptions INV sets up — INV is the stock authority, so it reacts to
what the operational modules announce, without either side importing the other:

  * ORDERS emits `orders.dispatched`      -> INV deducts the stock (and releases
    the matching reservation).
  * PURCH  emits `purchase.goods_received` -> INV adds the received stock.

Both are gated on the INV entitlement, so a tenant without INV ignores them.
"""


def _inv_entitled() -> bool:
    from apps.foundation.models import EntitlementSnapshot

    return "INV" in EntitlementSnapshot.current_modules()


def _on_order_dispatched(**payload):
    if not _inv_entitled():
        return

    from . import services

    reference = payload.get("order_number", "")
    for line in payload.get("items", []):
        item_id = line.get("item_id")
        if item_id is None:
            continue
        services.issue_for_dispatch(item_id, line.get("quantity", 0), reference=reference)


def _on_goods_received(**payload):
    """A GRN was completed in PURCH — receive the accepted quantities into stock.

    The whole receipt is applied in ONE transaction: a failure on any line rolls
    back the rest, so stock can never end up half-received against a GRN that the
    emitter already considers complete."""
    if not _inv_entitled():
        return

    from django.db import transaction

    from apps.tenancy.context import require_tenant
    from apps.tenancy.db import ensure_alias

    from .models import Warehouse
    from . import services

    lines = [ln for ln in payload.get("items", []) if ln.get("item_id") is not None]
    if not lines:
        return

    reference = payload.get("receipt_number", "")
    with transaction.atomic(using=ensure_alias(require_tenant())):
        warehouse = None
        warehouse_id = payload.get("warehouse_id")
        if warehouse_id:
            warehouse = Warehouse.objects.filter(pk=warehouse_id).first()
        if warehouse is None:
            warehouse = services.default_warehouse()

        for line in lines:
            services.receive_stock(
                line["item_id"], warehouse, line.get("quantity", 0),
                rate=line.get("rate", 0), reference=reference,
            )


def _on_dist_dispatched(**payload):
    """DIST shipped stock to a distributor — deduct it from the company's stock.
    Same effect as an order dispatch, just a different channel."""
    if not _inv_entitled():
        return

    from . import services

    reference = payload.get("request_number", "")
    for line in payload.get("items", []):
        item_id = line.get("item_id")
        if item_id is None:
            continue
        services.issue_for_dispatch(item_id, line.get("quantity", 0), reference=reference)


def _on_materials_consumed(**payload):
    """PROD consumed raw materials on a completed work order — deduct them."""
    if not _inv_entitled():
        return

    from . import services

    reference = payload.get("order_number", "")
    for line in payload.get("items", []):
        item_id = line.get("item_id")
        if item_id is None:
            continue
        services.issue_for_dispatch(item_id, line.get("quantity", 0), reference=reference)


def _on_goods_produced(**payload):
    """PROD finished goods — receive them into stock (same path as a GRN)."""
    _on_goods_received(
        receipt_number=payload.get("order_number", ""),
        warehouse_id=payload.get("warehouse_id"),
        items=payload.get("items", []),
    )


def register_all():
    from apps.foundation.integration import events

    events.subscribe("orders.dispatched", _on_order_dispatched)
    events.subscribe("purchase.goods_received", _on_goods_received)
    events.subscribe("dist.stock_dispatched", _on_dist_dispatched)
    events.subscribe("prod.materials_consumed", _on_materials_consumed)
    events.subscribe("prod.goods_produced", _on_goods_produced)
