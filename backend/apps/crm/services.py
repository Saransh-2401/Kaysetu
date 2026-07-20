"""CRM services: create a lead (with its prospect Party), convert, log activity."""
from django.db import transaction
from django.utils import timezone

from rest_framework.exceptions import ValidationError

from apps.foundation.integration import events
from apps.foundation.models import Party
from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from .models import Lead, LeadActivity


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))

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


# ------------------------------------------------------------------ quotations
def _quote_num():
    import secrets

    return f"QTN-{timezone.now().strftime('%y%m%d%H%M%S%f')}-{secrets.token_hex(2)}"


def create_quotation(*, party_id, items, quotation_date=None, valid_until=None,
                     lead=None, terms_and_conditions="", notes="", owner=None):
    """Price a quotation server-side from the catalog and the supplied quantities.

    The RATE may be negotiated per quote (that is what a quotation is for), but
    the arithmetic — line amount, tax, totals — is always ours.
    """
    from decimal import Decimal

    from apps.foundation.models import CatalogItem, Party

    from .models import Quotation, QuotationItem

    if not Party.objects.filter(pk=party_id).exists():
        raise ValidationError({"party": f"unknown party {party_id}."})
    if not items:
        raise ValidationError({"items": "at least one line is required."})

    cent = Decimal("0.01")
    prepared, subtotal, tax_total = [], Decimal("0"), Decimal("0")
    for raw in items:
        catalog = CatalogItem.objects.filter(pk=raw.get("item")).first()
        if catalog is None:
            raise ValidationError({"item": f"unknown catalog item {raw.get('item')}."})
        quantity = Decimal(str(raw.get("quantity", 0)))
        rate = Decimal(str(raw.get("rate", catalog.price)))
        tax_rate = Decimal(str(raw.get("tax_rate", catalog.tax_rate)))
        if quantity <= 0:
            raise ValidationError({"quantity": "must be greater than zero."})
        if rate < 0 or tax_rate < 0 or tax_rate > 100:
            raise ValidationError({"rate": "rate must be >= 0 and tax_rate within 0..100."})
        amount = (quantity * rate).quantize(cent)
        tax = (amount * tax_rate / 100).quantize(cent)
        subtotal += amount
        tax_total += tax
        prepared.append(QuotationItem(
            item=catalog, item_name=raw.get("item_name") or catalog.name,
            description=raw.get("description", ""), quantity=quantity, rate=rate,
            tax_rate=tax_rate, amount=amount, tax_amount=tax,
        ))

    with _tenant_atomic():
        quotation = Quotation.objects.create(
            number=_quote_num(), party_id=party_id, lead=lead,
            quotation_date=quotation_date or timezone.localdate(), valid_until=valid_until,
            subtotal=subtotal, tax_amount=tax_total, total=subtotal + tax_total,
            terms_and_conditions=terms_and_conditions, notes=notes, owner=owner,
        )
        for line in prepared:
            line.quotation = quotation
        QuotationItem.objects.bulk_create(prepared)
    events.emit("crm.quotation_created", quotation_id=quotation.pk, party_id=party_id,
                total=str(quotation.total))
    # Re-query so `items` is populated rather than an empty prefetch.
    return Quotation.objects.prefetch_related("items").get(pk=quotation.pk)


_QUOTE_TRANSITIONS = {
    "draft": {"submitted", "lost", "expired"},
    "submitted": {"won", "lost", "expired"},
    "won": set(),
    "lost": set(),
    "expired": {"submitted"},          # re-quote after expiry
}


def set_quotation_status(quotation, new_status, *, reason="", actor=None):
    from .models import Quotation

    if new_status not in Quotation.Status.values:
        raise ValidationError({"status": f"'{new_status}' is not a quotation status."})
    if new_status not in _QUOTE_TRANSITIONS.get(quotation.status, set()):
        raise ValidationError(
            f"Cannot move a {quotation.get_status_display()} quotation to {new_status}.")
    quotation.status = new_status
    quotation.lost_reason = reason if new_status == Quotation.Status.LOST else ""
    quotation.save(update_fields=["status", "lost_reason", "updated_at"])

    # Winning a quotation is what converts the lead behind it — without this the
    # pipeline would show a won deal still sitting in "interested".
    if new_status == Quotation.Status.WON and quotation.lead_id:
        lead = quotation.lead
        if lead.status != Lead.Status.CONVERTED:
            convert_lead(lead, actor=actor)
    events.emit(f"crm.quotation_{new_status}", quotation_id=quotation.pk,
                party_id=quotation.party_id, total=str(quotation.total))
    return quotation
