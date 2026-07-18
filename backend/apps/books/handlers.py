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


def on_bill_issued(bill_id=None, party_id=None, total=None, subtotal=None,
                   tax_amount=None, reference="", **_):
    """purchase.bill_issued -> Dr Inventory / Dr GST Input / Cr Accounts Payable."""
    if not _books_entitled():
        return
    from . import services

    services.post_purchase_bill(
        bill_id=bill_id, party_id=party_id, total=total,
        subtotal=subtotal, tax_amount=tax_amount, reference=reference,
    )


def on_supplier_payment(payment_id=None, party_id=None, amount=None, mode=None, bill_id=None, **_):
    """purchase.payment_made -> Dr Accounts Payable / Cr Cash|Bank."""
    if not _books_entitled():
        return
    if payment_id is None:
        logger.warning("BOOKS: purchase payment without payment_id (bill %s) — not posted", bill_id)
        return
    from . import services

    out_of = "BANK" if (mode or "").lower() in _BANK_MODES else "CASH"
    services.post_supplier_payment(
        payment_id=payment_id, party_id=party_id, amount=amount, out_of=out_of,
    )


def on_distributor_invoice(invoice_id=None, party_id=None, total=None, subtotal=None,
                           tax_amount=None, reference="", **_):
    """dist.invoice_issued -> Dr Accounts Receivable / Cr Sales (distributor channel)."""
    if not _books_entitled():
        return
    from . import services

    services.post_sales_invoice(
        invoice_id=invoice_id, party_id=party_id, total=total,
        subtotal=subtotal, tax_amount=tax_amount,
        source_key="dist.invoice",   # namespaced so it can't collide with ORDERS ids
    )


def on_distributor_payment(payment_id=None, party_id=None, amount=None, mode=None,
                           invoice_id=None, **_):
    """dist.payment_received -> Dr Cash|Bank / Cr Accounts Receivable.

    Without this the receivable raised by dist.invoice_issued would never be
    cleared and distributor AR would overstate forever."""
    if not _books_entitled():
        return
    if payment_id is None:
        logger.warning("BOOKS: distributor payment without payment_id (invoice %s)", invoice_id)
        return
    from . import services

    into = "BANK" if (mode or "").lower() in _BANK_MODES else "CASH"
    services.post_customer_receipt(
        payment_id=payment_id, party_id=party_id, amount=amount, into=into,
        source_key="dist.payment",   # namespaced so it can't collide with ORDERS ids
    )


def on_ta_claim_paid(claim_id=None, user_id=None, amount=None, reference="", **_):
    """ta.claim_paid -> Dr Operating Expenses / Cr Cash (a reimbursement payout)."""
    if not _books_entitled():
        return
    if claim_id is None:
        return
    from . import services

    expense = services.account_by_key("OPERATING_EXPENSES")
    cash = services.account_by_key("CASH")
    if expense is None or cash is None:
        logger.error("BOOKS: chart missing expense/cash; TA claim %s NOT posted", claim_id)
        return
    amt = services._dec(amount, "amount")
    if amt <= 0:
        return
    services.post_journal(
        posting_date=services.timezone.localdate(),
        source=services.JournalEntry.Source.MANUAL,
        source_ref=f"ta.claim:{claim_id}",
        reference=reference,
        narration="Travel allowance reimbursement",
        lines=[
            {"account": expense, "debit": amt, "description": "Travel allowance"},
            {"account": cash, "credit": amt, "description": "Reimbursement paid"},
        ],
    )


def register_all():
    from apps.foundation.integration import events

    events.subscribe("ta.claim_paid", on_ta_claim_paid)
    events.subscribe("orders.invoice_issued", on_invoice_issued)
    events.subscribe("orders.payment_recorded", on_payment_recorded)
    events.subscribe("purchase.bill_issued", on_bill_issued)
    events.subscribe("purchase.payment_made", on_supplier_payment)
    events.subscribe("dist.invoice_issued", on_distributor_invoice)
    events.subscribe("dist.payment_received", on_distributor_payment)
