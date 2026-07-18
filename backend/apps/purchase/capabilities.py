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


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("purchase.last_purchase_rate", "PURCH", _last_purchase_rate)
    capabilities.provide("purchase.supplier_stats", "PURCH", _supplier_stats)
