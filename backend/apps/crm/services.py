"""CRM services: create a lead (with its prospect Party), convert, log activity."""
from django.db import transaction
from django.utils import timezone

from apps.foundation.integration import events
from apps.foundation.models import Party
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import Lead, LeadActivity

# Party.address keys built from the flat lead form.
_ADDRESS_KEYS = ["line1", "line2", "city", "state", "postal_code", "latitude", "longitude"]


def _build_address(data: dict) -> dict:
    address = {}
    for key in _ADDRESS_KEYS:
        # accept both address_line1 and line1 style keys
        value = data.get(key, data.get(f"address_{key}"))
        if value not in (None, ""):
            address[key] = value
    return address


def create_lead(*, actor, name, phone="", email="", company_name="", source="",
                assigned_to_id=None, industry="", territory="", employee_count=None,
                notes="", follow_up_date=None, **address_data) -> Lead:
    """Create the prospect Party + the Lead pipeline facet, atomically."""
    with transaction.atomic(using=ensure_alias(require_tenant())):
        party = Party.objects.create(
            name=name, kind=Party.Kind.PROSPECT, phone=phone, email=email,
            address=_build_address(address_data), assigned_agent_id=assigned_to_id,
            extra={"company_name": company_name} if company_name else {},
        )
        lead = Lead.objects.create(
            party=party, assigned_to_id=assigned_to_id, company_name=company_name,
            source=source or "", status=Lead.Status.OPEN, industry=industry,
            territory=territory, employee_count=employee_count, notes=notes,
            follow_up_date=follow_up_date,
        )
        LeadActivity.objects.create(
            lead=lead, action="created", actor_name=getattr(actor, "full_name", ""),
        )
    return lead


def change_status(lead: Lead, status: str, actor=None) -> Lead:
    old = lead.status
    lead.status = status
    lead.save(update_fields=["status", "updated_at"])
    LeadActivity.objects.create(
        lead=lead, action="status_change",
        detail={"from": old, "to": status}, actor_name=getattr(actor, "full_name", ""),
    )
    return lead


def convert_lead(lead: Lead, actor=None):
    """Promote the prospect Party to a customer and mark the lead converted.
    Emits crm.lead_converted so other modules (analytics/notifications) react."""
    if lead.status == Lead.Status.CONVERTED:
        return lead
    if not lead.party_id:
        from rest_framework.exceptions import ValidationError

        raise ValidationError("Lead has no backing party; cannot convert.")
    with transaction.atomic(using=ensure_alias(require_tenant())):
        if lead.party_id:
            party = lead.party
            party.kind = Party.Kind.CUSTOMER
            party.save(update_fields=["kind", "updated_at"])
        lead.status = Lead.Status.CONVERTED
        lead.converted_at = timezone.now()
        lead.save(update_fields=["status", "converted_at", "updated_at"])
        LeadActivity.objects.create(
            lead=lead, action="converted", actor_name=getattr(actor, "full_name", ""),
        )
    events.emit("crm.lead_converted", lead_id=lead.pk, party_id=lead.party_id)
    return lead
