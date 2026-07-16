"""MOD-CRM: leads as party-backed facets + integration with FIELD.

A lead IS a Foundation Party (kind=prospect) plus a pipeline facet, so FIELD
can visit it with ZERO coupling, and conversion just flips the party to a
customer.
"""
import pytest
from django.utils import timezone

from apps.foundation.integration import events
from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _agent(api, tenant, tenant_token, email="agent@crm.test"):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post(
        "/api/t/users/",
        {"email": email, "full_name": "CRM Agent", "role_slug": "sales_agent",
         "password": "agent-pass-123", "password_confirm": "agent-pass-123"},
    )
    login = api.post(
        "/api/auth/tenant/login",
        {"org_code": tenant.org_code, "email": email, "password": "agent-pass-123"},
    )
    return login.data["access"], login.data["user"]["id"]


def test_crm_lead_lifecycle(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P3")  # TRACK + FIELD + CRM
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    created = client.post("/api/t/crm/leads/", {
        "name": "Bright Traders", "phone": "9876500000", "email": "bt@x.test",
        "company_name": "Bright Traders Pvt Ltd", "source": "referral",
        "city": "Jaipur", "latitude": 26.9, "longitude": 75.8,
    })
    assert created.status_code == 201, created.data
    lead = created.data
    assert lead["status"] == "open"
    assert lead["name"] == "Bright Traders" and lead["city"] == "Jaipur"
    assert lead["party_id"] is not None  # backed by a prospect Party

    # the backing party exists as a PROSPECT (not yet a customer)
    from apps.foundation.models import Party
    with use_tenant(tenant):
        party = Party.objects.get(pk=lead["party_id"])
        assert party.kind == "prospect"

    # move down the pipeline
    assert client.post(f"/api/t/crm/leads/{lead['id']}/set-status/", {"status": "qualified"}).data["status"] == "qualified"

    funnel = client.get("/api/t/crm/leads/funnel/")
    assert funnel.data["by_status"]["qualified"] == 1

    # convert -> party becomes a customer, event fires
    fired = []
    events.subscribe("crm.lead_converted", lambda **p: fired.append(p))
    converted = client.post(f"/api/t/crm/leads/{lead['id']}/convert/")
    assert converted.data["status"] == "converted"
    assert fired and fired[-1]["party_id"] == lead["party_id"]
    with use_tenant(tenant):
        assert Party.objects.get(pk=lead["party_id"]).kind == "customer"

    # the converted party now appears in the customers list (Foundation Parties)
    customers = client.get("/api/t/parties/?kind=customer")
    assert any(c["id"] == lead["party_id"] for c in customers.data["results"])


def test_review_fixes_visibility_and_guards(api, make_tenant, tenant_token):
    """Review fixes: unassigned leads visible to agents; agent can't reassign;
    convert requires a party; bad assigned_to -> 400 not 500."""
    tenant, _ = make_tenant(package_code="P3")
    owner_login = tenant_token(tenant)
    manager_token = owner_login["access"]  # owner acts as manager/admin
    owner_id = owner_login["user"]["id"]
    agent_token, agent_id = _agent(api, tenant, tenant_token)

    # manager creates an UNASSIGNED lead
    mgr = auth(api, manager_token)
    unassigned = mgr.post("/api/t/crm/leads/", {"name": "Walk-in Prospect"})
    assert unassigned.status_code == 201
    # an agent CAN see the unassigned lead (the None-in-__in bug fix)
    agent_leads = auth(api, agent_token).get("/api/t/crm/leads/").data["results"]
    assert any(l["id"] == unassigned.data["id"] for l in agent_leads)

    # an agent creating with a non-numeric assigned_to -> 400 (not 500)
    assert auth(api, agent_token).post(
        "/api/t/crm/leads/", {"name": "X", "assigned_to": "abc"}
    ).status_code == 400

    # an agent cannot reassign their own lead to another (real) user
    own = auth(api, agent_token).post("/api/t/crm/leads/", {"name": "My Lead"}).data
    reassigned = auth(api, agent_token).patch(
        f"/api/t/crm/leads/{own['id']}/", {"assigned_to": owner_id}
    )
    assert reassigned.status_code == 403


def test_lead_serializer_supplies_address_and_manager(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P3")
    token = tenant_token(tenant)["access"]
    lead = auth(api, token).post("/api/t/crm/leads/", {
        "name": "Addr Co", "address_line1": "12 MI Road", "city": "Jaipur", "state": "RJ",
    }).data
    assert "MI Road" in lead["address"] and "Jaipur" in lead["address"]
    assert "sales_manager_name" in lead


def test_visit_entity_type_filter(api, make_tenant, tenant_token):
    """FIELD visits list honours entity_type=client|lead (via party kind)."""
    tenant, _ = make_tenant(package_code="P3")
    token, agent_id = _agent(api, tenant, tenant_token)
    client = auth(api, token)
    owner = tenant_token(tenant)["access"]
    # a customer party + a prospect (via lead)
    cust = auth(api, owner).post("/api/t/parties/", {"name": "Cust Co", "kind": "customer"}).data
    lead = client.post("/api/t/crm/leads/", {"name": "Prospect Co"}).data
    client.post("/api/t/field/visits/", {"party": cust["id"], "visit_date": str(timezone.localdate()), "scheduled_time": "10:00"})
    client.post("/api/t/field/visits/", {"party": lead["party_id"], "visit_date": str(timezone.localdate()), "scheduled_time": "11:00"})

    clients = client.get("/api/t/field/visits/?entity_type=client")
    assert clients.data["count"] == 1 and clients.data["results"][0]["customer_name"] == "Cust Co"
    leads = client.get("/api/t/field/visits/?entity_type=lead")
    assert leads.data["count"] == 1 and leads.data["results"][0]["customer_name"] == "Prospect Co"


def test_crm_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")  # TRACK only, no CRM
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/crm/leads/").status_code == 403
    assert auth(api, token).post("/api/t/crm/leads/", {"name": "X"}).status_code == 403


def test_field_can_visit_a_crm_lead_with_zero_coupling(api, make_tenant, tenant_token):
    """A lead is a Party, so FIELD schedules a visit against lead.party_id —
    proving CRM and FIELD interoperate without importing each other."""
    tenant, _ = make_tenant(package_code="P3")  # FIELD + CRM
    token, agent_id = _agent(api, tenant, tenant_token)
    client = auth(api, token)

    lead = client.post("/api/t/crm/leads/", {"name": "Prospect Shop", "phone": "9000000000", "city": "Delhi"}).data
    # schedule a FIELD visit against the lead's Party
    visit = client.post("/api/t/field/visits/", {
        "party": lead["party_id"], "visit_date": str(timezone.localdate()),
        "scheduled_time": "10:00", "purpose": "Qualify prospect",
    })
    assert visit.status_code == 201, visit.data
    assert visit.data["customer_name"] == "Prospect Shop"  # visit sees the party identity


def test_customers_come_from_foundation_parties(api, make_tenant, tenant_token):
    """The /my-customers screen reads Foundation Parties with compat aliases."""
    tenant, _ = make_tenant(package_code="P2")  # FIELD, no CRM needed for customers
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    client.post("/api/t/parties/", {
        "name": "Gupta Kirana", "kind": "customer",
        "address": {"line1": "Shop 4", "city": "Jaipur", "latitude": 26.9},
    })
    listing = client.get("/api/t/parties/?kind=customer")
    row = listing.data["results"][0]
    assert row["customer_name"] == "Gupta Kirana"        # compat alias
    assert "Jaipur" in row["formatted_address"]
    assert row["latitude"] == 26.9
