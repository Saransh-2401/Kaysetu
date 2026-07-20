"""Tenant configuration: company profile, messaging, releases, quick links, roles.

All of it is platform-core — a tenant on the smallest package still configures
their company and their roles. Writes are admin-only, because these settings
decide what the whole organisation can see and how it talks to its customers.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _staff(api, tenant, tenant_token, role_slug, email):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": "Staff", "role_slug": role_slug,
        "password": "staff-pass-123", "password_confirm": "staff-pass-123"})
    login = api.post("/api/auth/tenant/login",
                     {"org_code": tenant.org_code, "email": email, "password": "staff-pass-123"})
    return login.data["access"]


def test_company_profile_round_trips(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P1")     # smallest package — still core
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    assert client.get("/api/core/companies/current/").status_code == 200
    saved = client.patch("/api/core/companies/1/", {
        "name": "Acme Foods Pvt Ltd", "tax_id": "27AAAAA0000A1Z5",
        "email": "hello@acme.test", "phone": "9876543210",
        "address": {"line1": "12 Mill Road", "city": "Pune", "state": "MH"},
        "operating_cities": ["Pune", "Mumbai"], "default_operating_city": "Pune",
        "active_color_scheme": "navy-gold", "office_start_time": "09:00:00",
    })
    assert saved.status_code == 200
    assert saved.data["name"] == "Acme Foods Pvt Ltd"
    assert saved.data["tax_id"] == "27AAAAA0000A1Z5"
    assert saved.data["full_address"] == "12 Mill Road, Pune, MH"
    assert saved.data["operating_cities"] == ["Pune", "Mumbai"]
    assert saved.data["active_color_scheme"] == "navy-gold"

    # the invoice-header endpoint sees the same record
    assert client.get("/api/core/companies/current/").data["name"] == "Acme Foods Pvt Ltd"


def test_company_writes_are_admin_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    agent = _staff(api, tenant, tenant_token, "sales_agent", "agent@cfg.test")
    assert auth(api, agent).get("/api/core/companies/current/").status_code == 200
    assert auth(api, agent).patch("/api/core/companies/1/", {"name": "Hijacked"}).status_code == 403


def test_email_config_never_returns_the_password(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    saved = client.post("/api/core/email-config/", {
        "host": "smtp.acme.test", "port": 587, "username": "bot@acme.test",
        "password": "super-secret", "default_from_email": "bot@acme.test"})
    assert saved.status_code == 200
    assert "password" not in saved.data          # never echoed back
    assert saved.data["has_password"] is True and saved.data["is_configured"] is True

    # a blank password means "leave it alone" — otherwise editing the from-name
    # would silently break sending
    client.post("/api/core/email-config/", {"from_name": "Acme Billing"})
    after = client.get("/api/core/email-config/").data
    assert after["has_password"] is True and after["from_name"] == "Acme Billing"


def test_send_test_is_honest_when_nothing_is_configured(api, make_tenant, tenant_token):
    """Reporting success here would train people to trust a channel that never
    actually sends."""
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    template = client.post("/api/core/email-templates/", {
        "name": "Invoice issued", "trigger_key": "invoice_issued",
        "subject": "Your invoice", "body": "<p>Hello {{customer}}</p>"}).data
    failed = client.post(f"/api/core/email-templates/{template['id']}/send_test/",
                         {"email": "someone@acme.test"})
    assert failed.status_code == 400 and failed.data["status"] == "error"
    assert "not configured" in failed.data["message"]

    # SMS refuses without a DLT template id — the carrier would reject it anyway
    sms = client.post("/api/core/sms-templates/", {
        "name": "OTP", "trigger_key": "otp_sent", "content": "Your code is ${otp}"}).data
    client.post("/api/core/sms-config/", {"api_key": "k", "sender_id": "ACME",
                                          "entity_id": "1234"})
    refused = client.post(f"/api/core/sms-templates/{sms['id']}/send_test/",
                          {"phone": "9876543210"})
    assert refused.status_code == 400 and "DLT" in refused.data["message"]


def test_app_version_latest_is_public_and_orders_numerically(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    for version, code in (("1.9.0", 9), ("1.10.0", 10)):
        client.post("/api/core/app-versions/", {
            "version": version, "version_code": code, "apk_url": f"https://cdn.acme.test/{version}.apk"})

    # version STRINGS sort wrongly ("1.10" < "1.9" as text) — version_code is
    # the ordering authority
    assert client.get("/api/core/app-versions/latest/").data["version"] == "1.10.0"

    # The app checks for updates BEFORE login. Releases live in the tenant DB,
    # so an anonymous caller must name its tenant — otherwise there is nothing
    # to look in, and one tenant's channel would be readable from another's.
    api.credentials()
    assert api.get("/api/core/app-versions/latest/").status_code == 400
    assert api.get("/api/core/app-versions/latest/?org_code=NOPE").status_code == 404
    public = api.get(f"/api/core/app-versions/latest/?org_code={tenant.org_code}")
    assert public.status_code == 200 and public.data["version"] == "1.10.0"

    # a different tenant that has published nothing gets a well-formed nothing,
    # not the first tenant's release and not a 404
    other, _ = make_tenant(package_code="P2")
    empty = api.get(f"/api/core/app-versions/latest/?org_code={other.org_code}")
    assert empty.status_code == 200 and empty.data["version_code"] == 0


def test_quick_links_are_private_and_deduped(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    owner = tenant_token(tenant)["access"]
    agent = _staff(api, tenant, tenant_token, "sales_agent", "agent@ql.test")

    auth(api, owner).post("/api/core/role-quick-links/", {
        "role": "sales_agent", "label": "My Visits", "path": "/visits"})

    mine = auth(api, agent).get("/api/core/quick-links/me/").data
    assert [r["label"] for r in mine["predefined"]] == ["My Visits"]
    assert mine["personal"] == []

    added = auth(api, agent).post("/api/core/quick-links/",
                                  {"label": "Customers", "path": "/customers"})
    assert added.status_code == 201
    # the same page twice, and a page the role already pins, are both refused
    assert auth(api, agent).post("/api/core/quick-links/",
                                 {"label": "Customers", "path": "/customers"}).status_code == 400
    assert auth(api, agent).post("/api/core/quick-links/",
                                 {"label": "Visits", "path": "/visits"}).status_code == 400
    assert auth(api, agent).post("/api/core/quick-links/", {"label": ""}).status_code == 400

    # someone else's shortcut is not deletable by id
    assert auth(api, owner).delete(
        f"/api/core/quick-links/{added.data['id']}/").status_code == 404
    assert auth(api, agent).delete(
        f"/api/core/quick-links/{added.data['id']}/").status_code == 204


def test_role_crud_by_slug_with_reassignment_on_delete(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    created = client.post("/api/core/roles/", {
        "name": "Regional Lead", "description": "Owns a cluster of territories"})
    assert created.status_code == 201
    slug = created.data["slug"]
    assert slug == "regional_lead" and created.data["is_system"] is False
    assert created.data["access_type"] == "custom" and created.data["user_count"] == 0

    # a duplicate name is refused rather than creating a confusing twin
    assert client.post("/api/core/roles/", {"name": "regional lead"}).status_code == 400
    # system roles cannot be renamed or deleted
    assert client.patch("/api/core/roles/admin/", {"name": "Overlord"}).status_code == 400
    assert client.delete("/api/core/roles/admin/").status_code == 400

    client.post("/api/t/users/", {
        "email": "lead@rc.test", "full_name": "Lead", "role_slug": slug,
        "password": "lead-pass-1234", "password_confirm": "lead-pass-1234"})
    assert client.get("/api/core/roles/").data
    row = next(r for r in client.get("/api/core/roles/").data if r["slug"] == slug)
    assert row["user_count"] == 1

    # deleting a role people still hold is a CONFLICT, not a bad request — the
    # screen offers a reassignment picker off the back of this
    blocked = client.delete(f"/api/core/roles/{slug}/")
    assert blocked.status_code == 409
    assert blocked.data["requires_reassign"] is True and blocked.data["user_count"] == 1

    moved = client.delete(f"/api/core/roles/{slug}/", {"reassign_to": "sales_agent"},
                          format="json")
    assert moved.status_code == 204
    assert client.get("/api/auth/users/me/").status_code == 200


def test_permission_matrix_bulk_save_reports_unknown_roles(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    matrix = client.get("/api/core/role-permissions/")
    assert matrix.status_code == 200 and isinstance(matrix.data, list)

    saved = client.post("/api/core/role-permissions/bulk/", {
        "sales_agent": {"accessType": "custom", "modules": {"visits": {"enabled": True}}},
        "no_such_role": {"accessType": "full", "modules": {}},
    }, format="json")
    assert saved.status_code == 200
    assert saved.data["saved_roles"] == ["sales_agent"]
    # a silently-dropped role means an admin thinks they saved something they didn't
    assert saved.data["unknown_roles"] == ["no_such_role"]

    row = next(r for r in client.get("/api/core/role-permissions/?role=sales_agent").data)
    assert row["permissions"] == {"visits": {"enabled": True}}


def test_matrix_and_config_writes_are_admin_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    agent = _staff(api, tenant, tenant_token, "sales_agent", "agent@perm.test")
    client = auth(api, agent)
    assert client.get("/api/core/role-permissions/").status_code == 403
    assert client.post("/api/core/role-permissions/bulk/", {}).status_code == 403
    assert client.post("/api/core/roles/", {"name": "Sneaky"}).status_code == 403
    assert client.post("/api/core/email-config/", {"host": "evil.test"}).status_code == 403
    assert client.post("/api/core/app-versions/", {
        "version": "9.9.9", "version_code": 999}).status_code == 403
    # ...but reading their own effective permissions is fine
    assert client.get("/api/core/role-permissions/me/").status_code == 200


# --------------------------------------------- review-hardening round 2
def test_deleting_a_role_never_silently_strips_its_holders(api, make_tenant, tenant_token):
    """TenantUser.role is SET_NULL, so a bare delete left holders with no role:
    a valid session and no permissions, with nothing explaining why. BOTH role
    endpoints must demand a reassignment target."""
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    role = client.post("/api/core/roles/", {"name": "Area Lead"}).data
    client.post("/api/t/users/", {
        "email": "lead@rl.test", "full_name": "Lead", "role_slug": role["slug"],
        "password": "lead-pass-1234", "password_confirm": "lead-pass-1234"})

    # the OLD id-addressed endpoint used to delete outright
    blocked = client.delete(f"/api/t/roles/{role['id']}/")
    assert blocked.status_code == 409
    assert blocked.data["requires_reassign"] is True and blocked.data["user_count"] == 1

    moved = client.delete(f"/api/t/roles/{role['id']}/",
                          {"reassign_to": "sales_agent"}, format="json")
    assert moved.status_code == 204

    # the holder kept A role rather than being left with none
    holder = next(u for u in client.get("/api/t/users/").data["results"]
                  if u["email"] == "lead@rl.test")
    assert holder["role_slug"] == "sales_agent"

    # system roles are still undeletable on this endpoint too
    admin_role = next(r for r in client.get("/api/core/roles/").data if r["slug"] == "admin")
    assert client.delete(f"/api/t/roles/{admin_role['id']}/").status_code == 400


def test_company_profile_rejects_bad_numbers_instead_of_500ing(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    bad = client.patch("/api/core/companies/1/", {"latitude": "abc"})
    assert bad.status_code == 400 and "latitude" in bad.data

    assert client.patch("/api/core/companies/1/",
                        {"fy_start_month": 13}).status_code == 400
    assert client.patch("/api/core/companies/1/",
                        {"operating_cities": "Pune"}).status_code == 400
    assert client.patch("/api/core/companies/1/", {"address": "12 Mill Road"}).status_code == 400

    # ...and a well-formed edit still lands
    ok = client.patch("/api/core/companies/1/",
                      {"latitude": "18.5204", "fy_start_month": 4})
    assert ok.status_code == 200 and float(ok.data["latitude"]) == 18.5204


def test_verify_refuses_to_reuse_the_stored_password_against_a_new_host(
        api, make_tenant, tenant_token):
    """Otherwise an admin could point verification at a server they control and
    have us authenticate to it — extracting a credential the API never shows."""
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    client.post("/api/core/email-config/", {
        "host": "smtp.acme.test", "port": 587, "username": "bot@acme.test",
        "password": "super-secret"})

    exfil = client.post("/api/core/email-config/verify/",
                        {"host": "smtp.attacker.test", "port": 587})
    assert exfil.status_code == 400
    assert "Re-enter the password" in exfil.data["message"]

    # a different USERNAME against the stored host is refused for the same reason
    assert client.post("/api/core/email-config/verify/",
                       {"host": "smtp.acme.test",
                        "username": "someone-else@acme.test"}).status_code == 400


def test_distributor_picker_lists_distributors_not_the_customer_book(
        api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P4")
    owner = tenant_token(tenant)["access"]
    client = auth(api, owner)

    client.post("/api/t/parties/", {"name": "Plain Customer", "kind": "customer"})
    dist = client.post("/api/t/parties/", {
        "name": "Metro Distributors", "kind": "customer",
        "extra": {"is_distributor": True}}).data

    listed = client.get("/api/auth/assigned-distributors/").data
    assert [row["name"] for row in listed] == ["Metro Distributors"]
    assert dist["id"] == listed[0]["id"]


def test_a_re_entitled_module_recovers_its_skipped_backlog(api, make_tenant, tenant_token):
    """Skipping a delivery for a lost entitlement was a one-way door: the
    posting could never be applied again by any path."""
    tenant, _ = make_tenant(package_code="P8")
    tenant_token(tenant)
    with use_tenant(tenant):
        from apps.foundation.integration import reconcile_deliveries, redeliver
        from apps.foundation.models import EntitlementSnapshot, EventDelivery

        row = EventDelivery.objects.create(
            event="orders.invoice_issued",
            subscriber="apps.books.handlers.on_invoice_issued",
            payload={"invoice_id": 1, "party_id": 1, "total": "100"},
            modules_at_emit=["ORDERS", "BOOKS"],
            status=EventDelivery.Status.FAILED, attempts=1)

        EntitlementSnapshot.objects.update_or_create(pk=1, defaults={"modules": ["ORDERS"]})
        assert redeliver()["skipped_unentitled"] == 1
        row.refresh_from_db()
        assert row.status == EventDelivery.Status.SKIPPED_UNENTITLED

        # the tenant re-subscribes to BOOKS
        EntitlementSnapshot.objects.update_or_create(
            pk=1, defaults={"modules": ["ORDERS", "BOOKS"]})
        assert reconcile_deliveries()["recovered"] == 1
        row.refresh_from_db()
        assert row.status == EventDelivery.Status.FAILED     # back in the retry queue
