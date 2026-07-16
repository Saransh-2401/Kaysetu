"""
BOOKS module — Accounts & Finance. Lives in EACH TENANT'S database.

Double-entry bookkeeping ported from the Old Project `accounts` app and made
tenant-native + decoupled: the general ledger is a set of balanced JournalEntry
rows; party sub-ledgers (customer/supplier statements) are JournalLine rows
tagged with a foundation.Party. Imports ONLY foundation.

BOOKS is the finance authority other modules reach ONLY via capabilities/events:
ORDERS auto-posts a sales journal on invoice + a receipt on payment by emitting
events BOOKS subscribes to (no import either way); foundation's party-ledger URL
asks BOOKS for the data via a capability and degrades to empty when un-entitled.
"""
from django.db import models


class Account(models.Model):
    """A node in the Chart of Accounts (a ledger account or a group header)."""

    class Type(models.TextChoices):
        ASSET = "asset", "Asset"
        LIABILITY = "liability", "Liability"
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"
        EQUITY = "equity", "Equity"

    code = models.CharField(max_length=50, unique=True, db_index=True)   # portal: account_number
    name = models.CharField(max_length=200)                             # portal: account_name
    account_type = models.CharField(max_length=20, choices=Type.choices)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    is_group = models.BooleanField(default=False)                       # header account (no direct postings)
    is_active = models.BooleanField(default=True)
    # Stable handle for auto-posting targets (ACCOUNTS_RECEIVABLE, SALES, CASH, ...)
    # so event handlers never depend on names/codes the tenant may rename.
    system_key = models.CharField(max_length=40, blank=True, db_index=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Debit-normal (asset/expense) vs credit-normal (liability/income/equity):
    # the sign a positive balance takes for this account's natural side.
    _DEBIT_NORMAL = {Type.ASSET, Type.EXPENSE}

    class Meta:
        ordering = ["code"]
        indexes = [models.Index(fields=["account_type", "is_active"])]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def is_debit_normal(self) -> bool:
        return self.account_type in self._DEBIT_NORMAL


class JournalEntry(models.Model):
    """A balanced posting: total_debit MUST equal total_credit across its lines."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        POSTED = "posted", "Posted"

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        SALES_INVOICE = "sales_invoice", "Sales Invoice"
        PAYMENT = "payment", "Payment Received"
        PURCHASE_BILL = "purchase_bill", "Purchase Bill"
        OPENING = "opening", "Opening Balance"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    posting_date = models.DateField()
    narration = models.TextField(blank=True)
    reference = models.CharField(max_length=100, blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    # Idempotency key for event-driven posts (e.g. "orders.invoice:42"); blank for
    # manual entries. A partial unique constraint makes a re-emitted event a no-op.
    source_ref = models.CharField(max_length=100, blank=True, db_index=True)
    total_debit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_credit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.POSTED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-posting_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["source_ref"], condition=~models.Q(source_ref=""),
                name="uniq_books_source_ref",
            ),
        ]
        indexes = [
            models.Index(fields=["-posting_date"]),
            models.Index(fields=["source", "source_ref"]),
        ]

    def __str__(self):
        return f"{self.number} ({self.posting_date})"


class JournalLine(models.Model):
    """One debit or credit against an account. `party` tags receivable/payable
    lines so a customer/supplier statement can be computed from the ledger."""

    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="lines")
    party = models.ForeignKey(
        "foundation.Party", null=True, blank=True, on_delete=models.PROTECT, related_name="journal_lines"
    )
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["account", "id"]),
            models.Index(fields=["party", "id"]),
        ]
