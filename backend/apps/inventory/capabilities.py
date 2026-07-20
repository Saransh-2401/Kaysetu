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


def _set_stock(item_id, quantity, note="counted"):
    """Correct an item's stock to a counted figure.

    Recorded as an ADJUSTMENT of the difference, not as a silent overwrite: the
    ledger must still show that someone changed the number and by how much.
    """
    from decimal import Decimal

    from .services import adjust_stock, available_qty, default_warehouse

    target = Decimal(str(quantity))
    delta = target - Decimal(str(available_qty(item_id)))
    level = adjust_stock(item_id, default_warehouse(), delta, note=note)
    return float(level.on_hand)


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("inventory.stock_of", "INV", _stock_of)
    capabilities.provide("inventory.reserve", "INV", _reserve)
    capabilities.provide("inventory.release", "INV", _release)
    capabilities.provide("inventory.set_stock", "INV", _set_stock)
