"""Capabilities DIST provides — distributor-channel facts, no imports needed."""


def _distributor_stock_of(party_id, item_id):
    """What a distributor currently holds of an item."""
    from .models import DistributorStock

    row = DistributorStock.objects.filter(distributor_id=party_id, item_id=item_id).first()
    return float(row.on_hand) if row else 0.0


def _distributor_stats(party_id):
    """{request_count, total_value, outstanding} for a distributor."""
    from django.db.models import Count, Sum

    from .models import StockRequest

    agg = StockRequest.objects.filter(distributor_id=party_id).aggregate(
        request_count=Count("id"), total_value=Sum("total_amount"), paid=Sum("amount_paid")
    )
    total = float(agg["total_value"] or 0)
    paid = float(agg["paid"] or 0)
    return {"request_count": agg["request_count"] or 0, "total_value": total,
            "outstanding": round(total - paid, 2)}


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("dist.distributor_stock_of", "DIST", _distributor_stock_of)
    capabilities.provide("dist.distributor_stats", "DIST", _distributor_stats)
