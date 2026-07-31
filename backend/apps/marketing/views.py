"""Lead capture (public) + the ops team's lead queue.

The public endpoint is the only unauthenticated *write* on the platform besides
signup, so it is deliberately defensive: throttled, honeypot-trapped, and it
never echoes back anything an attacker could use to enumerate.
"""
import logging

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.control.models import AdminUser, ControlAuditLog, Tenant
from apps.foundation.permissions import IsControlAdmin

from .models import Lead, LeadNote

logger = logging.getLogger("kaysetu.marketing")

MAX_MESSAGE = 5000
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024  # matches the "up to 5MB" hint on the form
ALLOWED_ATTACHMENT_TYPES = {"image/png", "image/jpeg", "application/pdf"}


def _client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _lead_payload(lead: Lead, *, notes=None) -> dict:
    data = {
        "id": lead.pk,
        "reference": lead.reference,
        "name": lead.name,
        "email": lead.email,
        "phone": lead.phone,
        "company": lead.company,
        "message": lead.message,
        "attachment_url": lead.attachment_url,
        "source": lead.source,
        "status": lead.status,
        "utm_source": lead.utm_source,
        "utm_medium": lead.utm_medium,
        "utm_campaign": lead.utm_campaign,
        "page_url": lead.page_url,
        "referrer": lead.referrer,
        "ip_address": lead.ip_address,
        "created_at": lead.created_at,
        "updated_at": lead.updated_at,
        "contacted_at": lead.contacted_at,
        "note_count": getattr(lead, "note_count", None),
        "assigned_to": lead.assigned_to and {
            "id": lead.assigned_to.pk,
            "full_name": lead.assigned_to.full_name,
            "email": lead.assigned_to.email,
        },
        "converted_tenant": lead.converted_tenant and {
            "id": lead.converted_tenant.pk,
            "org_code": lead.converted_tenant.org_code,
            "name": lead.converted_tenant.name,
        },
    }
    if notes is not None:
        data["notes"] = [
            {
                "id": n.pk,
                "author_name": n.author_name,
                "body": n.body,
                "created_at": n.created_at,
            }
            for n in notes
        ]
    return data


class PublicLeadView(APIView):
    """POST from the marketing site (kaysetu.in). Unauthenticated by design."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "leads"
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        data = request.data

        # Honeypot: a field hidden from humans via CSS. Anything filling it in
        # is a bot. Return 201 so the bot believes it worked and does not retry
        # with a different technique — but store nothing.
        if str(data.get("website") or data.get("fax") or "").strip():
            logger.info("lead honeypot tripped from %s", _client_ip(request))
            return Response({"status": "received"}, status=201)

        name = str(data.get("name") or "").strip()
        email = str(data.get("email") or "").strip().lower()
        errors = {}
        if not name:
            errors["name"] = "Please tell us your name."
        if not email or "@" not in email:
            errors["email"] = "A valid email address is required."
        message = str(data.get("message") or "").strip()
        if len(message) > MAX_MESSAGE:
            errors["message"] = "Message is too long."
        source = data.get("source") or Lead.Source.CONTACT_FORM
        if source not in Lead.Source.values:
            source = Lead.Source.OTHER
        if errors:
            return Response(errors, status=400)

        # Optional attachment -> media service. A failed upload must not lose
        # the lead: keep the enquiry, drop the file, and say so in the log.
        attachment_url = ""
        upload = request.FILES.get("attachment") if hasattr(request, "FILES") else None
        if upload is not None:
            if upload.size > MAX_ATTACHMENT_BYTES:
                return Response({"attachment": "File must be 5MB or smaller."}, status=400)
            if getattr(upload, "content_type", None) not in ALLOWED_ATTACHMENT_TYPES:
                return Response({"attachment": "Only PNG, JPG or PDF files are accepted."}, status=400)
            from apps.foundation import media_service

            if media_service.is_configured():
                attachment_url = media_service.upload_and_get_url(upload, "leads")
                if not attachment_url:
                    logger.error("lead attachment upload failed for %s", email)

        lead = Lead.objects.create(
            name=name[:150],
            email=email,
            phone=str(data.get("phone") or "").strip()[:30],
            company=str(data.get("company") or "").strip()[:150],
            message=message,
            attachment_url=attachment_url,
            source=source,
            utm_source=str(data.get("utm_source") or "")[:100],
            utm_medium=str(data.get("utm_medium") or "")[:100],
            utm_campaign=str(data.get("utm_campaign") or "")[:100],
            page_url=str(data.get("page_url") or "")[:500],
            referrer=str(data.get("referrer") or "")[:500],
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
        )
        logger.info("lead %s captured from %s (%s)", lead.reference, email, source)
        _notify_sales(lead)
        # Deliberately minimal response: no id, no echo of stored values.
        return Response({"status": "received"}, status=201)


def _notify_sales(lead: Lead) -> None:
    """Best-effort alert to the ops team. Never breaks lead capture."""
    try:
        ControlAuditLog.objects.create(
            action="marketing.lead_created",
            entity="Lead",
            entity_id=str(lead.pk),
            after={"email": lead.email, "source": lead.source, "company": lead.company},
        )
    except Exception:  # noqa: BLE001 — a logging failure must not lose the lead
        logger.exception("could not audit lead %s", lead.pk)


# ------------------------------------------------------------------ ops side


class SaLeadListView(APIView):
    permission_classes = [IsControlAdmin]

    def get(self, request):
        leads = Lead.objects.select_related("assigned_to", "converted_tenant").annotate(
            note_count=Count("notes")
        )
        params = request.query_params
        if params.get("status") in Lead.Status.values:
            leads = leads.filter(status=params["status"])
        if params.get("source") in Lead.Source.values:
            leads = leads.filter(source=params["source"])
        if params.get("q"):
            q = params["q"]
            leads = leads.filter(
                Q(name__icontains=q) | Q(email__icontains=q)
                | Q(company__icontains=q) | Q(message__icontains=q)
            )
        return Response([_lead_payload(lead) for lead in leads[:300]])


class SaLeadSummaryView(APIView):
    permission_classes = [IsControlAdmin]

    def get(self, request):
        counts = {status: 0 for status in Lead.Status.values}
        for row in Lead.objects.values("status").annotate(n=Count("id")):
            counts[row["status"]] = row["n"]
        counts["needs_attention"] = counts[Lead.Status.NEW] + counts[Lead.Status.CONTACTED]
        counts["total"] = sum(counts[s] for s in Lead.Status.values)
        return Response(counts)


class SaLeadDetailView(APIView):
    permission_classes = [IsControlAdmin]

    def get(self, request, pk: int):
        try:
            lead = Lead.objects.select_related("assigned_to", "converted_tenant").get(pk=pk)
        except Lead.DoesNotExist:
            return Response({"detail": "Lead not found."}, status=404)
        return Response(_lead_payload(lead, notes=lead.notes.all()))


class SaLeadUpdateView(APIView):
    """Status / assignee / conversion changes, audit-logged."""

    permission_classes = [IsControlAdmin]

    def post(self, request, pk: int):
        try:
            lead = Lead.objects.get(pk=pk)
        except Lead.DoesNotExist:
            return Response({"detail": "Lead not found."}, status=404)

        before = {"status": lead.status, "assigned_to": lead.assigned_to_id}
        data = request.data

        if "status" in data:
            if data["status"] not in Lead.Status.values:
                return Response({"status": "Unknown status."}, status=400)
            lead.status = data["status"]
            if lead.status == Lead.Status.CONTACTED and lead.contacted_at is None:
                lead.contacted_at = timezone.now()
        if "assigned_to_id" in data:
            if data["assigned_to_id"] in (None, "", 0):
                lead.assigned_to = None
            else:
                admin = AdminUser.objects.filter(pk=data["assigned_to_id"], is_active=True).first()
                if admin is None:
                    return Response({"assigned_to_id": "Unknown admin user."}, status=400)
                lead.assigned_to = admin
        if "converted_org_code" in data:
            code = str(data["converted_org_code"] or "").strip()
            if not code:
                lead.converted_tenant = None
            else:
                tenant = Tenant.objects.filter(org_code__iexact=code).first()
                if tenant is None:
                    return Response({"converted_org_code": "No tenant with that org code."}, status=400)
                lead.converted_tenant = tenant
                lead.status = Lead.Status.CONVERTED
        lead.save()

        ControlAuditLog.objects.create(
            action="marketing.lead_updated",
            entity="Lead",
            entity_id=str(lead.pk),
            before=before,
            after={"status": lead.status, "assigned_to": lead.assigned_to_id},
        )
        return Response(_lead_payload(lead, notes=lead.notes.all()))


class SaLeadNoteView(APIView):
    permission_classes = [IsControlAdmin]

    def post(self, request, pk: int):
        try:
            lead = Lead.objects.get(pk=pk)
        except Lead.DoesNotExist:
            return Response({"detail": "Lead not found."}, status=404)
        body = str(request.data.get("body") or "").strip()
        if not body:
            return Response({"body": "Note cannot be empty."}, status=400)
        LeadNote.objects.create(
            lead=lead,
            author=request.user if isinstance(request.user, AdminUser) else None,
            author_name=getattr(request.user, "full_name", "") or "Ops",
            body=body[:MAX_MESSAGE],
        )
        lead.save(update_fields=["updated_at"])
        return Response(_lead_payload(lead, notes=lead.notes.all()))
