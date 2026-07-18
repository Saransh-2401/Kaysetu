"""TA API — Travel Allowance. Gated by HasModule("TA"). /api/t/ta/."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.foundation.permissions import HasModule

from . import services
from .models import AllowanceClaim, PolicyConfig, Trip
from .serializers import AllowanceClaimSerializer, PolicyConfigSerializer, TripSerializer

TaModule = HasModule("TA")
MANAGER_ROLES = {"admin", "sales_manager", "field_manager", "hr_manager"}
FINANCE_ROLES = {"admin", "accounts_officer"}


def _has_role(user, roles) -> bool:
    return bool(user and (user.is_owner or (user.role is not None and user.role.slug in roles)))


class IsTaManager(BasePermission):
    message = "Manager access required."

    def has_permission(self, request, view):
        return _has_role(request.user, MANAGER_ROLES)


class IsFinance(BasePermission):
    message = "Finance access required."

    def has_permission(self, request, view):
        return _has_role(request.user, FINANCE_ROLES)


class TaPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 2000


def _scope(qs, user, field="agent_id"):
    """An agent sees only their own trips/claims; managers and finance see all."""
    if _has_role(user, MANAGER_ROLES | FINANCE_ROLES):
        return qs
    return qs.filter(**{field: user.pk})


class PolicyConfigViewSet(viewsets.ModelViewSet):
    serializer_class = PolicyConfigSerializer
    pagination_class = TaPagination
    queryset = PolicyConfig.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [TaModule(), IsTaManager()]
        return [TaModule()]


class TripViewSet(viewsets.ModelViewSet):
    permission_classes = [TaModule]
    serializer_class = TripSerializer
    pagination_class = TaPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = Trip.objects.select_related("agent", "claim")
        params = self.request.query_params
        if params.get("agent"):
            qs = qs.filter(agent_id=params["agent"])
        if params.get("from_date"):
            qs = qs.filter(date__gte=params["from_date"])
        if params.get("to_date"):
            qs = qs.filter(date__lte=params["to_date"])
        return _scope(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        trip = services.record_trip(
            request.user,                       # always your own trip
            date=request.data.get("date"),
            distance_km=request.data.get("distance_km"),
            transport_mode=request.data.get("transport_mode", PolicyConfig.Vehicle.BIKE),
            notes=request.data.get("notes", ""),
        )
        return Response(TripSerializer(trip).data, status=201)


class AllowanceClaimViewSet(viewsets.ModelViewSet):
    serializer_class = AllowanceClaimSerializer
    pagination_class = TaPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action in ("manager_approve", "reject"):
            return [TaModule(), IsTaManager()]
        if self.action in ("finance_approve", "mark_paid"):
            return [TaModule(), IsFinance()]
        return [TaModule()]

    def get_queryset(self):
        qs = AllowanceClaim.objects.select_related("agent").prefetch_related("trips")
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status__in=[s.strip() for s in params["status"].split(",") if s.strip()])
        if params.get("agent"):
            qs = qs.filter(agent_id=params["agent"])
        return _scope(qs, self.request.user)

    def _fresh(self):
        return Response(AllowanceClaimSerializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        claim = services.build_claim(
            request.user,                       # always your own claim
            period_start=request.data.get("period_start"),
            period_end=request.data.get("period_end"),
            city=request.data.get("city", ""),
        )
        return Response(AllowanceClaimSerializer(claim).data, status=201)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        claim = self.get_object()
        if claim.agent_id != request.user.pk and not _has_role(request.user, MANAGER_ROLES):
            return Response({"detail": "You can only submit your own claim."}, status=403)
        services.submit_claim(claim, actor=request.user)
        return self._fresh()

    @action(detail=True, methods=["post"], url_path="manager-approve")
    def manager_approve(self, request, pk=None):
        services.manager_approve(self.get_object(), actor=request.user,
                                 note=request.data.get("note", ""))
        return self._fresh()

    @action(detail=True, methods=["post"], url_path="finance-approve")
    def finance_approve(self, request, pk=None):
        services.finance_approve(self.get_object(), actor=request.user,
                                 note=request.data.get("note", ""),
                                 approved_amount=request.data.get("approved_amount"))
        return self._fresh()

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        services.mark_paid(self.get_object(), actor=request.user,
                           reference=request.data.get("payment_reference", ""))
        return self._fresh()

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        note = request.data.get("note", "")
        if not note:
            return Response({"detail": "A reason is required."}, status=400)
        services.reject_claim(self.get_object(), actor=request.user, note=note)
        return self._fresh()

    # --- aliases for the imported portal, which uses the Old Project's
    # snake_case action names ---
    @action(detail=True, methods=["post"], url_path="manager_approve",
            permission_classes=[TaModule, IsTaManager])
    def manager_approve_alias(self, request, pk=None):
        return self.manager_approve(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="finance_approve",
            permission_classes=[TaModule, IsFinance])
    def finance_approve_alias(self, request, pk=None):
        return self.finance_approve(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="record_payment",
            permission_classes=[TaModule, IsFinance])
    def record_payment(self, request, pk=None):
        return self.mark_paid(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="manager_reject",
            permission_classes=[TaModule, IsTaManager])
    def manager_reject(self, request, pk=None):
        return self.reject(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="finance_reject",
            permission_classes=[TaModule, IsFinance])
    def finance_reject(self, request, pk=None):
        return self.reject(request, pk=pk)
