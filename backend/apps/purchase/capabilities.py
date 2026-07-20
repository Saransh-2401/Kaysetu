"""
Capabilities PURCH provides. Other modules read procurement facts WITHOUT
importing PURCH; the registry gates each call on the PURCH entitlement.
"""


def _last_purchase_rate(item_id):
    """Most recent rate paid for an item — useful for stock valuation/pricing."""
    from .models import PurchaseOrderItem

    row = (PurchaseOrderItem.objects.filter(item_id=item_id)
           .order_by("-order__order_date", "-id").values_list("rate", flat=True).first())
    return float(row) if row is not None else None


def _supplier_stats(party_id):
    """{po_count, total_spent} for a supplier — powers the supplier list/profile."""
    from django.db.models import Count, Sum

    from .models import PurchaseOrder

    agg = PurchaseOrder.objects.filter(supplier_id=party_id).aggregate(
        po_count=Count("id"), total_spent=Sum("total")
    )
    return {
        "po_count": agg["po_count"] or 0,
        "total_spent": float(agg["total_spent"] or 0),
    }


def _suppliers_of(item_id):
    """Suppliers who have quoted or supplied this item, newest rate first.

    Sourced from PO lines AND from material-request suggestions, so a supplier
    lined up for an item that has not been ordered yet still shows.
    """
    from .models import MaterialRequestItem, PurchaseOrderItem

    seen, rows = set(), []
    for line in (PurchaseOrderItem.objects.filter(item_id=item_id)
                 .select_related("order", "order__supplier")
                 .order_by("-order__order_date", "-id")):
        party = line.order.supplier
        if party is None or party.pk in seen:
            continue
        seen.add(party.pk)
        rows.append({"id": party.pk, "name": party.name, "last_rate": str(line.rate),
                     "last_order_date": line.order.order_date.isoformat(), "source": "purchase_order"})
    for line in (MaterialRequestItem.objects.filter(item_id=item_id, supplier__isnull=False)
                 .select_related("supplier").order_by("-id")):
        if line.supplier_id in seen:
            continue
        seen.add(line.supplier_id)
        rows.append({"id": line.supplier_id, "name": line.supplier.name,
                     "last_rate": str(line.estimated_rate), "last_order_date": None,
                     "source": "material_request"})
    return rows


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("purchase.last_purchase_rate", "PURCH", _last_purchase_rate)
    capabilities.provide("purchase.supplier_stats", "PURCH", _supplier_stats)
    capabilities.provide("purchase.suppliers_of", "PURCH", _suppliers_of)
