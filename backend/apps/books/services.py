"""
BOOKS domain services. Every posting is a balanced double-entry (debits ==
credits), atomic on the tenant DB. Event-driven posts are idempotent on
`source_ref` so a re-emitted domain event never double-books.
"""
import logging
import secrets
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import Account, JournalEntry, JournalLine

logger = logging.getLogger("kaysetu.books")

TWO = Decimal("0.01")


class PostingError(Exception):
    """Raised when a journal would be unbalanced, empty, or reference a missing account."""


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))


def _num(prefix="JV"):
    # Full-microsecond timestamp + random suffix: distinct concurrent posts (even
    # in the same microsecond, across workers) cannot collide on the unique number.
    return f"{prefix}-{timezone.now().strftime('%y%m%d%H%M%S%f')}-{secrets.token_hex(2)}"


def _dec(value, field="amount") -> Decimal:
    try:
        return Decimal(str(value)).quantize(TWO)
    except (InvalidOperation, TypeError, ValueError):
        raise PostingError(f"invalid numeric value for {field}: {value!r}")


# --------------------------------------------------------------- chart of accounts
# (code, name, type, system_key, parent_code, is_group)
SEED_ACCOUNTS = [
    ("1000", "Assets", "asset", "", None, True),
    ("1100", "Cash", "asset", "CASH", "1000", False),
    ("1200", "Bank", "asset", "BANK", "1000", False),
    ("1300", "Accounts Receivable", "asset", "ACCOUNTS_RECEIVABLE", "1000", False),
    ("1400", "Inventory", "asset", "INVENTORY", "1000", False),
    ("1500", "GST Input Credit", "asset", "GST_INPUT", "1000", False),
    ("2000", "Liabilities", "liability", "", None, True),
    ("2100", "Accounts Payable", "liability", "ACCOUNTS_PAYABLE", "2000", False),
    ("2200", "GST Payable", "liability", "GST_OUTPUT", "2000", False),
    ("3000", "Equity", "equity", "", None, True),
    ("3100", "Retained Earnings", "equity", "RETAINED_EARNINGS", "3000", False),
    ("4000", "Income", "income", "", None, True),
    ("4100", "Sales Revenue", "income", "SALES", "4000", False),
    ("4900", "Other Income", "income", "OTHER_INCOME", "4000", False),
    ("5000", "Expenses", "expense", "", None, True),
    ("5100", "Cost of Goods Sold", "expense", "COGS", "5000", False),
    ("5200", "Operating Expenses", "expense", "OPERATING_EXPENSES", "5000", False),
]


def seed_chart_of_accounts() -> None:
    """Idempotently create the default Chart of Accounts. Safe to re-run."""
    by_code = {}
    for code, name, atype, key, _parent, is_group in SEED_ACCOUNTS:
        acc, _ = Account.objects.get_or_create(
            code=code,
            defaults={"name": name, "account_type": atype, "system_key": key, "is_group": is_group},
        )
        by_code[code] = acc
    # second pass wires parents (all rows now exist)
    for code, _name, _atype, _key, parent_code, _is_group in SEED_ACCOUNTS:
        if parent_code and by_code[code].parent_id is None:
            by_code[code].parent = by_code[parent_code]
            by_code[code].save(update_fields=["parent"])


def account_by_key(system_key):
    return Account.objects.filter(system_key=system_key, is_active=True).first()


# --------------------------------------------------------------------- posting
def post_journal(*, posting_date, lines, narration="", reference="",
                 source=JournalEntry.Source.MANUAL, source_ref="", number=None) -> JournalEntry:
    """Create a balanced, POSTED journal entry.

    `lines` = list of {account, party?, debit?, credit?, description?}; `account`
    is an Account instance. Enforces sum(debit)==sum(credit) and non-empty.
    Idempotent when `source_ref` is given — a duplicate returns the existing entry.
    """
    norm = []
    total_debit = total_credit = Decimal("0")
    for ln in lines:
        acc = ln["account"]
        if acc is None:
            raise PostingError("journal line missing account")
        debit = _dec(ln.get("debit", 0), "debit")
        credit = _dec(ln.get("credit", 0), "credit")
        if debit < 0 or credit < 0:
            raise PostingError("debit/credit cannot be negative")
        if debit > 0 and credit > 0:
            raise PostingError("a line cannot be both debit and credit")
        total_debit += debit
        total_credit += credit
        norm.append((acc, ln.get("party"), debit, credit, ln.get("description", "")))

    if total_debit == 0 and total_credit == 0:
        raise PostingError("empty journal entry")
    if (total_debit - total_credit).copy_abs() > TWO:
        raise PostingError(f"unbalanced: debit {total_debit} != credit {total_credit}")

    alias = ensure_alias(require_tenant())
    with transaction.atomic(using=alias):
        if source_ref:
            existing = JournalEntry.objects.filter(source_ref=source_ref).first()
            if existing:
                return existing
        # Each create() runs in its OWN savepoint so an IntegrityError only rolls
        # back that attempt — the outer transaction (and the connection) stay
        # usable, which matters on Postgres where a failed statement poisons the tx.
        for attempt in range(5):
            try:
                with transaction.atomic(using=alias):
                    entry = JournalEntry.objects.create(
                        number=number or _num(), posting_date=posting_date, narration=narration,
                        reference=reference, source=source, source_ref=source_ref,
                        total_debit=total_debit, total_credit=total_credit,
                        status=JournalEntry.Status.POSTED,
                    )
                    JournalLine.objects.bulk_create([
                        JournalLine(entry=entry, account=acc, party=party, debit=debit,
                                    credit=credit, description=desc)
                        for (acc, party, debit, credit, desc) in norm
                    ])
                return entry
            except IntegrityError:
                # source_ref collision -> a concurrent duplicate won: idempotent return.
                if source_ref:
                    dup = JournalEntry.objects.filter(source_ref=source_ref).first()
                    if dup:
                        return dup
                # otherwise it was a `number` collision -> retry with a fresh number
                # (only when we generated it; an explicit number can't be retried).
                if number is not None:
                    raise
                logger.warning("books journal number collision; retry %s", attempt + 1)
        raise PostingError("could not allocate a unique journal number after retries")


def post_sales_invoice(*, invoice_id, party_id, total, subtotal=None, tax_amount=None,
                       order_id=None, posting_date=None,
                       source_key="orders.invoice") -> JournalEntry | None:
    """Post an issued sales invoice to the ledger, splitting GST out of revenue:
        Dr Accounts Receivable  (grand total)
        Cr Sales Revenue        (taxable value)
        Cr GST Payable          (tax, only when > 0)
    So Sales Revenue holds NET revenue and the output-GST liability is recorded.
    Falls back to a 2-line Dr AR / Cr Sales when no tax breakup is supplied.
    Called from the orders.invoice_issued subscriber. Idempotent per invoice."""
    ar = account_by_key("ACCOUNTS_RECEIVABLE")
    sales = account_by_key("SALES")
    if ar is None or sales is None:
        logger.error("BOOKS: chart of accounts missing AR/SALES; invoice %s NOT posted", invoice_id)
        return None
    total = _dec(total, "total")
    tax = _dec(tax_amount, "tax_amount") if tax_amount is not None else Decimal("0")
    net = _dec(subtotal, "subtotal") if subtotal is not None else (total - tax)
    # guard against inconsistent inputs: net + tax must reconcile to the total
    if (net + tax - total).copy_abs() > TWO:
        net, tax = total, Decimal("0")

    lines = [
        {"account": ar, "party": _party(party_id), "debit": total, "description": "Accounts receivable"},
        {"account": sales, "credit": net, "description": "Sales revenue"},
    ]
    if tax > 0:
        gst = account_by_key("GST_OUTPUT")
        if gst is not None:
            lines.append({"account": gst, "credit": tax, "description": "Output GST"})
        else:
            # no GST account -> keep books balanced by leaving tax in revenue
            lines[1]["credit"] = total
    return post_journal(
        posting_date=posting_date or timezone.localdate(),
        source=JournalEntry.Source.SALES_INVOICE,
        # source_key namespaces the idempotency key per emitter — an ORDERS
        # invoice #5 and a DIST invoice #5 must not collide (the second would
        # otherwise be treated as a duplicate and silently skipped).
        source_ref=f"{source_key}:{invoice_id}",
        reference=f"Order {order_id}" if order_id else "",
        narration="Sales invoice",
        lines=lines,
    )


def post_customer_receipt(*, payment_id, party_id, amount, order_id=None, into="CASH",
                          posting_date=None, source_key="orders.payment") -> JournalEntry | None:
    """Dr Cash/Bank / Cr Accounts Receivable for a customer payment.
    Called from the orders.payment_recorded subscriber. Idempotent per payment."""
    ar = account_by_key("ACCOUNTS_RECEIVABLE")
    cash = account_by_key(into) or account_by_key("CASH")
    if ar is None or cash is None:
        logger.error("BOOKS: chart of accounts missing AR/CASH; payment %s NOT posted", payment_id)
        return None
    amt = _dec(amount, "amount")
    return post_journal(
        posting_date=posting_date or timezone.localdate(),
        source=JournalEntry.Source.PAYMENT,
        source_ref=f"{source_key}:{payment_id}",   # namespaced per emitter
        reference=f"Order {order_id}" if order_id else "",
        narration="Customer receipt",
        lines=[
            {"account": cash, "debit": amt, "description": "Cash/Bank received"},
            {"account": ar, "party": _party(party_id), "credit": amt, "description": "Against receivable"},
        ],
    )


def post_purchase_bill(*, bill_id, party_id, total, subtotal=None, tax_amount=None,
                       reference="", posting_date=None) -> JournalEntry | None:
    """Post a supplier bill — the buy-side mirror of post_sales_invoice:
        Dr Inventory      (taxable value)
        Dr GST Input      (recoverable input tax, only when > 0)
        Cr Accounts Payable (grand total, tagged to the supplier party)
    Called from the purchase.bill_issued subscriber. Idempotent per bill."""
    ap = account_by_key("ACCOUNTS_PAYABLE")
    inventory = account_by_key("INVENTORY")
    if ap is None or inventory is None:
        logger.error("BOOKS: chart missing AP/INVENTORY; purchase bill %s NOT posted", bill_id)
        return None
    total = _dec(total, "total")
    tax = _dec(tax_amount, "tax_amount") if tax_amount is not None else Decimal("0")
    net = _dec(subtotal, "subtotal") if subtotal is not None else (total - tax)
    if (net + tax - total).copy_abs() > TWO:
        net, tax = total, Decimal("0")

    lines = [{"account": inventory, "debit": net, "description": "Goods purchased"}]
    if tax > 0:
        gst_in = account_by_key("GST_INPUT")
        if gst_in is not None:
            lines.append({"account": gst_in, "debit": tax, "description": "Input GST credit"})
        else:
            lines[0]["debit"] = total  # no GST account -> keep it in the asset value
    lines.append({"account": ap, "party": _party(party_id), "credit": total,
                  "description": "Accounts payable"})
    return post_journal(
        posting_date=posting_date or timezone.localdate(),
        source=JournalEntry.Source.PURCHASE_BILL,
        source_ref=f"purchase.bill:{bill_id}",
        reference=reference,
        narration="Purchase bill",
        lines=lines,
    )


def post_supplier_payment(*, payment_id, party_id, amount, out_of="BANK",
                          reference="", posting_date=None) -> JournalEntry | None:
    """Dr Accounts Payable / Cr Cash|Bank for a payment made to a supplier.
    Called from the purchase.payment_made subscriber. Idempotent per payment."""
    ap = account_by_key("ACCOUNTS_PAYABLE")
    cash = account_by_key(out_of) or account_by_key("CASH")
    if ap is None or cash is None:
        logger.error("BOOKS: chart missing AP/CASH; supplier payment %s NOT posted", payment_id)
        return None
    amt = _dec(amount, "amount")
    return post_journal(
        posting_date=posting_date or timezone.localdate(),
        source=JournalEntry.Source.PAYMENT,
        source_ref=f"purchase.payment:{payment_id}",
        reference=reference,
        narration="Supplier payment",
        lines=[
            {"account": ap, "party": _party(party_id), "debit": amt, "description": "Against payable"},
            {"account": cash, "credit": amt, "description": "Cash/Bank paid"},
        ],
    )


def _party(party_id):
    if not party_id:
        return None
    from apps.foundation.models import Party

    return Party.objects.filter(pk=party_id).first()


# --------------------------------------------------------------------- ledgers
def _parse_date(value):
    from datetime import date

    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


def _statement(rows, *, from_date=None, to_date=None):
    """Shared running-balance builder for account + party statements. `rows` is a
    queryset of JournalLine ordered by (posting_date, id), each with .debit/.credit
    and a related posting_date. Balance = cumulative (debit - credit)."""
    from_date = _parse_date(from_date)
    to_date = _parse_date(to_date)

    opening = Decimal("0")
    lines = []
    running = Decimal("0")
    for r in rows:
        pdate = r.entry.posting_date
        debit = r.debit or Decimal("0")
        credit = r.credit or Decimal("0")
        delta = debit - credit
        if from_date and pdate < from_date:
            opening += delta
            continue
        if to_date and pdate > to_date:
            continue
        running = (opening if not lines else lines[-1]["_bal"]) + delta
        lines.append({
            "date": pdate.isoformat(),
            "ref": r.entry.number,
            "type": r.entry.get_source_display(),
            "description": r.description or r.entry.narration or "",
            "debit": float(debit),
            "credit": float(credit),
            "balance": float(round(running, 2)),
            "_bal": round(running, 2),
        })
    for ln in lines:
        ln.pop("_bal", None)
    closing = float(round(lines[-1]["balance"], 2)) if lines else float(round(opening, 2))
    return float(round(opening, 2)), lines, closing


def account_ledger(account, *, from_date=None, to_date=None):
    rows = (JournalLine.objects.filter(account=account, entry__status=JournalEntry.Status.POSTED)
            .select_related("entry").order_by("entry__posting_date", "id"))
    opening, lines, closing = _statement(rows, from_date=from_date, to_date=to_date)
    return {
        "account": {"id": account.id, "name": f"{account.code} - {account.name}"},
        "currency": "INR",
        "opening_balance": opening,
        "lines": lines,
        "closing_balance": closing,
    }


def party_ledger(party_id, from_date=None, to_date=None):
    """Customer/supplier statement — all posting lines tagged with this party,
    with a running balance (debit positive = they owe us)."""
    from apps.foundation.models import Party

    party = Party.objects.filter(pk=party_id).first()
    name = party.name if party else str(party_id)
    rows = (JournalLine.objects.filter(party_id=party_id, entry__status=JournalEntry.Status.POSTED)
            .select_related("entry").order_by("entry__posting_date", "id"))
    opening, lines, closing = _statement(rows, from_date=from_date, to_date=to_date)
    entity = {"id": int(party_id), "name": name}
    # one payload serves both the customer-ledger and supplier-ledger screens
    return {
        "customer": entity,
        "supplier": entity,
        "party": entity,
        "currency": "INR",
        "opening_balance": opening,
        "lines": lines,
        "closing_balance": closing,
    }


def party_balance(party_id) -> float:
    """Net outstanding for a party (sum of debit - credit across posted lines)."""
    from django.db.models import Sum

    agg = (JournalLine.objects.filter(party_id=party_id, entry__status=JournalEntry.Status.POSTED)
           .aggregate(d=Sum("debit"), c=Sum("credit")))
    return float((agg["d"] or Decimal("0")) - (agg["c"] or Decimal("0")))


# --------------------------------------------------------------------- reports
def _account_balances(*, as_of=None, since=None):
    """Return {account_id: (account, debit_sum, credit_sum)} over posted lines,
    optionally windowed by posting_date (since <= date <= as_of)."""
    from django.db.models import Sum

    qs = JournalLine.objects.filter(entry__status=JournalEntry.Status.POSTED)
    as_of = _parse_date(as_of)
    since = _parse_date(since)
    if as_of:
        qs = qs.filter(entry__posting_date__lte=as_of)
    if since:
        qs = qs.filter(entry__posting_date__gte=since)
    agg = qs.values("account").annotate(d=Sum("debit"), c=Sum("credit"))
    out = {}
    accounts = {a.id: a for a in Account.objects.all()}
    for row in agg:
        acc = accounts.get(row["account"])
        if acc:
            out[acc.id] = (acc, row["d"] or Decimal("0"), row["c"] or Decimal("0"))
    return out


def trial_balance(as_of=None):
    balances = _account_balances(as_of=as_of)
    rows, total_d, total_c = [], Decimal("0"), Decimal("0")
    for acc, d, c in sorted(balances.values(), key=lambda t: t[0].code):
        net = d - c
        debit = net if net > 0 else Decimal("0")
        credit = -net if net < 0 else Decimal("0")
        total_d += debit
        total_c += credit
        rows.append({
            "account_id": acc.id, "code": acc.code, "name": acc.name,
            "account_type": acc.account_type,
            "debit": float(round(debit, 2)), "credit": float(round(credit, 2)),
        })
    return {
        "as_of_date": (_parse_date(as_of).isoformat() if _parse_date(as_of) else None),
        "rows": rows,
        "total_debit": float(round(total_d, 2)),
        "total_credit": float(round(total_c, 2)),
        "balanced": (total_d - total_c).copy_abs() <= TWO,
    }


def _sum_type(balances, account_type, *, credit_positive=False):
    total = Decimal("0")
    for acc, d, c in balances.values():
        if acc.account_type == account_type:
            total += (c - d) if credit_positive else (d - c)
    return total


def _key_balance(balances, system_key, *, credit_positive=False):
    for acc, d, c in balances.values():
        if acc.system_key == system_key:
            return (c - d) if credit_positive else (d - c)
    return Decimal("0")


def profit_loss(from_date=None, to_date=None):
    balances = _account_balances(since=from_date, as_of=to_date)
    sales = _key_balance(balances, "SALES", credit_positive=True)
    other = _key_balance(balances, "OTHER_INCOME", credit_positive=True)
    total_income = _sum_type(balances, Account.Type.INCOME, credit_positive=True)
    cogs = _key_balance(balances, "COGS")
    total_expenses = _sum_type(balances, Account.Type.EXPENSE)
    gross = total_income - cogs
    net = total_income - total_expenses
    margin = float(round((net / total_income * 100), 2)) if total_income else 0.0
    return {
        "period": {"from_date": _parse_date(from_date).isoformat() if _parse_date(from_date) else None,
                   "to_date": _parse_date(to_date).isoformat() if _parse_date(to_date) else None},
        "income": {"sales_revenue": float(round(sales, 2)), "other_income": float(round(other, 2)),
                   "total_income": float(round(total_income, 2))},
        "expenses": {"cost_of_goods_sold": float(round(cogs, 2)),
                     "operating_expenses": float(round(total_expenses - cogs, 2)),
                     "total_expenses": float(round(total_expenses, 2))},
        "profit": {"gross_profit": float(round(gross, 2)), "net_profit": float(round(net, 2)),
                   "net_profit_margin": margin},
    }


def balance_sheet(as_of=None):
    balances = _account_balances(as_of=as_of)
    ar = _key_balance(balances, "ACCOUNTS_RECEIVABLE")
    cash = _key_balance(balances, "CASH") + _key_balance(balances, "BANK")
    inventory = _key_balance(balances, "INVENTORY")
    total_assets = _sum_type(balances, Account.Type.ASSET)
    ap = _key_balance(balances, "ACCOUNTS_PAYABLE", credit_positive=True)
    total_liabilities = _sum_type(balances, Account.Type.LIABILITY, credit_positive=True)
    equity_booked = _sum_type(balances, Account.Type.EQUITY, credit_positive=True)
    # net income to date rolls into equity (retained earnings) on the balance sheet
    net_income = _sum_type(balances, Account.Type.INCOME, credit_positive=True) \
        - _sum_type(balances, Account.Type.EXPENSE)
    total_equity = equity_booked + net_income
    lpe = total_liabilities + total_equity
    return {
        "as_of_date": _parse_date(as_of).isoformat() if _parse_date(as_of) else None,
        "assets": {"accounts_receivable": float(round(ar, 2)), "cash_and_bank": float(round(cash, 2)),
                   "inventory": float(round(inventory, 2)), "total_assets": float(round(total_assets, 2))},
        "liabilities": {"accounts_payable": float(round(ap, 2)),
                        "total_liabilities": float(round(total_liabilities, 2))},
        # retained_earnings = current net income; contributed/opening equity is the
        # remainder of total_equity. Keeps assets == liabilities + total_equity.
        "equity": {"retained_earnings": float(round(net_income, 2)),
                   "contributed_equity": float(round(equity_booked, 2)),
                   "total_equity": float(round(total_equity, 2))},
        "balance_check": {"assets": float(round(total_assets, 2)),
                          "liabilities_plus_equity": float(round(lpe, 2)),
                          "balanced": (total_assets - lpe).copy_abs() <= TWO},
    }


def cash_flow(from_date=None, to_date=None):
    """Direct-method operating cash flow from the CASH/BANK movements tagged to
    receipts (from customers) and payments (to suppliers)."""
    from django.db.models import Sum

    qs = JournalLine.objects.filter(
        entry__status=JournalEntry.Status.POSTED,
        account__system_key__in=["CASH", "BANK"],
    ).select_related("entry")
    fd, td = _parse_date(from_date), _parse_date(to_date)
    if fd:
        qs = qs.filter(entry__posting_date__gte=fd)
    if td:
        qs = qs.filter(entry__posting_date__lte=td)
    from_customers = qs.filter(entry__source=JournalEntry.Source.PAYMENT).aggregate(s=Sum("debit"))["s"] or Decimal("0")
    to_suppliers = qs.filter(entry__source=JournalEntry.Source.PURCHASE_BILL).aggregate(s=Sum("credit"))["s"] or Decimal("0")
    net = from_customers - to_suppliers
    return {
        "period": {"from_date": fd.isoformat() if fd else None, "to_date": td.isoformat() if td else None},
        "operating_activities": {
            "cash_from_customers": float(round(from_customers, 2)),
            "cash_to_suppliers": float(round(to_suppliers, 2)),
            "net_cash_from_operations": float(round(net, 2)),
        },
    }
