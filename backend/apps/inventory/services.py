"""
INV domain services. The ledger is the source of truth; StockLevel is kept in
lockstep. All multi-row writes are atomic on the tenant DB and lock the level
row to avoid lost updates under concurrency.

Locking discipline: every path that locks more than one StockLevel row locks
them in a single consistent order (primary key) so concurrent reserve/release/
issue can never deadlock.
"""
import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction

from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import StockLedger, StockLevel, Warehouse

logger = logging.getLogger("kaysetu.inventory")


class InsufficientStock(Exception):
    """Raised when an operation would drive a warehouse's on-hand below zero."""


def _to_decimal(value, field="quantity") -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise InsufficientStock(f"invalid numeric value for {field}: {value!r}")


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))


def default_warehouse() -> Warehouse:
    wh = Warehouse.objects.filter(is_default=True).first() or Warehouse.objects.first()
    if wh is None:
        wh = Warehouse.objects.create(name="Main Warehouse", is_default=True)
    return wh


def _apply(item_id, warehouse, movement, signed_qty: Decimal, *, rate=Decimal("0"), reference="", note=""):
    """Append a ledger row and move the on-hand balance in one atomic step."""
    with _tenant_atomic():
        level, _ = StockLevel.objects.select_for_update().get_or_create(
            item_id=item_id, warehouse=warehouse
        )
        level.on_hand = (level.on_hand or Decimal("0")) + signed_qty
        level.save(update_fields=["on_hand", "updated_at"])
        StockLedger.objects.create(
            item_id=item_id, warehouse=warehouse, movement=movement, quantity=signed_qty,
            balance_after=level.on_hand, valuation_rate=rate, reference=reference, note=note,
        )
    return level


def receive_stock(item_id, warehouse, qty, *, rate=0, reference="") -> StockLevel:
    return _apply(item_id, warehouse, StockLedger.Movement.RECEIPT, _to_decimal(qty, "quantity"),
                  rate=_to_decimal(rate, "rate"), reference=reference, note="stock received")


def adjust_stock(item_id, warehouse, delta, *, note="") -> StockLevel:
    return _apply(item_id, warehouse, StockLedger.Movement.ADJUST, _to_decimal(delta, "delta"), note=note)


def transfer_stock(item_id, from_wh, to_wh, qty) -> None:
    """Move stock between warehouses. Both legs commit or roll back together, and
    the source must physically hold the quantity (no negative-stock teleport)."""
    qty = _to_decimal(qty)
    ref = f"transfer {from_wh.pk}->{to_wh.pk}"
    with _tenant_atomic():
        src = StockLevel.objects.select_for_update().filter(item_id=item_id, warehouse=from_wh).first()
        on_hand = (src.on_hand if src else Decimal("0")) or Decimal("0")
        if qty > on_hand:
            raise InsufficientStock(
                f"cannot transfer {qty}; only {on_hand} on hand at {from_wh}"
            )
        # inner _apply blocks degrade to savepoints -> the transfer is atomic as a whole
        _apply(item_id, from_wh, StockLedger.Movement.TRANSFER_OUT, -qty, reference=ref, note="transfer out")
        _apply(item_id, to_wh, StockLedger.Movement.TRANSFER_IN, qty, reference=ref, note="transfer in")


# ------------------------------------------------------- capability internals
def available_qty(item_id) -> Decimal:
    total = Decimal("0")
    for level in StockLevel.objects.filter(item_id=item_id):
        total += (level.on_hand or Decimal("0")) - (level.reserved or Decimal("0"))
    return total


def _locked_levels(item_id):
    """All of an item's stock levels, row-locked in a consistent (pk) order so
    concurrent reserve/release/issue can never deadlock."""
    return list(StockLevel.objects.select_for_update().filter(item_id=item_id).order_by("pk"))


def reserve(item_id, qty) -> Decimal:
    """Reserve up to `qty` across the item's warehouses (most-available first).
    Returns the amount actually reserved (best-effort; never over-reserves)."""
    qty = _to_decimal(qty)
    reserved_total = Decimal("0")
    with _tenant_atomic():
        levels = _locked_levels(item_id)  # locked in pk order
        for level in sorted(levels, key=lambda lv: -((lv.on_hand or Decimal("0")))):  # allocate most-available first
            if reserved_total >= qty:
                break
            free = (level.on_hand or Decimal("0")) - (level.reserved or Decimal("0"))
            if free <= 0:
                continue
            take = min(free, qty - reserved_total)
            level.reserved = (level.reserved or Decimal("0")) + take
            level.save(update_fields=["reserved", "updated_at"])
            reserved_total += take
    return reserved_total


def release(item_id, qty) -> None:
    qty = _to_decimal(qty)
    with _tenant_atomic():
        _release_locked(_locked_levels(item_id), qty)


def _release_locked(levels, qty) -> Decimal:
    """Reduce `reserved` across already-locked levels by up to `qty`. Returns the
    amount actually released. Caller owns the transaction + row locks."""
    to_release = qty
    for level in levels:
        if to_release <= 0:
            break
        rel = min(level.reserved or Decimal("0"), to_release)
        if rel <= 0:
            continue
        level.reserved = level.reserved - rel
        level.save(update_fields=["reserved", "updated_at"])
        to_release -= rel
    return qty - to_release


def issue_for_dispatch(item_id, qty, *, reference="") -> None:
    """Deduct on-hand for a dispatch and free the matching reservation.

    On-hand is drawn most-stock-first; the reservation is released GLOBALLY by
    the amount actually issued (not tied to the warehouse the stock came from) so
    a reservation placed on one warehouse can never be stranded when the goods
    ship from another. Never drives on-hand below zero."""
    qty = _to_decimal(qty)
    remaining = qty
    with _tenant_atomic():
        levels = _locked_levels(item_id)  # locked in pk order
        for level in sorted(levels, key=lambda lv: -((lv.on_hand or Decimal("0")))):  # ship from fullest first
            if remaining <= 0:
                break
            take = min(level.on_hand or Decimal("0"), remaining)
            if take <= 0:
                continue
            level.on_hand = level.on_hand - take
            level.save(update_fields=["on_hand", "updated_at"])
            StockLedger.objects.create(
                item_id=item_id, warehouse=level.warehouse, movement=StockLedger.Movement.ISSUE,
                quantity=-take, balance_after=level.on_hand, reference=reference, note="dispatched",
            )
            remaining -= take
        issued = qty - remaining
        _release_locked(levels, issued)  # free exactly what shipped, wherever it was reserved
        if remaining > 0:
            logger.warning(
                "issue_for_dispatch short by %s for item %s (requested %s, issued %s)",
                remaining, item_id, qty, issued,
            )
