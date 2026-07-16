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


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("orders.status_for_field_order", "ORDERS", _status_for_field_order)
