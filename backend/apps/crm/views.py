"""CRM API — Leads & Pipeline. Gated by HasModule('CRM'). Mounted /api/t/crm/."""
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.foundation.models import TenantUser
from apps.foundation.permissions import HasModule

from . import services
from .models import Lead
from .serializers import LeadSerializer

CrmModule = HasModule("CRM")
MANAGER_ROLES = {"admin", "field_manager", "sales_manager"}


def _is_manager(user) -> bool:
    return user.is_owner or (user.role is not None and user.role.slug in MANAGER_ROLES)


def _is_admin(user) -> bool:
    return user.is_owner or (user.role is not None and user.role.slug == "admin")


def _visible_agent_ids(user):
    if _is_admin(user):
        return None
    if _is_manager(user):
        team = set(TenantUser.objects.filter(reports_to_id=user.pk).values_list("pk", flat=True))
        team.add(user.pk)
        return team
    return {user.pk}


class LeadViewSet(viewsets.ModelViewSet):
    permission_classes = [CrmModule]
    serializer_class = LeadSerializer

    def get_queryset(self):
        qs = Lead.objects.select_related("party", "assigned_to").prefetch_related("activities")
        visible = _visible_agent_ids(self.request.user)
        if visible is not None:
            # agents/managers see their own + team's leads, plus unassigned.
            qs = qs.filter(assigned_to_id__in=list(visible) + [None])
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("assigned_to"):
            qs = qs.filter(assigned_to_id=params["assigned_to"])
        if params.get("source"):
            qs = qs.filter(source=params["source"])
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        if not data.get("name"):
            return Response({"detail": "name required."}, status=400)
        assigned_to_id = data.get("assigned_to")
        # A plain agent may only create leads assigned to themselves.
        if assigned_to_id and not _is_manager(request.user) and int(assigned_to_id) != request.user.pk:
            return Response({"detail": "Agents can only create their own leads."}, status=403)
        if not assigned_to_id and not _is_manager(request.user):
            assigned_to_id = request.user.pk
        lead = services.create_lead(
            actor=request.user, name=data["name"], phone=data.get("phone", ""),
            email=data.get("email", ""), company_name=data.get("company_name", ""),
            source=data.get("source", ""), assigned_to_id=assigned_to_id,
            industry=data.get("industry", ""), territory=data.get("territory", ""),
            employee_count=data.get("employee_count"), notes=data.get("notes", ""),
            follow_up_date=data.get("follow_up_date"),
            line1=data.get("address_line1", data.get("line1", "")),
            line2=data.get("address_line2", data.get("line2", "")),
            city=data.get("city", ""), state=data.get("state", ""),
            postal_code=data.get("postal_code", ""),
            latitude=data.get("latitude"), longitude=data.get("longitude"),
        )
        return Response(LeadSerializer(lead).data, status=201)

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        lead = self.get_object()
        services.convert_lead(lead, actor=request.user)
        return Response(LeadSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        lead = self.get_object()
        status = request.data.get("status")
        if status not in Lead.Status.values:
            return Response({"detail": "invalid status."}, status=400)
        services.change_status(lead, status, actor=request.user)
        return Response(LeadSerializer(lead).data)

    @action(detail=False, methods=["get"])
    def funnel(self, request):
        qs = self.get_queryset()
        counts = {row["status"]: row["n"] for row in qs.values("status").annotate(n=Count("id"))}
        return Response({"total": sum(counts.values()), "by_status": counts})
