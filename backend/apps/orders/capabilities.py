"""
Capabilities ORDERS provides. FIELD's "my orders" screen reads a field order's
back-office fulfilment status through this, without importing ORDERS.
"""


def _status_for_field_order(field_order_id):
    from .models import SalesOrder

    so = SalesOrder.objects.filter(field_order_id=field_order_id).first()
    if so is None:
        return None
    return {
        "order_number": so.order_number,
        "status": so.status,
        "payment_status": so.payment_status,
        "total": str(so.total),
    }


def _for_party(party_id, from_date=None, to_date=None):
    """One customer's order history + product mix — the client-profile drawer."""
    from collections import defaultdict
    from decimal import Decimal

    from .models import SalesOrder, SalesOrderItem

    orders = SalesOrder.objects.filter(customer_id=party_id).exclude(
        status=SalesOrder.Status.REJECTED)
    if from_date:
        orders = orders.filter(order_date__gte=from_date)
    if to_date:
        orders = orders.filter(order_date__lte=to_date)
    orders = list(orders.order_by("-order_date", "-id")[:100])

    mix = defaultdict(lambda: {"qty": Decimal("0"), "amount": Decimal("0")})
    for line in SalesOrderItem.objects.filter(order_id__in=[o.pk for o in orders]):
        mix[line.item_name]["qty"] += line.quantity or Decimal("0")
        mix[line.item_name]["amount"] += line.amount or Decimal("0")

    return {
        "orders": [{
            "id": o.pk, "order_number": o.order_number, "order_date": o.order_date.isoformat(),
            "fulfillment_status": o.status, "payment_status": o.payment_status,
            "total": float(o.total or 0),
        } for o in orders],
        "order_count": len(orders),
        "total_order_amount": float(sum((o.total or Decimal("0")) for o in orders)),
        "product_sales": sorted(
            ({"product": name, "qty": float(v["qty"]), "amount": float(v["amount"])}
             for name, v in mix.items()),
            key=lambda r: r["amount"], reverse=True)[:50],
    }


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("orders.status_for_field_order", "ORDERS", _status_for_field_order)
    capabilities.provide("orders.for_party", "ORDERS", _for_party)
