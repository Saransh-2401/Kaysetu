"""
NOTIFY subscribes to what the modules announce and turns it into notifications.

This is the payoff of the integration layer: eleven modules already emit domain
events, so notifications are wired by SUBSCRIBING to them — no module needed a
single line changed, and a module that isn't installed simply never fires.

Every handler is defensive: a notification must never break the business
operation that triggered it (the event bus swallows exceptions anyway, but a
failure here would still burn an outbox retry for nothing).
"""
import logging

logger = logging.getLogger("salexa.notifications")


def _notify(event_key, **kwargs):
    from .services import notify_event

    try:
        notify_event(event_key, **kwargs)
    except Exception:
        logger.exception("notification for %s failed", event_key)


def _party_name(party_id):
    if not party_id:
        return ""
    from apps.foundation.models import Party

    party = Party.objects.filter(pk=party_id).only("name").first()
    return party.name if party else ""


# ------------------------------------------------------------- field & visits
def on_visit_checked_in(agent_id=None, visit_id=None, **_):
    _notify("visit_checkin", subject="Agent checked in",
            message=f"Visit #{visit_id} check-in recorded.",
            reference_doctype="visit", reference_name=str(visit_id or ""),
            exclude_user_id=agent_id)


def on_visit_completed(agent_id=None, visit_id=None, party_id=None, **_):
    name = _party_name(party_id)
    _notify("visit_checkout", subject="Visit completed",
            message=f"Visit #{visit_id}{f' at {name}' if name else ''} is complete.",
            reference_doctype="visit", reference_name=str(visit_id or ""),
            exclude_user_id=agent_id)


def on_agent_offline(agent_id=None, **_):
    _notify("agent_offline", subject="Agent went offline",
            message="A punched-in agent stopped sharing location.",
            reference_doctype="agent", reference_name=str(agent_id or ""))


def on_agent_online(agent_id=None, **_):
    _notify("agent_online", subject="Agent back online",
            message="Location sharing resumed.",
            reference_doctype="agent", reference_name=str(agent_id or ""))


# ------------------------------------------------------------- sales & orders
def on_field_order_booked(order_number=None, agent_id=None, party_id=None, total=None, **_):
    name = _party_name(party_id)
    _notify("order_placed", subject=f"Order {order_number} booked",
            message=f"{name or 'A customer'} ordered {total or ''}".strip(),
            reference_doctype="field_order", reference_name=str(order_number or ""),
            exclude_user_id=agent_id)


def on_order_created(order_id=None, source=None, **_):
    _notify("order_placed", subject="Sales order created",
            message=f"A {source or 'new'} order was created.",
            reference_doctype="sales_order", reference_name=str(order_id or ""))


def _order_status(order_id, what):
    _notify("order_status", subject=f"Order {what}",
            message=f"Order #{order_id} is {what}.",
            reference_doctype="sales_order", reference_name=str(order_id or ""))


def on_order_confirmed(order_id=None, **_):
    _order_status(order_id, "confirmed")


def on_order_dispatched(order_id=None, order_number=None, **_):
    _order_status(order_number or order_id, "dispatched")


def on_order_delivered(order_id=None, **_):
    _order_status(order_id, "delivered")


# ------------------------------------------------------- inventory & requests
def on_stock_request_created(request_id=None, distributor_id=None, **_):
    name = _party_name(distributor_id)
    _notify("stock_request_raised", subject="Stock request raised",
            message=f"{name or 'A distributor'} requested stock.",
            reference_doctype="stock_request", reference_name=str(request_id or ""))


def on_stock_dispatched(request_id=None, request_number=None, **_):
    _notify("stock_request_status", subject="Stock request dispatched",
            message=f"Request {request_number or request_id} is on its way.",
            reference_doctype="stock_request", reference_name=str(request_number or request_id or ""))


# ------------------------------------------------------------------- purchase
def on_purchase_order_created(order_id=None, supplier_id=None, total=None, **_):
    _notify("material_request_raised", subject="Purchase order created",
            message=f"A purchase order for {total or ''} was raised.".strip(),
            reference_doctype="purchase_order", reference_name=str(order_id or ""))


def on_goods_received(receipt_number=None, order_id=None, **_):
    _notify("material_request_status", subject="Goods received",
            message=f"Receipt {receipt_number} recorded against PO #{order_id}.",
            reference_doctype="goods_receipt", reference_name=str(receipt_number or ""))


# -------------------------------------------------------------------- finance
def on_payment_recorded(order_id=None, party_id=None, amount=None, **_):
    name = _party_name(party_id)
    _notify("payment_received", subject="Payment received",
            message=f"{amount or ''} received from {name or 'a customer'}".strip(),
            reference_doctype="sales_order", reference_name=str(order_id or ""))


def on_dist_payment(invoice_id=None, party_id=None, amount=None, **_):
    name = _party_name(party_id)
    _notify("payment_received", subject="Distributor payment received",
            message=f"{amount or ''} received from {name or 'a distributor'}".strip(),
            reference_doctype="distributor_invoice", reference_name=str(invoice_id or ""))


# ------------------------------------------------------------------ leads/CRM
def on_lead_converted(lead_id=None, party_id=None, **_):
    _notify("lead_added", subject="Lead converted",
            message=f"Lead #{lead_id} became a customer.",
            reference_doctype="lead", reference_name=str(lead_id or ""))


# ------------------------------------------------------------ travel allowance
def on_ta_claim_paid(claim_id=None, claim_number=None, user_id=None, amount=None, **_):
    _notify("travel_allowance_status", subject="Travel allowance paid",
            message=f"Claim {claim_number or claim_id} paid: {amount or ''}".strip(),
            reference_doctype="ta_claim", reference_name=str(claim_number or claim_id or ""),
            user_ids=[user_id] if user_id else None)


SUBSCRIPTIONS = {
    "field.visit_checked_in": on_visit_checked_in,
    "field.visit_completed": on_visit_completed,
    "field.order_booked": on_field_order_booked,
    "track.went_offline": on_agent_offline,
    "track.back_online": on_agent_online,
    "orders.order_created": on_order_created,
    "orders.order_confirmed": on_order_confirmed,
    "orders.dispatched": on_order_dispatched,
    "orders.delivered": on_order_delivered,
    "orders.payment_recorded": on_payment_recorded,
    "dist.request_created": on_stock_request_created,
    "dist.stock_dispatched": on_stock_dispatched,
    "dist.payment_received": on_dist_payment,
    "purchase.order_created": on_purchase_order_created,
    "purchase.goods_received": on_goods_received,
    "crm.lead_converted": on_lead_converted,
    "ta.claim_paid": on_ta_claim_paid,
}


def register_all():
    from apps.foundation.integration import events

    for event_name, handler in SUBSCRIPTIONS.items():
        events.subscribe(event_name, handler)
