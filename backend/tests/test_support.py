"""Support tickets: tenant lifecycle, superadmin workflow, isolation, internal notes."""
import pytest

from apps.support.models import SupportTicket
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _open_ticket(api, token, **overrides):
    payload = {
        "subject": "Cannot download invoice",
        "description": "The invoice button errors out for our March payment.",
        "category": "billing",
        "priority": "high",
    }
    payload.update(overrides)
    response = auth(api, token).post("/api/t/support/tickets", payload)
    assert response.status_code == 201, response.data
    return response.data


def test_tenant_creates_lists_and_reads_ticket(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]

    ticket = _open_ticket(api, token)
    assert ticket["ticket_no"].startswith("TKT-")
    assert ticket["status"] == "open"

    listing = auth(api, token).get("/api/t/support/tickets")
    assert listing.status_code == 200
    assert len(listing.data) == 1

    detail = auth(api, token).get(f"/api/t/support/tickets/{ticket['id']}")
    assert detail.status_code == 200
    # The description is mirrored as the first thread message.
    assert detail.data["messages"][0]["body"].startswith("The invoice button")


def test_ticket_validation(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    bad = auth(api, token).post("/api/t/support/tickets", {"subject": "", "description": ""})
    assert bad.status_code == 400
    assert "subject" in bad.data and "description" in bad.data
    bad2 = auth(api, token).post(
        "/api/t/support/tickets",
        {"subject": "x", "description": "y", "category": "nope"},
    )
    assert bad2.status_code == 400


def test_cross_tenant_isolation(api, make_tenant, tenant_token):
    tenant_a, _ = make_tenant(package_code="P2")
    tenant_b, _ = make_tenant(package_code="P2")
    token_a = tenant_token(tenant_a)["access"]
    token_b = tenant_token(tenant_b)["access"]

    ticket = _open_ticket(api, token_a)

    assert auth(api, token_b).get(f"/api/t/support/tickets/{ticket['id']}").status_code == 404
    assert auth(api, token_b).post(
        f"/api/t/support/tickets/{ticket['id']}/reply", {"body": "hi"}
    ).status_code == 404
    assert len(auth(api, token_b).get("/api/t/support/tickets").data) == 0


def test_scope_walls(api, make_tenant, tenant_token, admin_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    _open_ticket(api, token)

    # Control token cannot use tenant endpoints; tenant token cannot use /sa/.
    assert auth(api, admin_token).get("/api/t/support/tickets").status_code == 403
    assert auth(api, token).get("/api/sa/support/tickets").status_code == 403


def test_superadmin_workflow_reply_internal_status_assign(api, make_tenant, tenant_token, admin_token, superadmin):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    ticket = _open_ticket(api, token)

    # SA sees it across tenants with org info
    listing = auth(api, admin_token).get("/api/sa/support/tickets")
    assert listing.status_code == 200
    assert listing.data[0]["tenant"]["org_code"] == tenant.org_code

    # Internal note: never shown to the tenant, does not change status
    internal = auth(api, admin_token).post(
        f"/api/sa/support/tickets/{ticket['id']}/reply",
        {"body": "Checking gateway logs.", "is_internal": True},
    )
    assert internal.status_code == 200
    assert internal.data["status"] == "open"

    # Public reply -> in_progress
    public = auth(api, admin_token).post(
        f"/api/sa/support/tickets/{ticket['id']}/reply", {"body": "We are on it."}
    )
    assert public.data["status"] == "in_progress"

    tenant_view = auth(api, token).get(f"/api/t/support/tickets/{ticket['id']}")
    bodies = [m["body"] for m in tenant_view.data["messages"]]
    assert "We are on it." in bodies
    assert "Checking gateway logs." not in bodies

    # Assign + resolve
    updated = auth(api, admin_token).post(
        f"/api/sa/support/tickets/{ticket['id']}/update",
        {"status": "resolved", "assigned_to_id": superadmin.pk, "priority": "urgent"},
    )
    assert updated.status_code == 200, updated.data
    assert updated.data["status"] == "resolved"
    assert updated.data["assigned_to"]["id"] == superadmin.pk
    assert updated.data["resolved_at"] is not None

    # Tenant replying to a resolved ticket reopens it
    reopened = auth(api, token).post(
        f"/api/t/support/tickets/{ticket['id']}/reply", {"body": "Still broken for April."}
    )
    assert reopened.data["status"] == "in_progress"

    # Summary counts
    summary = auth(api, admin_token).get("/api/sa/support/summary")
    assert summary.data["in_progress"] == 1
    assert summary.data["needs_attention"] == 1


def test_waiting_on_customer_and_close(api, make_tenant, tenant_token, admin_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    ticket = _open_ticket(api, token)

    waiting = auth(api, admin_token).post(
        f"/api/sa/support/tickets/{ticket['id']}/reply",
        {"body": "Which browser are you on?", "waiting_on_customer": True},
    )
    assert waiting.data["status"] == "waiting_on_customer"

    # Tenant reply flips it back for the ops queue
    replied = auth(api, token).post(
        f"/api/t/support/tickets/{ticket['id']}/reply", {"body": "Chrome 126."}
    )
    assert replied.data["status"] == "in_progress"

    closed = auth(api, token).post(f"/api/t/support/tickets/{ticket['id']}/close")
    assert closed.data["status"] == "closed"
    assert SupportTicket.objects.get(pk=ticket["id"]).resolved_at is not None
