"""
Event subscriptions ORDERS sets up. THE headline integration: a field agent's
booked order (FIELD emits `field.order_booked`) lands in the ORDERS approval
queue as a SalesOrder — but only for tenants that actually bought ORDERS.

ORDERS never imports FIELD; it reacts to the event payload, which carries the
full order (party, agent, items, totals). The handler runs in the emitter's
tenant context, so it writes to the right tenant DB.
"""


def _on_field_order_booked(**payload):
    # Entitlement gate: a FIELD-only tenant keeps the order standalone in FIELD;
    # only a tenant that also bought ORDERS gets a back-office SalesOrder.
    from apps.foundation.models import EntitlementSnapshot

    if "ORDERS" not in EntitlementSnapshot.current_modules():
        return

    from django.utils import timezone

    from apps.foundation.models import TenantUser

    from . import services

    # Preserve which agent booked the order (agent_id is a TenantUser pk in the
    # same tenant DB). .filter().first() so a missing id degrades to None.
    agent = TenantUser.objects.filter(pk=payload.get("agent_id")).first()
    services.create_order(
        customer_id=payload.get("party_id"),
        order_date=timezone.localdate(),
        items=payload.get("items", []),
        assigned_agent=agent,
        source=services.SalesOrder.Source.FIELD,
        field_order_id=payload.get("order_id"),
        notes=f"From field order {payload.get('order_number', '')}",
    )


def register_all():
    from apps.foundation.integration import events

    events.subscribe("field.order_booked", _on_field_order_booked)
