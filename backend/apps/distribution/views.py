"""DIST API — Distribution Network. Gated by HasModule('DIST'). /api/t/dist/."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.foundation.models import CatalogItem
from apps.foundation.permissions import HasModule

from . import services
from .models import (
    DistributorAdjustment,
    DistributorInvoice,
    DistributorStock,
    StockRequest,
    StockRequestShortage,
)
from .serializers import (
    DistributorAdjustmentSerializer,
    DistributorInvoiceSerializer,
    DistributorStockSerializer,
    StockRequestSerializer,
    StockRequestShortageSerializer,
)

DistModule = HasModule("DIST")
# Company-side roles that run distribution. `sales_agent` is included because a
# distributor typically supplies several organisations and never signs in here,
# so the agent who owns that relationship drives the whole order lifecycle —
# raise, approve, dispatch, invoice — exactly as the previous platform worked.
# An agent is NOT org-wide though: see _agent_scoped_qs below.
MANAGER_ROLES = {"admin", "sales_manager", "distributor_manager"}
AGENT_ROLES = {"sales_agent"}
DISTRIBUTOR_ROLE = "distributor"


def _role_slug(user):
    return getattr(getattr(user, "role", None), "slug", None)


def _is_agent(user) -> bool:
    """A sales agent acts company-side, but only over their OWN distributors."""
    return bool(user and not getattr(user, "is_owner", False) and _role_slug(user) in AGENT_ROLES)


def _is_manager(user) -> bool:
    """Anyone allowed to run distribution operations (org-wide or agent-scoped)."""
    if user is None:
        return False
    return bool(user.is_owner or _role_slug(user) in MANAGER_ROLES or _is_agent(user))


def _own_party_id(user):
    """The Party this login acts for, if any. Scoping keys off THIS rather than a
    role name — a custom role (or no role) must not silently see every
    distributor's commercial data."""
    if user is None or _is_manager(user):
        return None
    return getattr(user, "party_id", None) or None


def _scope_to_own_party(qs, user, field="distributor_id"):
    """Narrow a queryset to what this login may see.

    Three cases:
      * org-wide manager      -> everything
      * sales agent           -> only distributors assigned to them
      * distributor / other   -> only their own Party
    """
    if _is_agent(user):
        return qs.filter(**{f"{field.replace('_id', '')}__assigned_agent": user.pk})
    own = _own_party_id(user)
    return qs.filter(**{field: own}) if own else qs


def _agent_may_act_on(user, distributor_id) -> bool:
    """Can this login operate on that distributor? Managers: always.

    Checked on WRITES as well as reads — a scoped list is not a permission, and
    an agent could otherwise approve or invoice another agent's distributor by
    posting its id directly.
    """
    if not _is_agent(user):
        return True
    if not distributor_id:
        return False
    from apps.foundation.models import Party

    return Party.objects.filter(pk=distributor_id, assigned_agent_id=user.pk).exists()


class IsDistManager(BasePermission):
    """Approving / dispatching / invoicing is a company-side action."""

    message = "Distribution manager access required."

    def has_permission(self, request, view):
        return _is_manager(request.user)

    def has_object_permission(self, request, view, obj):
        """A sales agent may only act on distributors assigned to them.

        Filtering the LIST is not enough: an agent knows other ids and could
        approve or invoice someone else's distributor by posting straight at the
        detail route. Every @action reaches the object through get_object(),
        which runs this check.
        """
        if not _is_agent(request.user):
            return True
        distributor_id = (
            getattr(obj, "distributor_id", None)
            # Invoices hang off the request, not the distributor, directly.
            or getattr(getattr(obj, "request", None), "distributor_id", None)
        )
        allowed = _agent_may_act_on(request.user, distributor_id)
        if not allowed:
            self.message = "That distributor is not assigned to you."
        return allowed


class DistPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 2000


class StockRequestViewSet(viewsets.ModelViewSet):
    serializer_class = StockRequestSerializer
    pagination_class = DistPagination
    http_method_names = ["get", "post", "head", "options"]

    permission_classes = [DistModule]

    # Company-side actions that do NOT declare their own permission_classes.
    MANAGER_ACTIONS = {"approve", "reject", "dispatch_stock", "mark_delivered", "invoice"}

    def get_permissions(self):
        # Starts from super() so an @action's own permission_classes survive.
        # This list used to be rebuilt from scratch, and every alias added later
        # (cancel, generate_invoice, delete_invoice, mark_packed,
        # mark_in_transit, update_payment_status) silently lost its
        # IsDistManager gate — a distributor could invoice and cancel at will.
        perms = super().get_permissions()
        if self.action in self.MANAGER_ACTIONS:
            perms.append(IsDistManager())
        return perms

    def get_queryset(self):
        qs = (StockRequest.objects.select_related("distributor")
              .prefetch_related("items", "logs"))
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in params["status"].split(",") if s.strip()])
        if params.get("payment_status"):
            qs = qs.filter(payment_status=params["payment_status"])
        if params.get("distributor"):
            qs = qs.filter(distributor_id=params["distributor"])
        return _scope_to_own_party(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        distributor_id = request.data.get("distributor")
        own = _own_party_id(request.user)
        if own:
            distributor_id = own          # a party-linked user can only request for themselves
        elif not _agent_may_act_on(request.user, distributor_id):
            # A sales agent raises requests FOR their own distributors — this is
            # the normal path now, since distributors supply several
            # organisations and never sign in here.
            return Response({"detail": "That distributor is not assigned to you."}, status=403)
        req = services.create_stock_request(
            distributor_id=distributor_id,
            items=request.data.get("items", []),
            notes=request.data.get("notes", ""),
        )
        return Response(StockRequestSerializer(req).data, status=201)

    def _fresh(self):
        """Re-read after a service call: the object from get_object() carries a
        prefetch cache of its items, which a service that rewrote those rows
        would leave stale in the response."""
        return Response(StockRequestSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], permission_classes=[DistModule, IsDistManager])
    def approve(self, request, pk=None):
        services.approve_request(
            self.get_object(), actor=request.user, allocations=request.data.get("allocations"),
        )
        return self._fresh()

    @action(detail=True, methods=["post"], permission_classes=[DistModule, IsDistManager])
    def reject(self, request, pk=None):
        services.reject_request(self.get_object(), reason=request.data.get("reason", ""),
                                actor=request.user)
        return self._fresh()

    # NOTE: the method must NOT be called `dispatch` — that would shadow
    # ViewSet.dispatch(), the framework's own request dispatcher.
    @action(detail=True, methods=["post"], url_path="dispatch",
            permission_classes=[DistModule, IsDistManager])
    def dispatch_stock(self, request, pk=None):
        services.dispatch_request(self.get_object(), actor=request.user)
        return self._fresh()

    @action(detail=True, methods=["post"], url_path="mark-delivered",
            permission_classes=[DistModule, IsDistManager])
    def mark_delivered(self, request, pk=None):
        services.mark_delivered(self.get_object(), actor=request.user)
        return self._fresh()

    @action(detail=True, methods=["post"], permission_classes=[DistModule, IsDistManager])
    def invoice(self, request, pk=None):
        inv = services.issue_invoice(
            self.get_object(),
            invoice_date=request.data.get("invoice_date") or None,
            due_date=request.data.get("due_date") or None,
        )
        return Response(DistributorInvoiceSerializer(inv).data, status=201)

    # --- aliases for the imported portal, which uses the Old Project's action
    # names (snake_case, and "in transit"/"cancel" for dispatch/reject) ---
    @action(detail=True, methods=["post"], url_path="mark_in_transit",
            permission_classes=[DistModule, IsDistManager])
    def mark_in_transit(self, request, pk=None):
        return self.dispatch_stock(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="mark_delivered",
            permission_classes=[DistModule, IsDistManager])
    def mark_delivered_alias(self, request, pk=None):
        return self.mark_delivered(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="generate_invoice",
            permission_classes=[DistModule, IsDistManager])
    def generate_invoice(self, request, pk=None):
        return self.invoice(request, pk=pk)

    @action(detail=True, methods=["post"], permission_classes=[DistModule, IsDistManager])
    def cancel(self, request, pk=None):
        return self.reject(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="mark_packed",
            permission_classes=[DistModule, IsDistManager])
    def mark_packed(self, request, pk=None):
        services.mark_packed(self.get_object(), actor=request.user)
        return self._fresh()

    @action(detail=True, methods=["get"], url_path="check_inventory")
    def check_inventory(self, request, pk=None):
        """What the company can actually supply against this request right now."""
        return Response(services.check_inventory(self.get_object()))

    @action(detail=True, methods=["post"], url_path="update_payment_status",
            permission_classes=[DistModule, IsDistManager])
    def update_payment_status(self, request, pk=None):
        req = self.get_object()
        target = request.data.get("payment_status")
        valid = {c for c, _ in StockRequest.PaymentStatus.choices}
        if target not in valid:
            return Response({"detail": f"payment_status must be one of {sorted(valid)}."},
                            status=400)
        req.payment_status = target
        req.save(update_fields=["payment_status", "updated_at"])
        return self._fresh()

    # POST (not DELETE) — that is the verb the imported portal uses.
    @action(detail=True, methods=["post"], url_path="delete_invoice",
            permission_classes=[DistModule, IsDistManager])
    def delete_invoice(self, request, pk=None):
        """Void an unpaid invoice so a corrected one can be raised."""
        req = self.get_object()
        invoices = req.invoices.all()
        invoice_id = request.data.get("invoice_id")
        invoice = (invoices.filter(pk=invoice_id).first() if invoice_id else invoices.first())
        if invoice is None:
            return Response({"detail": "This request has no such invoice."}, status=404)
        if (invoice.paid_amount or 0) > 0:
            return Response({"detail": "A part-paid invoice cannot be deleted."}, status=400)
        invoice.delete()
        req.payment_status = StockRequest.PaymentStatus.UNPAID
        req.save(update_fields=["payment_status", "updated_at"])
        return self._fresh()


class DistributorInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [DistModule]
    serializer_class = DistributorInvoiceSerializer
    pagination_class = DistPagination

    def get_queryset(self):
        qs = DistributorInvoice.objects.select_related("distributor", "request")
        params = self.request.query_params
        status_filter = params.get("payment_status") or params.get("status")
        if status_filter:
            qs = qs.filter(status__in=[s.strip() for s in status_filter.split(",") if s.strip()])
        if params.get("distributor"):
            qs = qs.filter(distributor_id=params["distributor"])
        return _scope_to_own_party(qs, self.request.user)

    @action(detail=False, methods=["get"], url_path="my_invoices")
    def my_invoices(self, request):
        """Portal alias: a distributor's own invoices (get_queryset already
        scopes a party-linked login to their own rows)."""
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        serializer = DistributorInvoiceSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"], url_path="mark_paid",
            permission_classes=[DistModule, IsDistManager])
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        amount = request.data.get("amount")
        if amount is None:   # portal's mark_paid settles the whole invoice
            amount = (invoice.total_amount or 0) - (invoice.paid_amount or 0)
        services.record_invoice_payment(
            invoice, amount=amount, mode=request.data.get("mode", "bank"),
            reference=request.data.get("payment_reference", ""),
        )
        return Response(DistributorInvoiceSerializer(self.get_object()).data)


class StockRequestShortageViewSet(viewsets.ReadOnlyModelViewSet):
    """Back-orders: the part of a request the company could not supply.

    Each has its own lifecycle (usually through production) and ships separately,
    so unmet distributor demand is tracked rather than dropped at approval.
    """

    serializer_class = StockRequestShortageSerializer
    pagination_class = DistPagination

    _ACTION_TARGETS = {
        "start_production": StockRequestShortage.Status.IN_PRODUCTION,
        "complete_production": StockRequestShortage.Status.COMPLETED,
        "mark_packed": StockRequestShortage.Status.PACKED,
        "mark_in_transit": StockRequestShortage.Status.IN_TRANSIT,
        "mark_delivered": StockRequestShortage.Status.DELIVERED,
    }

    def get_permissions(self):
        if self.action in (set(self._ACTION_TARGETS) | {"generate_invoice", "mark_paid",
                                                        "batch_pack", "batch_ship",
                                                        "batch_deliver"}):
            return [DistModule(), IsDistManager()]
        return [DistModule()]

    def get_queryset(self):
        qs = StockRequestShortage.objects.select_related("request", "request__distributor", "item")
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in params["status"].split(",") if s.strip()])
        if params.get("distributor"):
            qs = qs.filter(request__distributor_id=params["distributor"])
        return _scope_to_own_party(qs, self.request.user, field="request__distributor_id")

    def _advance(self, target, plan_id=None):
        shortage = services.set_shortage_status(
            self.get_object(), target, production_plan_id=plan_id, actor=self.request.user,
        )
        return Response(StockRequestShortageSerializer(shortage).data)

    @action(detail=True, methods=["post"], url_path="start_production")
    def start_production(self, request, pk=None):
        return self._advance(StockRequestShortage.Status.IN_PRODUCTION,
                             plan_id=request.data.get("production_plan_id"))

    @action(detail=True, methods=["post"], url_path="complete_production")
    def complete_production(self, request, pk=None):
        return self._advance(StockRequestShortage.Status.COMPLETED)

    @action(detail=True, methods=["post"], url_path="mark_packed")
    def mark_packed(self, request, pk=None):
        return self._advance(StockRequestShortage.Status.PACKED)

    @action(detail=True, methods=["post"], url_path="mark_in_transit")
    def mark_in_transit(self, request, pk=None):
        return self._advance(StockRequestShortage.Status.IN_TRANSIT)

    @action(detail=True, methods=["post"], url_path="mark_delivered")
    def mark_delivered(self, request, pk=None):
        return self._advance(StockRequestShortage.Status.DELIVERED)

    @action(detail=True, methods=["post"], url_path="generate_invoice")
    def generate_invoice(self, request, pk=None):
        shortage = self.get_object()
        shortage.payment_status = StockRequestShortage.PaymentStatus.INVOICED
        shortage.save(update_fields=["payment_status", "updated_at"])
        return Response(StockRequestShortageSerializer(shortage).data)

    @action(detail=True, methods=["post"], url_path="mark_paid")
    def mark_paid(self, request, pk=None):
        shortage = self.get_object()
        shortage.payment_status = StockRequestShortage.PaymentStatus.PAID
        shortage.save(update_fields=["payment_status", "updated_at"])
        return Response(StockRequestShortageSerializer(shortage).data)

    def _batch(self, request, target):
        ids = request.data.get("ids") or []
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list."}, status=400)
        done, failed = [], []
        for shortage in self.get_queryset().filter(pk__in=ids):
            try:
                services.set_shortage_status(shortage, target, actor=request.user)
                done.append(shortage.pk)
            except Exception as exc:  # a bad row must not abort the whole batch
                failed.append({"id": shortage.pk, "error": str(exc)})
        return Response({"updated": done, "failed": failed})

    @action(detail=False, methods=["post"], url_path="batch_pack")
    def batch_pack(self, request):
        return self._batch(request, StockRequestShortage.Status.PACKED)

    @action(detail=False, methods=["post"], url_path="batch_ship")
    def batch_ship(self, request):
        return self._batch(request, StockRequestShortage.Status.IN_TRANSIT)

    @action(detail=False, methods=["post"], url_path="batch_deliver")
    def batch_deliver(self, request):
        return self._batch(request, StockRequestShortage.Status.DELIVERED)


class DistributorAdjustmentViewSet(viewsets.ModelViewSet):
    """Manual corrections to a distributor's own holding (damage/return/audit)."""

    serializer_class = DistributorAdjustmentSerializer
    pagination_class = DistPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action == "create":
            return [DistModule(), IsDistManager()]
        return [DistModule()]

    def get_queryset(self):
        qs = DistributorAdjustment.objects.select_related("distributor", "item", "created_by")
        params = self.request.query_params
        if params.get("distributor"):
            qs = qs.filter(distributor_id=params["distributor"])
        if params.get("item"):
            qs = qs.filter(item_id=params["item"])
        return _scope_to_own_party(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        adj = services.adjust_distributor_stock(
            distributor_id=request.data.get("distributor"),
            item_id=request.data.get("item"),
            quantity=request.data.get("quantity"),
            reason=request.data.get("reason", "other"),
            notes=request.data.get("notes", ""),
            actor=request.user,
        )
        return Response(DistributorAdjustmentSerializer(adj).data, status=201)


class DistributorStockViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [DistModule]
    serializer_class = DistributorStockSerializer
    pagination_class = DistPagination

    def get_queryset(self):
        qs = DistributorStock.objects.select_related("distributor", "item")
        params = self.request.query_params
        if params.get("distributor"):
            qs = qs.filter(distributor_id=params["distributor"])
        if params.get("item"):
            qs = qs.filter(item_id=params["item"])
        return _scope_to_own_party(qs, self.request.user)

    @action(detail=False, methods=["get"])
    def products(self, request):
        """The orderable catalogue, annotated with what this distributor already
        holds. Every active item appears — a distributor must be able to request
        something they have never stocked, so this is NOT a view over their
        existing stock rows.
        """
        distributor_id = request.query_params.get("distributor_id")
        if not distributor_id:
            party = getattr(request.user, "party_id", None)
            distributor_id = party
        held = {
            row.item_id: row for row in DistributorStock.objects.filter(distributor_id=distributor_id)
        } if distributor_id else {}
        rows = []
        for item in CatalogItem.objects.filter(is_active=True, kind=CatalogItem.Kind.PRODUCT):
            stock = held.get(item.pk)
            rows.append({
                "id": item.pk, "product_name": item.name, "name": item.name,
                "sku": item.code, "unit": item.unit,
                "price": str(item.price), "tax_rate": str(item.tax_rate),
                "hsn_code": item.hsn_sac,
                "quantity": str(stock.on_hand) if stock else "0",
                "on_hand": str(stock.on_hand) if stock else "0",
            })
        return Response(rows)
