"""
FIELD API — Field Sales Operations. All gated by HasModule('FIELD').
Mounted under /api/t/field/.
"""
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.models import TenantUser
from apps.foundation.permissions import HasModule

from . import services
from .models import Collection, FieldOrder, SalesCityTarget, SalesTarget, Visit
from .serializers import (
    CollectionSerializer, FieldOrderSerializer, SalesTargetSerializer, VisitSerializer,
)

FieldModule = HasModule("FIELD")
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


class VisitViewSet(viewsets.ModelViewSet):
    permission_classes = [FieldModule]
    serializer_class = VisitSerializer

    def get_queryset(self):
        qs = Visit.objects.select_related("agent", "party").prefetch_related("images")
        visible = _visible_agent_ids(self.request.user)
        if visible is not None:
            qs = qs.filter(agent_id__in=visible)
        params = self.request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("agent"):
            qs = qs.filter(agent_id=params["agent"])
        if params.get("party"):
            qs = qs.filter(party_id=params["party"])
        if params.get("visit_date"):
            qs = qs.filter(visit_date=params["visit_date"])
        if params.get("visit_date__gte"):
            qs = qs.filter(visit_date__gte=params["visit_date__gte"])
        if params.get("visit_date__lte"):
            qs = qs.filter(visit_date__lte=params["visit_date__lte"])
        return qs

    def perform_create(self, serializer):
        # Agents book against themselves; managers may assign — but only within
        # their own team (an admin's visible set is None = unrestricted).
        agent = serializer.validated_data.get("agent")
        if agent is None or not _is_manager(self.request.user):
            serializer.save(agent=self.request.user)
            return
        visible = _visible_agent_ids(self.request.user)
        if visible is not None and agent.pk not in visible:
            raise PermissionDenied("Cannot assign a visit to an agent outside your team.")
        serializer.save()

    def perform_update(self, serializer):
        # A non-manager cannot reassign their own visit to someone else.
        if not _is_manager(self.request.user):
            serializer.save(agent=self.request.user)
        else:
            serializer.save()

    def create(self, request, *args, **kwargs):
        client_uuid = request.data.get("client_uuid")
        if client_uuid:
            existing = Visit.objects.filter(client_uuid=client_uuid, agent=request.user).first()
            if existing:
                return Response(VisitSerializer(existing).data, status=200)
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            # Lost the idempotency race — return the winning row, not a 500.
            if client_uuid:
                existing = Visit.objects.filter(client_uuid=client_uuid).first()
                if existing:
                    return Response(VisitSerializer(existing).data, status=200)
            raise

    @action(detail=False, methods=["get"], url_path="check-pending")
    def check_pending(self, request):
        party_id = request.query_params.get("party_id")
        if not party_id:
            return Response({"detail": "party_id required."}, status=400)
        visit = Visit.objects.filter(
            party_id=party_id, status__in=[Visit.Status.SCHEDULED, Visit.Status.IN_PROGRESS]
        ).first()
        return Response({
            "has_pending_visit": visit is not None,
            "visit": VisitSerializer(visit).data if visit else None,
        })

    @action(detail=True, methods=["post"])
    def checkin(self, request, pk=None):
        visit = self.get_object()
        if visit.status == Visit.Status.IN_PROGRESS:
            return Response({"message": "Already checked in", "status": visit.status})
        loc = request.data.get("location") or request.data
        services.check_in_visit(
            visit,
            lat=loc.get("latitude", loc.get("lat")),
            lng=loc.get("longitude", loc.get("lng")),
            address=loc.get("address", ""),
            selfie_url=request.data.get("selfie_url", ""),
        )
        return Response(VisitSerializer(visit).data)

    @action(detail=True, methods=["post"])
    def checkout(self, request, pk=None):
        visit = self.get_object()
        if visit.status != Visit.Status.IN_PROGRESS:
            return Response({"detail": "Visit is not checked in."}, status=400)
        loc = request.data.get("location") or request.data
        services.check_out_visit(
            visit,
            lat=loc.get("latitude", loc.get("lat")),
            lng=loc.get("longitude", loc.get("lng")),
            address=loc.get("address", ""),
            notes=request.data.get("notes", ""),
            outcome=request.data.get("outcome", ""),
        )
        return Response(VisitSerializer(visit).data)

    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        visit = self.get_object()
        reason = request.data.get("reason")
        if not reason:
            return Response({"detail": "reason required."}, status=400)
        if visit.status == Visit.Status.COMPLETED:
            return Response({"detail": "Visit already completed."}, status=400)
        visit.status = Visit.Status.SKIPPED
        visit.skip_reason = reason
        visit.save()
        return Response(VisitSerializer(visit).data)

    @action(detail=True, methods=["post"])
    def reschedule(self, request, pk=None):
        visit = self.get_object()
        data = request.data
        if not (data.get("reason") and data.get("visit_date") and data.get("scheduled_time")):
            return Response({"detail": "reason, visit_date, scheduled_time required."}, status=400)
        # Only an open visit can be rescheduled — a rescheduled/skipped/completed
        # one cannot, so a retry can't keep minting new visits.
        if visit.status not in (Visit.Status.SCHEDULED, Visit.Status.IN_PROGRESS):
            return Response({"detail": "Only a scheduled or in-progress visit can be rescheduled."}, status=400)
        visit.status = Visit.Status.RESCHEDULED
        visit.reschedule_reason = data["reason"]
        visit.rescheduled_to = data["visit_date"]
        visit.rescheduled_time = data["scheduled_time"]
        visit.save()
        new_visit = Visit.objects.create(
            agent=visit.agent, party=visit.party,
            visit_date=data["visit_date"], scheduled_time=data["scheduled_time"],
            visit_type=visit.visit_type, purpose=visit.purpose,
            notes=f"Rescheduled from #{visit.pk}",
        )
        return Response({
            "original_visit": VisitSerializer(visit).data,
            "new_visit": VisitSerializer(new_visit).data,
        })


class SalesTargetViewSet(viewsets.ModelViewSet):
    permission_classes = [FieldModule]
    serializer_class = SalesTargetSerializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Agents may only READ targets (and use the gated default/bulk-assign
        # actions); the standard write verbs are manager-only to prevent
        # tampering with the performance denominators.
        if self.action in {"create", "update", "partial_update", "destroy"} and not _is_manager(request.user):
            self.permission_denied(request, message="Manager access required.")

    def get_queryset(self):
        qs = SalesTarget.objects.prefetch_related("city_targets")
        if not _is_manager(self.request.user):
            qs = qs.filter(agent_id__in=[self.request.user.pk, None])
        params = self.request.query_params
        if params.get("agent"):
            qs = qs.filter(agent_id=params["agent"])
        if params.get("month"):
            qs = qs.filter(month=params["month"])
        if params.get("year"):
            qs = qs.filter(year=params["year"])
        return qs

    @action(detail=False, methods=["get", "post"])
    def default(self, request):
        if request.method == "GET":
            target = SalesTarget.objects.filter(is_default=True).first()
            if target is None:
                return Response({"detail": "No baseline target."}, status=404)
            return Response(SalesTargetSerializer(target).data)
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)
        target, _ = SalesTarget.objects.get_or_create(is_default=True)
        serializer = SalesTargetSerializer(target, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(is_default=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def performance(self, request):
        agent_id = request.query_params.get("agent")
        if not agent_id:
            return Response({"detail": "agent required."}, status=400)
        try:
            agent_id = int(agent_id)
        except (TypeError, ValueError):
            return Response({"detail": "agent must be numeric."}, status=400)
        visible = _visible_agent_ids(request.user)
        if visible is not None and agent_id not in visible:
            return Response({"detail": "Not found."}, status=404)
        now = timezone.localdate()
        month = int(request.query_params.get("month", now.month))
        year = int(request.query_params.get("year", now.year))
        return Response(services.target_performance(agent_id, month, year))

    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request):
        if not _is_manager(request.user):
            return Response({"detail": "Manager access required."}, status=403)
        data = request.data
        agent_ids = data.get("agent_ids") or []
        month, year = data.get("month"), data.get("year")
        if not agent_ids or not month or not year:
            return Response({"detail": "agent_ids, month, year required."}, status=400)
        # A non-admin manager may only assign to their own team.
        visible = _visible_agent_ids(request.user)
        if visible is not None and any(int(a) not in visible for a in agent_ids):
            return Response({"detail": "Cannot assign targets to agents outside your team."}, status=403)
        fields = {
            k: data.get(k, 0) for k in [
                "visit_target", "order_target", "stock_request_target", "revenue_target",
                "stock_request_revenue_target", "new_client_target", "login_hours_target",
            ]
        }
        created = updated = 0
        for agent_id in agent_ids:
            target, was_created = SalesTarget.objects.update_or_create(
                agent_id=agent_id, month=month, year=year, is_default=False,
                defaults={**fields, "pincodes": data.get("pincodes", [])},
            )
            created += was_created
            updated += not was_created
            if "city_targets" in data:
                target.city_targets.all().delete()
                for ct in data["city_targets"]:
                    SalesCityTarget.objects.create(target=target, **ct)
        return Response({"created": created, "updated": updated})


class FieldOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [FieldModule]
    serializer_class = FieldOrderSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = FieldOrder.objects.select_related("agent", "party").prefetch_related("items")
        visible = _visible_agent_ids(self.request.user)
        if visible is not None:
            qs = qs.filter(agent_id__in=visible)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        party_id = data.get("party")
        items = data.get("items") or []
        if not party_id or not items:
            return Response({"detail": "party and at least one item required."}, status=400)
        order = services.book_order(
            request.user, party_id=party_id,
            order_date=data.get("order_date") or timezone.localdate(),
            items=items, notes=data.get("notes", ""), client_uuid=data.get("client_uuid", ""),
        )
        return Response(FieldOrderSerializer(order).data, status=201)


class CollectionViewSet(viewsets.ModelViewSet):
    permission_classes = [FieldModule]
    serializer_class = CollectionSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = Collection.objects.select_related("agent", "party")
        visible = _visible_agent_ids(self.request.user)
        if visible is not None:
            qs = qs.filter(agent_id__in=visible)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        if not data.get("party") or data.get("amount") is None:
            return Response({"detail": "party and amount required."}, status=400)
        collection = services.record_collection(
            request.user, party_id=data["party"], amount=data["amount"],
            mode=data.get("mode", "cash"), reference=data.get("reference", ""),
            against_invoice=data.get("against_invoice", ""), client_uuid=data.get("client_uuid", ""),
        )
        return Response(CollectionSerializer(collection).data, status=201)
