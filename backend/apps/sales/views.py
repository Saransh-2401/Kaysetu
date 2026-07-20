"""
SALES API — /api/sales/. Gated by HasModule('ORDERS'): these are the documents
the sales pipeline produces, so they travel with it rather than being sold
separately.

The ported screens call this prefix without a /t/ segment; tenant selection
comes from the JWT, so the prefix is cosmetic.
"""
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.foundation.permissions import HasModule

from . import services
from .models import AdjustmentNote, ManualInvoice, PaymentEntry, SalesInvoice
from .serializers import (
    AdjustmentNoteSerializer,
    ManualInvoiceSerializer,
    PaymentEntrySerializer,
    SalesInvoiceSerializer,
)

SalesModule = HasModule("ORDERS")
ACCOUNTS_ROLES = {"admin", "accounts", "accounts_officer", "sales_manager"}


def _is_accounts(user):
    return bool(user and (user.is_owner or (user.role is not None
                                            and user.role.slug in ACCOUNTS_ROLES)))


class IsAccounts(BasePermission):
    message = "Accounts access required."

    def has_permission(self, request, view):
        return _is_accounts(request.user)


class SalesPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 2000


class SalesInvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [SalesModule]
    serializer_class = SalesInvoiceSerializer
    pagination_class = SalesPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["invoice_number", "customer__name"]
    ordering_fields = ["invoice_date", "due_date", "total", "created_at"]
    ordering = ["-invoice_date"]
    # An issued invoice is a legal document: it is adjusted with a credit note,
    # never edited. Deletion is allowed only while nothing has been paid.
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        qs = SalesInvoice.objects.select_related("customer", "created_by").prefetch_related(
            "items", "items__item")
        # An agent sees invoices for THEIR customers. Without this a field agent
        # could list every invoice, customer and total in the company — the
        # sibling ManualInvoice viewset already scopes, this one did not.
        if not _is_accounts(self.request.user):
            qs = qs.filter(customer__assigned_agent_id=self.request.user.pk)
        params = self.request.query_params
        if params.get("payment_status"):
            qs = qs.filter(payment_status__in=[
                s.strip() for s in params["payment_status"].split(",") if s.strip()])
        if params.get("customer"):
            qs = qs.filter(customer_id=params["customer"])
        if params.get("invoice_date"):
            qs = qs.filter(invoice_date=params["invoice_date"])
        if params.get("from_date"):
            qs = qs.filter(invoice_date__gte=params["from_date"])
        if params.get("to_date"):
            qs = qs.filter(invoice_date__lte=params["to_date"])
        return qs

    def create(self, request, *args, **kwargs):
        if not _is_accounts(request.user):
            return Response({"detail": "Accounts access required."}, status=403)
        data = request.data
        invoice = services.create_sales_invoice(
            customer_id=data.get("customer"),
            invoice_date=data.get("invoice_date"), due_date=data.get("due_date") or None,
            items=data.get("items"),
            sales_order_id=data.get("sales_order") or data.get("sales_order_id"),
            sales_order_number=data.get("sales_order_number", ""),
            is_igst=bool(data.get("is_igst") or data.get("gstType") == "igst"),
            is_tax_inclusive=bool(data.get("is_tax_inclusive")),
            discount_type=data.get("discount_type", "amount"),
            discount_value=data.get("discount_value", 0),
            notes=data.get("notes", ""), created_by=request.user,
            invoice_number=data.get("invoice_number") or None,
        )
        return Response(SalesInvoiceSerializer(invoice).data, status=201)

    def destroy(self, request, *args, **kwargs):
        """Issuing an invoice posts it to the ledger, so it cannot be deleted.

        Deleting the document left the journal entry behind: revenue,
        receivable and output GST all stayed on the books for an invoice that
        no longer existed, and the orphan pointed at a deleted row so it could
        not even be traced. A credit note is the correct instrument — it
        reverses the ledger AND leaves the audit trail intact.
        """
        return Response(
            {"detail": "An issued invoice cannot be deleted — raise a credit note instead.",
             "code": "invoice_is_posted"},
            status=405)

    # `submit`/`approve` exist in the ported service but were never implemented
    # server-side: an invoice here is live the moment it is issued. Served as
    # idempotent no-ops so the buttons don't 404.
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return Response(SalesInvoiceSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return Response(SalesInvoiceSerializer(self.get_object()).data)


class ManualInvoiceViewSet(viewsets.ModelViewSet):
    # Raising an invoice and marking it paid are financial acts — gated like
    # every other write in this app, not merely by module entitlement.
    permission_classes = [SalesModule, IsAccounts]
    serializer_class = ManualInvoiceSerializer
    pagination_class = SalesPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["invoice_number", "customer_name"]
    ordering_fields = ["invoice_date", "grand_total", "created_at"]
    ordering = ["-invoice_date"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = ManualInvoice.objects.select_related("created_by").prefetch_related("items")
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in params["status"].split(",") if s.strip()])
        if params.get("invoice_date"):
            qs = qs.filter(invoice_date=params["invoice_date"])
        # No customer FK to scope by, so a non-accounts user sees only their own.
        if not _is_accounts(self.request.user):
            qs = qs.filter(created_by_id=self.request.user.pk)
        return qs

    def create(self, request, *args, **kwargs):
        invoice = services.create_manual_invoice(data=request.data, created_by=request.user)
        return Response(ManualInvoiceSerializer(invoice).data, status=201)

    def partial_update(self, request, *args, **kwargs):
        invoice = services.update_manual_invoice(self.get_object(), request.data)
        return Response(ManualInvoiceSerializer(invoice).data)

    def destroy(self, request, *args, **kwargs):
        if not _is_accounts(request.user):
            return Response({"detail": "Accounts access required."}, status=403)
        if self.get_object().status == ManualInvoice.Status.PAID:
            return Response({"detail": "A paid invoice cannot be deleted."}, status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def mark_as_paid(self, request, pk=None):
        invoice = services.mark_manual_paid(
            self.get_object(),
            payment_reference=request.data.get("payment_reference", ""),
            payment_date=request.data.get("payment_date") or None,
        )
        return Response({"status": "success",
                         "message": f"Invoice {invoice.invoice_number} marked as paid",
                         "invoice": ManualInvoiceSerializer(invoice).data})


class PaymentEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [SalesModule]
    serializer_class = PaymentEntrySerializer
    pagination_class = SalesPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["payment_number", "reference_no"]
    ordering_fields = ["payment_date", "amount", "created_at"]
    ordering = ["-payment_date"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = PaymentEntry.objects.select_related("sales_invoice", "sales_invoice__customer")
        if not _is_accounts(self.request.user):
            qs = qs.filter(sales_invoice__customer__assigned_agent_id=self.request.user.pk)
        params = self.request.query_params
        for field in ("status", "mode", "sales_invoice"):
            if params.get(field):
                qs = qs.filter(**{field: params[field]})
        return qs

    def create(self, request, *args, **kwargs):
        if not _is_accounts(request.user):
            return Response({"detail": "Accounts access required."}, status=403)
        data = request.data
        invoice = None
        if data.get("sales_invoice"):
            invoice = SalesInvoice.objects.filter(pk=data["sales_invoice"]).first()
            if invoice is None:
                return Response({"sales_invoice": "unknown invoice."}, status=400)
        payment = services.record_payment(
            amount=data.get("amount"), payment_date=data.get("payment_date") or None,
            sales_invoice=invoice, sales_order_id=data.get("sales_order"),
            mode=data.get("mode", "bank"), reference_no=data.get("reference_no", ""),
            company_bank_account=data.get("company_bank_account", ""),
            remarks=data.get("remarks", ""), created_by=request.user,
        )
        return Response(PaymentEntrySerializer(payment).data, status=201)

    @action(detail=True, methods=["post"], permission_classes=[SalesModule, IsAccounts])
    def mark_cleared(self, request, pk=None):
        payment = self.get_object()
        if payment.status == PaymentEntry.Status.BOUNCED:
            return Response({"detail": "A bounced payment cannot be cleared."}, status=400)
        payment.status = PaymentEntry.Status.CLEARED
        payment.save(update_fields=["status"])
        return Response({"message": "Payment marked as cleared",
                         "payment": PaymentEntrySerializer(payment).data})

    @action(detail=True, methods=["post"], permission_classes=[SalesModule, IsAccounts])
    def mark_bounced(self, request, pk=None):
        """Reverse a payment that did not clear.

        Without this a bounced cheque left the invoice PAID forever — the
        customer vanished from every receivables report while the ledger still
        carried the cash.
        """
        payment = services.reverse_payment(
            self.get_object(), reason=request.data.get("reason", ""))
        return Response({"message": "Payment reversed",
                         "payment": PaymentEntrySerializer(payment).data})


class AdjustmentNoteViewSet(viewsets.ModelViewSet):
    permission_classes = [SalesModule, IsAccounts]
    serializer_class = AdjustmentNoteSerializer
    pagination_class = SalesPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["note_number", "reason", "sales_invoice__invoice_number",
                     "manual_invoice__invoice_number"]
    ordering_fields = ["adjustment_date", "adjustment_amount", "created_at"]
    ordering = ["-adjustment_date"]
    # No PATCH: editing a note's amount after it settled an invoice would leave
    # the invoice balance out of step with the note. Raise another note.
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = AdjustmentNote.objects.select_related(
            "sales_invoice", "sales_invoice__customer", "manual_invoice")
        params = self.request.query_params
        for field in ("note_type", "status"):
            if params.get(field):
                qs = qs.filter(**{field: params[field]})
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        sales_invoice = manual_invoice = None
        if data.get("sales_invoice"):
            sales_invoice = SalesInvoice.objects.filter(pk=data["sales_invoice"]).first()
            if sales_invoice is None:
                return Response({"sales_invoice": "unknown invoice."}, status=400)
        if data.get("manual_invoice"):
            manual_invoice = ManualInvoice.objects.filter(pk=data["manual_invoice"]).first()
            if manual_invoice is None:
                return Response({"manual_invoice": "unknown invoice."}, status=400)
        note = services.create_adjustment(
            note_type=data.get("note_type"), adjustment_amount=data.get("adjustment_amount"),
            reason=data.get("reason", ""), sales_invoice=sales_invoice,
            manual_invoice=manual_invoice,
            distributor_invoice_id=data.get("stock_request_invoice"),
            created_by=request.user,
        )
        return Response(AdjustmentNoteSerializer(note).data, status=201)

    @action(detail=False, methods=["get"])
    def invoice_search(self, request):
        note_type = request.query_params.get("note_type")
        if not note_type:
            return Response({"error": "note_type is required"}, status=400)
        return Response(services.searchable_invoices(
            note_type=note_type, query=request.query_params.get("q", ""),
            limit=request.query_params.get("limit", 8),
            offset=request.query_params.get("offset", 0),
        ))
