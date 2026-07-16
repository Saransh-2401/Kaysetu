"""
INV module — Inventory & Warehouse. Lives in EACH TENANT'S database.

The StockLedger is the append-only source of truth for every stock movement;
StockLevel is a materialised on-hand/reserved cache for fast reads. Ported from
the previous platform's warehouse app, decoupled: items are Foundation
CatalogItems. Imports only foundation.

INV is the stock authority other modules reach ONLY via capabilities/events:
ORDERS reserves on confirm (inventory.reserve) and INV deducts on dispatch
(subscribes orders.dispatched) — no import either way.
"""
from django.db import models


class Warehouse(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=32, blank=True)
    address = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class StockLevel(models.Model):
    """Current on-hand + reserved for an item in a warehouse (materialised)."""

    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.CASCADE, related_name="stock_levels")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stock_levels")
    on_hand = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    reserved = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    reorder_level = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("item", "warehouse")]
        indexes = [models.Index(fields=["item"])]
        ordering = ["item_id", "warehouse_id"]

    @property
    def available(self):
        return self.on_hand - self.reserved


class StockLedger(models.Model):
    """Append-only movement history — the source of truth for stock."""

    class Movement(models.TextChoices):
        RECEIPT = "receipt", "Receipt"        # stock in (purchase / opening)
        ISSUE = "issue", "Issue"              # stock out (dispatch)
        ADJUST = "adjust", "Adjustment"       # manual correction
        TRANSFER_IN = "transfer_in", "Transfer In"
        TRANSFER_OUT = "transfer_out", "Transfer Out"

    item = models.ForeignKey("foundation.CatalogItem", on_delete=models.PROTECT, related_name="ledger_entries")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="ledger_entries")
    movement = models.CharField(max_length=16, choices=Movement.choices)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)   # signed: + in, - out
    balance_after = models.DecimalField(max_digits=14, decimal_places=3)
    valuation_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reference = models.CharField(max_length=100, blank=True)   # e.g. order number, PO
    note = models.CharField(max_length=200, blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at", "-id"]
        indexes = [
            models.Index(fields=["item", "-at"]),
            models.Index(fields=["warehouse", "-at"]),
        ]
