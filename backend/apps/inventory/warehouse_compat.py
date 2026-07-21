"""
Compatibility shim for the ported "Stock Adjustments" screen, which speaks the
previous platform's /warehouse/stock-entries/ document API (create a draft entry,
then submit it to move stock). Here stock lives in the INV ledger (append-only
StockLedger + StockLevel), so we:

  * project ADJUST ledger rows into the old StockEntry shape for the list, and
  * collapse the create+submit handshake into a single ledger adjustment —
    create applies it, submit is a confirming no-op (the ledger is append-only,
    so re-applying on submit would double-count).

Gated by HasModule("INV"); writes are manager-only, mirroring StockOpsView.
"""
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.permissions import HasModule

from . import services
from .models import StockLedger, Warehouse
from .views import _is_manager

InvModule = HasModule("INV")


def _entry_from_ledger(row):
    """Project one adjustment ledger row into the legacy StockEntry shape."""
    qty = float(row.quantity)
    balance = float(row.balance_after)
    rate = float(row.valuation_rate)
    return {
        "id": row.id,
        "entry_number": row.reference or f"ADJ-{row.id:05d}",
        "entry_type": "stock_adjustment",
        "stock_type": "item",
        "entry_date": row.at.date().isoformat(),
        "source_warehouse": None,
        "target_warehouse": row.warehouse_id,
        "is_submitted": True,
        "remarks": row.note,
        "created_by_name": "System User",
        "items": [{
            "id": row.id,
            "item": row.item_id,
            "item_name": row.item.name,
            "item_code": row.item.code,
            "product_name": row.item.name,
            "product_sku": row.item.code,
            "uom": row.item.unit,
            "quantity": qty,
            "previous_stock": round(balance - qty, 3),
            "new_stock": balance,
            "rate": rate,
            "amount": round(qty * rate, 2),
        }],
    }


class StockEntryCompatView(APIView):
    """GET = list adjustments; POST = create (apply) an adjustment."""

    permission_classes = [InvModule]

    def get(self, request):
        qs = (
            StockLedger.objects
            .select_related("item", "warehouse")
            .filter(movement=StockLedger.Movement.ADJUST)
        )
        p = request.query_params
        if p.get("entry_date_after"):
            qs = qs.filter(at__date__gte=p["entry_date_after"])
        if p.get("entry_date_before"):
            qs = qs.filter(at__date__lte=p["entry_date_before"])
        if p.get("search"):
            qs = qs.filter(item__name__icontains=p["search"])
        # Only "created_at" is a sort key the portal sends; map it to `at`.
        qs = qs.order_by("at" if p.get("ordering") == "created_at" else "-at", "-id")

        try:
            limit = max(1, int(p.get("limit", 25)))
            offset = max(0, int(p.get("offset", 0)))
        except (TypeError, ValueError):
            limit, offset = 25, 0
        total = qs.count()
        rows = qs[offset:offset + limit]
        return Response({"count": total, "results": [_entry_from_ledger(r) for r in rows]})

    def post(self, request):
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)
        data = request.data
        items = data.get("items") or []
        if not items:
            return Response({"detail": "At least one item line is required."}, status=400)

        wh_id = data.get("target_warehouse")
        warehouse = (Warehouse.objects.filter(pk=wh_id).first() if wh_id else None) or services.default_warehouse()
        remarks = data.get("remarks", "")

        last = None
        for line in items:
            item_id = line.get("item") or line.get("product")
            if not item_id:
                return Response({"detail": "Each line needs an item or product."}, status=400)
            try:
                services.adjust_stock(item_id, warehouse, line.get("quantity", 0), note=remarks)
            except services.InsufficientStock as exc:
                return Response({"detail": str(exc)}, status=400)
            last = (
                StockLedger.objects.select_related("item", "warehouse")
                .filter(item_id=item_id, warehouse=warehouse, movement=StockLedger.Movement.ADJUST)
                .order_by("-id").first()
            )

        entry = _entry_from_ledger(last)
        # The portal will POST /submit next; report unsubmitted so that call has
        # something to "submit" (it is a no-op — the stock already moved here).
        entry["is_submitted"] = False
        return Response(entry, status=201)


class StockEntrySubmitView(APIView):
    """POST /warehouse/stock-entries/{id}/submit/ — confirm an applied entry."""

    permission_classes = [InvModule]

    def post(self, request, pk):
        # No-op: the adjustment was already applied when the entry was created.
        # Re-applying here would double-count on the append-only ledger.
        return Response({"id": pk, "is_submitted": True})
