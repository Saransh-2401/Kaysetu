"""
Capabilities INV provides. These are the EXACT names ORDERS already calls
(inventory.stock_of / inventory.reserve) — so installing INV lights up ORDERS'
stock warnings and reservations with zero change to ORDERS.
"""


def _stock_of(item_id, warehouse_id=None):
    """Available quantity (on_hand - reserved) for an item — what ORDERS' stock
    warnings compare the ordered quantity against."""
    from .services import available_qty

    return float(available_qty(item_id))


def _reserve(item_id, quantity):
    from .services import reserve

    return float(reserve(item_id, quantity))


def _release(item_id, quantity):
    from .services import release

    release(item_id, quantity)
    return True


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("inventory.stock_of", "INV", _stock_of)
    capabilities.provide("inventory.reserve", "INV", _reserve)
    capabilities.provide("inventory.release", "INV", _release)
