"""BOOKS API — Accounts & Finance. Gated by HasModule('BOOKS'). /api/t/books/."""
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.permissions import HasModule

from . import services
from .models import Account, JournalEntry
from .serializers import (
    AccountSerializer,
    JournalEntryCreateSerializer,
    JournalEntrySerializer,
)

from rest_framework.permissions import BasePermission

BooksModule = HasModule("BOOKS")
MANAGER_ROLES = {"admin", "accounts_officer"}


def _is_accountant(user) -> bool:
    return bool(user and (user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)))


class IsAccountant(BasePermission):
    """Books access requires the accountant/owner role.

    Gates READS as well as writes. Entitlement alone is not authorisation: with
    only the module check, every user in a BOOKS tenant — a field agent
    included — could read the general ledger, trial balance, P&L and balance
    sheet. A customer's own statement is deliberately NOT affected: that is
    served through the `books.party_ledger` capability behind the foundation
    party URL, which is scoped to one party rather than the whole company.
    """

    message = "Accounts access required."

    def has_permission(self, request, view):
        return _is_accountant(request.user)


class BooksPagination(PageNumberPagination):
    """The imported portal accounts screens fetch full pickers with page_size up
    to 1000; honour it (capped) while keeping the DRF {count,results} envelope."""

    page_size_query_param = "page_size"
    max_page_size = 2000


class AccountViewSet(viewsets.ModelViewSet):
    """Chart of Accounts."""

    # The module gate MUST be the class default, not something get_permissions()
    # adds: super().get_permissions() reads this, and without it an unentitled
    # tenant would fall through to the project default (IsAuthenticated).
    permission_classes = [BooksModule]
    serializer_class = AccountSerializer
    pagination_class = BooksPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["code", "name"]
    ordering = ["code"]

    def get_permissions(self):
        # Anyone in a BOOKS tenant may READ the chart itself — it is a list of
        # account names, and pickers elsewhere need it. Everything with money in
        # it is accountants-only: mutating the chart (renaming/deactivating a
        # system account breaks auto-posting + reports) and the per-account
        # ledger, which is the actual transaction history.
        # Starts from super() so an @action's own permission_classes survive —
        # rebuilding the list here would silently discard them.
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy", "ledger"):
            perms.append(IsAccountant())
        return perms

    def get_queryset(self):
        qs = Account.objects.all()
        params = self.request.query_params
        if params.get("account_type"):
            qs = qs.filter(account_type=params["account_type"])
        if params.get("is_group") in ("true", "false"):
            qs = qs.filter(is_group=params["is_group"] == "true")
        if params.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=params["is_active"] == "true")
        return qs

    @action(detail=True, methods=["get"], url_path="ledger")
    def ledger(self, request, pk=None):
        """General-ledger statement for one account, ?from_date & ?to_date window."""
        account = self.get_object()
        return Response(services.account_ledger(
            account,
            from_date=request.query_params.get("from_date"),
            to_date=request.query_params.get("to_date"),
        ))


class JournalEntryViewSet(viewsets.ModelViewSet):
    # Reading the general ledger is as sensitive as writing it — every sale,
    # purchase, payment and payroll line with amounts and counterparties.
    permission_classes = [BooksModule, IsAccountant]
    pagination_class = BooksPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = JournalEntry.objects.prefetch_related("lines", "lines__account", "lines__party")
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("source"):
            qs = qs.filter(source=params["source"])
        if params.get("search"):
            qs = qs.filter(number__icontains=params["search"])
        return qs

    def get_serializer_class(self):
        return JournalEntryCreateSerializer if self.action == "create" else JournalEntrySerializer

    def create(self, request, *args, **kwargs):
        if not _is_accountant(request.user):
            return Response({"detail": "Accounts access required."}, status=403)
        write = JournalEntryCreateSerializer(data=request.data)
        write.is_valid(raise_exception=True)
        try:
            entry = write.save()
        except services.PostingError as exc:
            return Response({"detail": str(exc)}, status=400)  # never surface as 500
        return Response(JournalEntrySerializer(entry).data, status=201)


class ReportsView(APIView):
    """Financial statements computed from the posted general ledger."""

    # Trial balance / P&L / balance sheet are the company's finances. Module
    # entitlement is not authorisation — these are accountants-only.
    permission_classes = [BooksModule, IsAccountant]

    def get(self, request, report):
        p = request.query_params
        if report == "trial-balance":
            return Response(services.trial_balance(as_of=p.get("to_date") or p.get("as_of_date")))
        if report == "profit-loss":
            return Response(services.profit_loss(from_date=p.get("from_date"), to_date=p.get("to_date")))
        if report == "balance-sheet":
            return Response(services.balance_sheet(as_of=p.get("as_of_date") or p.get("to_date")))
        if report == "cash-flow":
            return Response(services.cash_flow(from_date=p.get("from_date"), to_date=p.get("to_date")))
        return Response({"detail": "unknown report."}, status=404)
