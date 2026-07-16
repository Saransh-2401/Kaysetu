"""
Event subscriptions INV sets up. When ORDERS dispatches an order it emits
`orders.dispatched` carrying the line items; INV deducts the stock (and releases
the matching reservation) — but only for tenants that bought INV. ORDERS never
imports INV; INV never imports ORDERS.
"""


def _on_order_dispatched(**payload):
    from apps.foundation.models import EntitlementSnapshot

    if "INV" not in EntitlementSnapshot.current_modules():
        return

    from . import services

    reference = payload.get("order_number", "")
    for line in payload.get("items", []):
        item_id = line.get("item_id")
        if item_id is None:
            continue
        services.issue_for_dispatch(item_id, line.get("quantity", 0), reference=reference)


def register_all():
    from apps.foundation.integration import events

    events.subscribe("orders.dispatched", _on_order_dispatched)
