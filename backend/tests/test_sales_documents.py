"""SALES: the customer-facing document layer — invoices, payments, credit notes.

Headline: every money figure is computed server-side from quantity/rate/tax.
The previous platform stored whatever totals the browser sent, so a buggy or
tampered client could book an invoice whose parts didn't add up — and the ledger
inherited it.
"""
import pytest
from django.utils import timezone

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _party(api, token, name="Retail Mart"):
    return auth(api, token).post("/api/t/parties/", {"name": name, "kind": "customer"}).data["id"]


def _item(api, token, name="Soap", price="100", tax="18"):
    return auth(api, token).post("/api/t/catalog/", {
        "name": name, "price": price, "tax_rate": tax}).data["id"]


def _invoice(client, party, item, **overrides):
    body = {
        "customer": party, "invoice_date": str(timezone.localdate()),
        "items": [{"item": item, "quantity": 10, "rate": "100", "tax_rate": "18"}],
    }
    body.update(overrides)
    return client.post("/api/sales/invoices/", body)


# ------------------------------------------------------------- THE HEADLINE
def test_totals_are_computed_server_side_not_taken_from_the_client(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)

    created = _invoice(client, party, item,
                       subtotal="1", tax_amount="1", total="1")   # all lies
    assert created.status_code == 201
    data = created.data
    assert str(data["subtotal"]) == "1000.00"      # 10 x 100, recomputed
    assert str(data["tax_amount"]) == "180.00"     # 18%
    assert str(data["total"]) == "1180.00"
    assert str(data["outstanding_amount"]) == "1180.00"
    assert data["payment_status"] == "unpaid"

    # the GST halves re-sum to the tax exactly (computing each as tax/2 loses a
    # paisa on odd amounts, and an invoice that doesn't add up is a filing bug)
    line = data["items"][0]
    assert str(line["cgst_amount"]) == "90.00" and str(line["sgst_amount"]) == "90.00"
    assert str(line["igst_amount"]) == "0.00"


def test_igst_puts_the_whole_tax_in_one_component(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)

    data = _invoice(client, party, item, is_igst=True).data
    assert str(data["igst_amount"]) == "180.00"
    assert str(data["cgst_amount"]) == "0.00" and str(data["sgst_amount"]) == "0.00"
    assert str(data["total"]) == "1180.00"


def test_tax_inclusive_pricing_backs_the_tax_out(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)

    data = _invoice(client, party, item, is_tax_inclusive=True).data
    # 1000 gross at 18% inclusive -> 847.46 taxable + 152.54 tax
    assert str(data["subtotal"]) == "847.46"
    assert str(data["tax_amount"]) == "152.54"
    assert str(data["total"]) == "1000.00"         # the customer still pays 1000


def test_discount_reduces_the_taxable_value_and_still_posts_gst(api, make_tenant, tenant_token):
    """A discount shown on the invoice reduces the VALUE OF SUPPLY, so GST is
    charged on the discounted amount.

    Discounting the tax-inclusive total instead charged GST on money the
    customer was never billed — and left subtotal + tax != total, which made
    BOOKS refuse the breakdown and drop the output-GST line entirely. Every
    discounted invoice silently under-declared its GST liability.
    """
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)

    ten_pct = _invoice(client, party, item,
                       discount_type="percentage", discount_value="10").data
    assert str(ten_pct["discount_amount"]) == "100.00"     # 10% of the 1000 taxable
    assert str(ten_pct["subtotal"]) == "900.00"            # taxable value, post-discount
    assert str(ten_pct["tax_amount"]) == "162.00"          # 18% of 900, not of 1000
    assert str(ten_pct["total"]) == "1062.00"
    # the parts must re-sum to the whole, or the ledger cannot split GST out
    assert (float(ten_pct["subtotal"]) + float(ten_pct["tax_amount"])
            == float(ten_pct["total"]))
    # ...and the per-line split follows the discounted value
    line = ten_pct["items"][0]
    assert str(line["taxable_value"]) == "900.00"
    assert str(line["cgst_amount"]) == "81.00" and str(line["sgst_amount"]) == "81.00"

    # THE POINT: the GST liability actually reaches the ledger
    with use_tenant(tenant):
        from apps.books.models import JournalEntry

        entry = JournalEntry.objects.get(source_ref=f"sales.invoice:{ten_pct['id']}")
        posted = {line.account.system_key: str(line.debit or line.credit)
                  for line in entry.lines.all()}
        assert posted["ACCOUNTS_RECEIVABLE"] == "1062.00"
        assert posted["SALES"] == "900.00"
        assert posted["GST_OUTPUT"] == "162.00"     # was silently missing entirely

    assert _invoice(client, party, item, discount_value="99999").status_code == 400
    assert _invoice(client, party, item,
                    discount_type="percentage", discount_value="150").status_code == 400


def test_payments_settle_the_invoice_and_cannot_overpay(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    invoice = _invoice(client, party, item).data

    part = client.post("/api/sales/payments/", {
        "sales_invoice": invoice["id"], "amount": "180", "mode": "bank_transfer"})
    assert part.status_code == 201
    # the portal's 'bank_transfer' is normalised — an unknown mode would post to
    # Cash in the ledger instead of Bank
    assert part.data["mode"] == "bank"

    after = client.get(f"/api/sales/invoices/{invoice['id']}/").data
    assert str(after["paid_amount"]) == "180.00"
    assert str(after["outstanding_amount"]) == "1000.00"
    assert after["payment_status"] == "partially_paid"

    # paying more than is owed is refused
    assert client.post("/api/sales/payments/", {
        "sales_invoice": invoice["id"], "amount": "99999"}).status_code == 400

    client.post("/api/sales/payments/", {"sales_invoice": invoice["id"], "amount": "1000"})
    assert client.get(
        f"/api/sales/invoices/{invoice['id']}/").data["payment_status"] == "paid"


def test_one_invoice_per_sales_order(api, make_tenant, tenant_token):
    """Invoicing an order twice would double-bill AND double-post the ledger."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)

    assert _invoice(client, party, item, sales_order=42).status_code == 201
    assert _invoice(client, party, item, sales_order=42).status_code == 400


def test_credit_note_reduces_the_balance_and_hits_the_ledger(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    invoice = _invoice(client, party, item).data

    note = client.post("/api/sales/adjustments/", {
        "note_type": "credit", "sales_invoice": invoice["id"],
        "adjustment_amount": "180", "reason": "Damaged in transit"})
    assert note.status_code == 201
    assert note.data["invoice_number"] == invoice["invoice_number"]
    assert note.data["customer_name"] == "Retail Mart"

    after = client.get(f"/api/sales/invoices/{invoice['id']}/").data
    assert str(after["outstanding_amount"]) == "1000.00"
    # A credit note reduces what is OWED. It is not a receipt, so it must not
    # move paid_amount or make the invoice look partly collected — that reported
    # cash that never arrived.
    assert str(after["paid_amount"]) == "0.00"
    assert after["payment_status"] == "unpaid"
    assert str(after["adjustment_total"]) == "-180.00"

    # ...and the ledger agrees. Without this the screen would say the customer
    # owes less while the accounts still said they owed the full amount.
    with use_tenant(tenant):
        from apps.books.models import JournalEntry

        entry = JournalEntry.objects.filter(source_ref__startswith="sales.adjustment:").first()
        assert entry is not None
        assert sorted(str(line.debit) for line in entry.lines.all()) == ["0.00", "180.00"]

    # a note larger than the invoice is refused...
    assert client.post("/api/sales/adjustments/", {
        "note_type": "credit", "sales_invoice": invoice["id"],
        "adjustment_amount": "99999", "reason": "x"}).status_code == 400
    # ...and so is one that only exceeds it CUMULATIVELY. Bounding each note
    # against the total in isolation let N full-value notes through, each
    # crediting the ledger, while the invoice screen clamped at zero and showed
    # nothing wrong.
    assert client.post("/api/sales/adjustments/", {
        "note_type": "credit", "sales_invoice": invoice["id"],
        "adjustment_amount": "1000", "reason": "the rest"}).status_code == 201
    refused = client.post("/api/sales/adjustments/", {
        "note_type": "credit", "sales_invoice": invoice["id"],
        "adjustment_amount": "1", "reason": "one rupee too far"})
    assert refused.status_code == 400
    assert "already credited" in str(refused.data)


def test_invoice_search_only_offers_unadjusted_invoices(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    first = _invoice(client, party, item).data
    _invoice(client, party, item, sales_order=7)

    found = client.get("/api/sales/adjustments/invoice_search/?note_type=credit").data
    assert found["count"] == 2 and found["has_more"] is False

    client.post("/api/sales/adjustments/", {
        "note_type": "credit", "sales_invoice": first["id"],
        "adjustment_amount": "10", "reason": "short delivery"})
    found = client.get("/api/sales/adjustments/invoice_search/?note_type=credit").data
    assert found["count"] == 1                      # the adjusted one drops out
    assert found["results"][0]["id"] != first["id"]

    assert client.get("/api/sales/adjustments/invoice_search/").status_code == 400


def test_manual_invoice_is_computed_and_marked_paid(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    created = client.post("/api/sales/manual-invoices/", {
        "invoice_number": "MAN-001", "customer_name": "Walk-in Buyer",
        "invoice_date": str(timezone.localdate()), "tax_type": "cgst_sgst",
        "is_tax_inclusive": False, "grand_total": "1",     # ignored
        "items": [{"item_name": "Consulting", "quantity": 2, "unit_price": "500",
                   "tax_percentage": "18"}],
    })
    assert created.status_code == 201
    assert str(created.data["subtotal"]) == "1000.00"
    assert str(created.data["tax_amount"]) == "180.00"
    assert str(created.data["cgst_amount"]) == "90.00"
    assert str(created.data["grand_total"]) == "1180.00"

    mid = created.data["id"]
    # a duplicate number is refused rather than shadowing the first invoice
    assert client.post("/api/sales/manual-invoices/", {
        "invoice_number": "MAN-001", "customer_name": "X",
        "items": [{"item_name": "a", "quantity": 1, "unit_price": "1"}]}).status_code == 400

    # editing the lines re-derives the totals (and does NOT read a stale cache)
    edited = client.patch(f"/api/sales/manual-invoices/{mid}/", {
        "items": [{"item_name": "Consulting", "quantity": 1, "unit_price": "500",
                   "tax_percentage": "18"}]}).data
    assert len(edited["items"]) == 1 and str(edited["grand_total"]) == "590.00"

    assert client.post(f"/api/sales/manual-invoices/{mid}/mark_as_paid/", {}).status_code == 400
    paid = client.post(f"/api/sales/manual-invoices/{mid}/mark_as_paid/",
                       {"payment_reference": "UPI-77"}).data
    assert paid["invoice"]["status"] == "paid" and paid["invoice"]["payment_date"]
    # a paid invoice is frozen
    assert client.patch(f"/api/sales/manual-invoices/{mid}/",
                        {"customer_name": "Someone Else"}).status_code == 400


def test_sales_documents_are_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")   # TRACK only — no ORDERS
    token = tenant_token(tenant)["access"]
    for path in ("/api/sales/invoices/", "/api/sales/manual-invoices/",
                 "/api/sales/payments/", "/api/sales/adjustments/"):
        assert auth(api, token).get(path).status_code == 403, path


def test_issued_invoices_cannot_be_edited_or_quietly_deleted(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    invoice = _invoice(client, party, item).data

    # an issued invoice is a legal document: adjust it, don't edit it
    assert client.patch(f"/api/sales/invoices/{invoice['id']}/",
                        {"total": "1"}).status_code == 405

    # ...and it cannot be DELETED either, even untouched. Issuing it posted
    # Dr AR / Cr Sales / Cr GST; deleting the document left that journal entry
    # behind, so revenue, receivable and GST all stayed on the books for an
    # invoice that no longer existed — and the orphan pointed at a deleted row.
    refused = client.delete(f"/api/sales/invoices/{invoice['id']}/")
    assert refused.status_code == 405
    assert refused.data["code"] == "invoice_is_posted"

    with use_tenant(tenant):
        from apps.books.models import JournalEntry
        from apps.sales.models import SalesInvoice

        assert SalesInvoice.objects.filter(pk=invoice["id"]).exists()
        assert JournalEntry.objects.filter(
            source_ref=f"sales.invoice:{invoice['id']}").exists()


def test_a_bounced_payment_reverses_the_invoice_and_the_ledger(api, make_tenant, tenant_token):
    """Without a reversal a bounced cheque leaves the invoice PAID forever —
    the customer drops off every receivables report while the ledger still
    carries cash the company never received."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    party, item = _party(api, token), _item(api, token)
    invoice = _invoice(client, party, item).data

    payment = client.post("/api/sales/payments/", {
        "sales_invoice": invoice["id"], "amount": "1180",
        "mode": "cheque", "reference_no": "CHQ-99"}).data
    assert client.get(
        f"/api/sales/invoices/{invoice['id']}/").data["payment_status"] == "paid"

    bounced = client.post(f"/api/sales/payments/{payment['id']}/mark_bounced/",
                          {"reason": "insufficient funds"})
    assert bounced.status_code == 200 and bounced.data["payment"]["status"] == "bounced"

    after = client.get(f"/api/sales/invoices/{invoice['id']}/").data
    assert str(after["paid_amount"]) == "0.00"
    assert str(after["outstanding_amount"]) == "1180.00"
    assert after["payment_status"] == "unpaid"

    # the ledger is corrected by a COMPENSATING entry, not by editing the
    # original — the bounce has to stay visible
    with use_tenant(tenant):
        from apps.books.models import JournalEntry

        assert JournalEntry.objects.filter(
            source_ref=f"sales.payment:{payment['id']}").exists()
        reversal = JournalEntry.objects.get(
            source_ref=f"sales.payment_reversed:{payment['id']}")
        posted = {line.account.system_key: str(line.debit or line.credit)
                  for line in reversal.lines.all()}
        assert posted["ACCOUNTS_RECEIVABLE"] == "1180.00"   # owed again
        assert posted["BANK"] == "1180.00"                  # cash out again

    # reversing twice would double-credit the bank
    assert client.post(
        f"/api/sales/payments/{payment['id']}/mark_bounced/", {}).status_code == 400
