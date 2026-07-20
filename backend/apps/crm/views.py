"""CRM API — Leads & Pipeline. Gated by HasModule('CRM'). Mounted /api/t/crm/."""
from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.foundation.models import Party, TenantUser
from apps.foundation.permissions import HasModule

from . import services
from .models import Lead, Quotation
from .serializers import LeadSerializer, QuotationSerializer

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
            # (Django strips None from __in, so the isnull branch is required.)
            qs = qs.filter(Q(assigned_to_id__in=visible) | Q(assigned_to__isnull=True))
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
        if assigned_to_id is not None and assigned_to_id != "":
            try:
                assigned_to_id = int(assigned_to_id)
            except (TypeError, ValueError):
                return Response({"detail": "assigned_to must be numeric."}, status=400)
            visible = _visible_agent_ids(request.user)
            if not _is_manager(request.user) and assigned_to_id != request.user.pk:
                return Response({"detail": "Agents can only create their own leads."}, status=403)
            if visible is not None and assigned_to_id not in visible:
                return Response({"detail": "Cannot assign a lead outside your team."}, status=403)
            if not TenantUser.objects.filter(pk=assigned_to_id).exists():
                return Response({"detail": "assigned_to user not found."}, status=400)
        else:
            assigned_to_id = None if _is_manager(request.user) else request.user.pk
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

    def perform_update(self, serializer):
        # Same rule as create(): a plain agent may not reassign a lead to
        # anyone but themselves (nor unassign it). Managers/admins may reassign.
        if not _is_manager(self.request.user):
            new = serializer.validated_data.get("assigned_to", serializer.instance.assigned_to)
            new_id = new.pk if new is not None else None
            if new_id != self.request.user.pk:
                raise PermissionDenied("Agents can only assign leads to themselves.")
        serializer.save()

    def perform_destroy(self, instance):
        # Clean up the backing prospect party (never a converted customer, and
        # only if no other lead references it) so deletes don't orphan parties.
        party = instance.party
        super().perform_destroy(instance)
        if party and party.kind == Party.Kind.PROSPECT and not party.leads.exists():
            party.delete()

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


class QuotationViewSet(viewsets.ModelViewSet):
    """Quotations. Gated by HasModule('CRM') like the rest of the pipeline."""

    permission_classes = [CrmModule]
    serializer_class = QuotationSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Quotation.objects.select_related("party", "owner", "lead").prefetch_related(
            "items", "items__item")
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("customer") or params.get("party"):
            qs = qs.filter(party_id=params.get("customer") or params.get("party"))
        # Same visibility rule as leads: an agent sees what they own, a manager
        # sees their team, an admin sees everything.
        visible = _visible_agent_ids(self.request.user)
        return qs if visible is None else qs.filter(owner_id__in=visible)

    def create(self, request, *args, **kwargs):
        data = request.data
        lead = None
        if data.get("lead"):
            lead = Lead.objects.filter(pk=data["lead"]).first()
        quotation = services.create_quotation(
            party_id=data.get("party") or data.get("customer"),
            items=data.get("items"), quotation_date=data.get("quotation_date") or None,
            valid_until=data.get("valid_until") or None, lead=lead,
            terms_and_conditions=data.get("terms_and_conditions", ""),
            notes=data.get("notes", ""), owner=request.user,
        )
        return Response(QuotationSerializer(quotation).data, status=201)

    def _move(self, request, target, reason=""):
        quotation = services.set_quotation_status(
            self.get_object(), target, reason=reason, actor=request.user)
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._move(request, Quotation.Status.SUBMITTED)

    @action(detail=True, methods=["post"])
    def mark_won(self, request, pk=None):
        """Winning a quotation converts the lead behind it — otherwise the
        pipeline shows a won deal still sitting in 'interested'."""
        return self._move(request, Quotation.Status.WON)

    @action(detail=True, methods=["post"])
    def mark_lost(self, request, pk=None):
        return self._move(request, Quotation.Status.LOST,
                          reason=request.data.get("reason", "") or request.data.get("notes", ""))
