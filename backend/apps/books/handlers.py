"""
BOOKS event subscribers — auto-post the general ledger from domain events other
modules emit. Entitlement-gated so a tenant without BOOKS ignores them; each
post is idempotent (source_ref) so a replayed event never double-books. BOOKS
imports no other module — it only knows the event names + payload keys.
"""
import logging

logger = logging.getLogger("salexa.books")


def _books_entitled() -> bool:
    from apps.foundation.models import EntitlementSnapshot

    return "BOOKS" in EntitlementSnapshot.current_modules()


# Payment modes that settle to the Bank account rather than Cash.
_BANK_MODES = {"bank", "upi", "cheque", "neft", "rtgs", "card"}


def on_invoice_issued(invoice_id=None, order_id=None, party_id=None, total=None,
                      subtotal=None, tax_amount=None, **_):
    """orders.invoice_issued -> Dr AR / Cr Sales (net) / Cr GST Payable (tax)."""
    if not _books_entitled():
        return
    from . import services

    services.post_sales_invoice(
        invoice_id=invoice_id, party_id=party_id, total=total,
        subtotal=subtotal, tax_amount=tax_amount, order_id=order_id,
    )


def on_payment_recorded(order_id=None, payment_id=None, party_id=None, amount=None, mode=None, **_):
    """orders.payment_recorded -> Dr Cash/Bank / Cr Accounts Receivable."""
    if not _books_entitled():
        return
    if payment_id is None:
        # older emitters without a payment id can't be posted idempotently; skip
        logger.warning("BOOKS: payment_recorded without payment_id (order %s) — not posted", order_id)
        return
    from . import services

    into = "BANK" if (mode or "").lower() in _BANK_MODES else "CASH"
    services.post_customer_receipt(
        payment_id=payment_id, party_id=party_id, amount=amount, order_id=order_id, into=into,
    )


def register_all():
    from apps.foundation.integration import events

    events.subscribe("orders.invoice_issued", on_invoice_issued)
    events.subscribe("orders.payment_recorded", on_payment_recorded)
