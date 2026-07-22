"""Support ticket APIs.

Tenant side (`/t/support/...`): any logged-in tenant user can raise tickets,
read their org's tickets and reply. Internal notes are never exposed here.

SuperAdmin side (`/sa/support/...`): the ops team lists tickets across every
tenant, replies (public or internal), assigns and moves status.
"""
import logging

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.control.models import AdminUser, ControlAuditLog, Tenant
from apps.foundation.permissions import IsControlAdmin, IsTenantUser

from .models import SupportTicket, TicketMessage

logger = logging.getLogger("kaysetu.support")

MAX_SUBJECT = 200
MAX_BODY = 20_000


def _tenant(request) -> Tenant:
    return Tenant.objects.get(pk=request.auth["tid"])


def _message_payload(message: TicketMessage) -> dict:
    return {
        "id": message.pk,
        "author_kind": message.author_kind,
        "author_name": message.author_name,
        "is_internal": message.is_internal,
        "body": message.body,
        "created_at": message.created_at,
    }


def _ticket_payload(ticket: SupportTicket, *, messages=None, for_superadmin=False) -> dict:
    data = {
        "id": ticket.pk,
        "ticket_no": ticket.ticket_no,
        "subject": ticket.subject,
        "description": ticket.description,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "created_by_name": ticket.created_by_name,
        "created_by_email": ticket.created_by_email,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "resolved_at": ticket.resolved_at,
        "last_reply_by": ticket.last_reply_by,
        "message_count": getattr(ticket, "message_count", None),
    }
    if for_superadmin:
        data["tenant"] = {
            "org_code": ticket.tenant.org_code,
            "name": ticket.tenant.name,
            "status": ticket.tenant.status,
        }
        data["assigned_to"] = ticket.assigned_to and {
            "id": ticket.assigned_to.pk,
            "full_name": ticket.assigned_to.full_name,
            "email": ticket.assigned_to.email,
        }
    if messages is not None:
        data["messages"] = [_message_payload(m) for m in messages]
    return data


def _validate_ticket_input(data) -> tuple[dict | None, dict | None]:
    subject = str(data.get("subject") or "").strip()
    description = str(data.get("description") or "").strip()
    category = data.get("category") or SupportTicket.Category.OTHER
    priority = data.get("priority") or SupportTicket.Priority.MEDIUM
    errors = {}
    if not subject:
        errors["subject"] = "Subject is required."
    elif len(subject) > MAX_SUBJECT:
        errors["subject"] = f"Keep the subject under {MAX_SUBJECT} characters."
    if not description:
        errors["description"] = "Describe the issue so the team can act on it."
    elif len(description) > MAX_BODY:
        errors["description"] = "Description is too long."
    if category not in SupportTicket.Category.values:
        errors["category"] = "Unknown category."
    if priority not in SupportTicket.Priority.values:
        errors["priority"] = "Unknown priority."
    if errors:
        return None, errors
    return {"subject": subject, "description": description, "category": category, "priority": priority}, None


# ------------------------------------------------------------------ tenant


class TicketListCreateView(APIView):
    permission_classes = [IsTenantUser]

    def get(self, request):
        tickets = SupportTicket.objects.filter(tenant=_tenant(request)).annotate(
            message_count=Count("messages", filter=Q(messages__is_internal=False))
        )
        status_filter = request.query_params.get("status")
        if status_filter in SupportTicket.Status.values:
            tickets = tickets.filter(status=status_filter)
        return Response([_ticket_payload(t) for t in tickets[:200]])

    def post(self, request):
        clean, errors = _validate_ticket_input(request.data)
        if errors:
            return Response(errors, status=400)
        tenant = _tenant(request)
        ticket = SupportTicket.objects.create(
            tenant=tenant,
            created_by_name=getattr(request.user, "full_name", "") or "",
            created_by_email=getattr(request.user, "email", "") or "",
            last_reply_by=TicketMessage.AuthorKind.TENANT,
            **clean,
        )
        TicketMessage.objects.create(
            ticket=ticket,
            author_kind=TicketMessage.AuthorKind.TENANT,
            author_name=ticket.created_by_name,
            author_email=ticket.created_by_email,
            body=clean["description"],
        )
        logger.info("ticket %s opened by %s (%s)", ticket.ticket_no, ticket.created_by_email, tenant.org_code)
        return Response(_ticket_payload(ticket), status=201)


class TicketDetailView(APIView):
    permission_classes = [IsTenantUser]

    def get(self, request, pk: int):
        try:
            ticket = SupportTicket.objects.get(pk=pk, tenant=_tenant(request))
        except SupportTicket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=404)
        messages = ticket.messages.filter(is_internal=False)
        return Response(_ticket_payload(ticket, messages=messages))


class TicketReplyView(APIView):
    permission_classes = [IsTenantUser]

    def post(self, request, pk: int):
        try:
            ticket = SupportTicket.objects.get(pk=pk, tenant=_tenant(request))
        except SupportTicket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=404)
        body = str(request.data.get("body") or "").strip()
        if not body:
            return Response({"body": "Reply cannot be empty."}, status=400)
        if len(body) > MAX_BODY:
            return Response({"body": "Reply is too long."}, status=400)

        TicketMessage.objects.create(
            ticket=ticket,
            author_kind=TicketMessage.AuthorKind.TENANT,
            author_name=getattr(request.user, "full_name", "") or "",
            author_email=getattr(request.user, "email", "") or "",
            body=body,
        )
        # A customer reply reopens the conversation for the ops team.
        if ticket.status in (
            SupportTicket.Status.WAITING_ON_CUSTOMER,
            SupportTicket.Status.RESOLVED,
            SupportTicket.Status.CLOSED,
        ):
            ticket.status = SupportTicket.Status.IN_PROGRESS
            ticket.resolved_at = None
        ticket.last_reply_by = TicketMessage.AuthorKind.TENANT
        ticket.save()
        messages = ticket.messages.filter(is_internal=False)
        return Response(_ticket_payload(ticket, messages=messages))


class TicketCloseView(APIView):
    permission_classes = [IsTenantUser]

    def post(self, request, pk: int):
        try:
            ticket = SupportTicket.objects.get(pk=pk, tenant=_tenant(request))
        except SupportTicket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=404)
        ticket.status = SupportTicket.Status.CLOSED
        ticket.resolved_at = timezone.now()
        ticket.save()
        return Response(_ticket_payload(ticket))


# -------------------------------------------------------------- superadmin


class SaTicketListView(APIView):
    permission_classes = [IsControlAdmin]

    def get(self, request):
        tickets = SupportTicket.objects.select_related("tenant", "assigned_to").annotate(
            message_count=Count("messages")
        )
        params = request.query_params
        if params.get("status") in SupportTicket.Status.values:
            tickets = tickets.filter(status=params["status"])
        if params.get("priority") in SupportTicket.Priority.values:
            tickets = tickets.filter(priority=params["priority"])
        if params.get("tenant"):
            tickets = tickets.filter(tenant__org_code__iexact=params["tenant"])
        if params.get("q"):
            q = params["q"]
            tickets = tickets.filter(
                Q(subject__icontains=q)
                | Q(tenant__org_code__icontains=q)
                | Q(tenant__name__icontains=q)
                | Q(created_by_email__icontains=q)
            )
        return Response([_ticket_payload(t, for_superadmin=True) for t in tickets[:300]])


class SaTicketSummaryView(APIView):
    permission_classes = [IsControlAdmin]

    def get(self, request):
        counts = {status: 0 for status in SupportTicket.Status.values}
        for row in SupportTicket.objects.values("status").annotate(n=Count("id")):
            counts[row["status"]] = row["n"]
        counts["needs_attention"] = (
            counts[SupportTicket.Status.OPEN] + counts[SupportTicket.Status.IN_PROGRESS]
        )
        return Response(counts)


class SaTicketDetailView(APIView):
    permission_classes = [IsControlAdmin]

    def get(self, request, pk: int):
        try:
            ticket = SupportTicket.objects.select_related("tenant", "assigned_to").get(pk=pk)
        except SupportTicket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=404)
        return Response(_ticket_payload(ticket, messages=ticket.messages.all(), for_superadmin=True))


class SaTicketReplyView(APIView):
    permission_classes = [IsControlAdmin]

    def post(self, request, pk: int):
        try:
            ticket = SupportTicket.objects.get(pk=pk)
        except SupportTicket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=404)
        body = str(request.data.get("body") or "").strip()
        if not body:
            return Response({"body": "Reply cannot be empty."}, status=400)
        if len(body) > MAX_BODY:
            return Response({"body": "Reply is too long."}, status=400)
        is_internal = bool(request.data.get("is_internal"))

        TicketMessage.objects.create(
            ticket=ticket,
            author_kind=TicketMessage.AuthorKind.SUPERADMIN,
            author_name=getattr(request.user, "full_name", "") or "Support Team",
            author_email=getattr(request.user, "email", "") or "",
            body=body,
            is_internal=is_internal,
        )
        if not is_internal:
            ticket.status = (
                SupportTicket.Status.WAITING_ON_CUSTOMER
                if request.data.get("waiting_on_customer")
                else SupportTicket.Status.IN_PROGRESS
            )
            ticket.last_reply_by = TicketMessage.AuthorKind.SUPERADMIN
        ticket.save()
        return Response(_ticket_payload(ticket, messages=ticket.messages.all(), for_superadmin=True))


class SaTicketUpdateView(APIView):
    """Status / priority / assignee changes, audit-logged."""

    permission_classes = [IsControlAdmin]

    def post(self, request, pk: int):
        try:
            ticket = SupportTicket.objects.get(pk=pk)
        except SupportTicket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=404)

        before = {"status": ticket.status, "priority": ticket.priority,
                  "assigned_to": ticket.assigned_to_id}
        data = request.data

        if "status" in data:
            if data["status"] not in SupportTicket.Status.values:
                return Response({"status": "Unknown status."}, status=400)
            ticket.status = data["status"]
            if ticket.status in (SupportTicket.Status.RESOLVED, SupportTicket.Status.CLOSED):
                ticket.resolved_at = timezone.now()
            else:
                ticket.resolved_at = None
        if "priority" in data:
            if data["priority"] not in SupportTicket.Priority.values:
                return Response({"priority": "Unknown priority."}, status=400)
            ticket.priority = data["priority"]
        if "assigned_to_id" in data:
            if data["assigned_to_id"] in (None, "", 0):
                ticket.assigned_to = None
            else:
                admin = AdminUser.objects.filter(pk=data["assigned_to_id"], is_active=True).first()
                if admin is None:
                    return Response({"assigned_to_id": "Unknown admin user."}, status=400)
                ticket.assigned_to = admin
        ticket.save()

        ControlAuditLog.objects.create(
            action="support.ticket_updated",
            entity="SupportTicket",
            entity_id=str(ticket.pk),
            before=before,
            after={"status": ticket.status, "priority": ticket.priority,
                   "assigned_to": ticket.assigned_to_id},
        )
        return Response(_ticket_payload(ticket, messages=ticket.messages.all(), for_superadmin=True))


class SaAdminListView(APIView):
    """Assignee picker for the ops tickets screen."""

    permission_classes = [IsControlAdmin]

    def get(self, request):
        return Response(
            [
                {"id": a.pk, "full_name": a.full_name, "email": a.email}
                for a in AdminUser.objects.filter(is_active=True).order_by("full_name")
            ]
        )
