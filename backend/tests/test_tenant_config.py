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


def test_company_edits_survive_a_whole_payload_round_trip(api, make_tenant, tenant_token):
    """The portal keeps the GET response in state and PATCHes all of it back.

    The payload publishes some columns under two names (`name`/`company_name`,
    `full_address`/`address`, `fiscal_month_start`/`fy_start_month`), so every save
    carries the user's edit beside the server's stale value for the same column.
    The edit has to win, or the field silently reverts.
    """
    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])

    client.patch("/api/core/companies/1/", {
        "name": "Old Name Ltd", "full_address": "12 Mill Road, Pune, MH",
        "fiscal_month_start": 4,
    })
    state = client.get("/api/core/companies/current/").data
    assert state["name"] == "Old Name Ltd" and state["fiscal_month_start"] == 4

    # edit exactly like the form does: change one key, send everything back
    state["name"] = "New Name Ltd"
    state["full_address"] = "99 Ring Road, Jaipur, RJ"
    state["fiscal_month_start"] = 7
    saved = client.patch("/api/core/companies/1/", state, format="json")

    assert saved.status_code == 200
    assert saved.data["name"] == "New Name Ltd"
    assert saved.data["company_name"] == "New Name Ltd"
    assert saved.data["full_address"] == "99 Ring Road, Jaipur, RJ"
    assert saved.data["address"]["line1"] == "99 Ring Road, Jaipur, RJ"
    assert saved.data["fiscal_month_start"] == 7

    fresh = client.get("/api/core/companies/current/").data
    assert fresh["name"] == "New Name Ltd"
    assert fresh["full_address"] == "99 Ring Road, Jaipur, RJ"
    assert fresh["fiscal_month_start"] == 7

    # and clearing the address clears it, rather than restoring the old one
    fresh["full_address"] = ""
    cleared = client.patch("/api/core/companies/1/", fresh, format="json")
    assert cleared.status_code == 200 and cleared.data["full_address"] == ""


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


def test_gstin_edit_survives_the_whole_payload_round_trip(api, make_tenant, tenant_token):
    """`gstin` is published under BOTH `gstin` and `tax_id`, and the company form
    edits `tax_id`.

    Without mirroring tax_id -> gstin the save answered 200 while the field loop
    quietly restored the stale `gstin` sent alongside it, so the GSTIN appeared
    to save and then reverted on reload.
    """
    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])

    client.patch("/api/core/companies/1/", {"tax_id": "27AAAAA0000A1Z5"})
    state = client.get("/api/core/companies/current/").data
    assert state["tax_id"] == "27AAAAA0000A1Z5"
    assert state["gstin"] == "27AAAAA0000A1Z5"

    # Edit like the form does: change tax_id, PATCH the whole state back
    # (which still carries the OLD gstin value beside it).
    state["tax_id"] = "09BBBBB1111B2Z6"
    saved = client.patch("/api/core/companies/1/", state, format="json")
    assert saved.status_code == 200
    assert saved.data["tax_id"] == "09BBBBB1111B2Z6"
    assert saved.data["gstin"] == "09BBBBB1111B2Z6"

    fresh = client.get("/api/core/companies/current/").data
    assert fresh["tax_id"] == "09BBBBB1111B2Z6"


def test_smtp_and_sms_report_whether_a_secret_is_stored(api, make_tenant, tenant_token):
    """Secrets are never echoed back — only a boolean saying one exists.

    The portal needs that flag to show "saved" instead of an empty box; when it
    read the wrong key the field looked blank and users assumed the save failed.
    Blank on a later save must also KEEP the stored secret, not clear it.
    """
    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])

    assert client.get("/api/core/email-config/").data.get("has_password") in (False, None)

    saved = client.post("/api/core/email-config/", {
        "host": "smtp.example.com", "port": 587, "username": "bot@example.com",
        "password": "s3cret-value", "default_from_email": "bot@example.com",
    }).data
    assert saved["has_password"] is True
    assert "password" not in saved            # never echoed back
    assert saved["is_configured"] is True

    # Saving again WITHOUT the password (the UI leaves it blank) must not wipe it.
    again = client.post("/api/core/email-config/", {"from_name": "KaySetu Bot"}).data
    assert again["has_password"] is True

    sms = client.post("/api/core/sms-config/", {
        "api_key": "sms-key-123", "sender_id": "KAYSTU", "entity_id": "1234567890",
    }).data
    assert sms["has_api_key"] is True
    assert "api_key" not in sms
    assert client.post("/api/core/sms-config/", {"sender_id": "KAYSTU"}).data["has_api_key"] is True


def test_otp_message_templates_are_seeded_for_every_tenant(api, make_tenant, tenant_token):
    """The Notification screen can only EDIT templates — nothing created any, and
    `trigger_key` must match a key the code looks up, so it cannot be guessed.

    OTP_LOGIN is the only key the platform actually reads, so exactly that pair
    is seeded and must be present in a fresh tenant.
    """
    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])

    # pagination_class = None on the template viewsets -> a plain array
    emails = client.get("/api/core/email-templates/").data
    otp_email = next((t for t in emails if t["trigger_key"] == "OTP_LOGIN"), None)
    assert otp_email is not None, "OTP_LOGIN email template was not seeded"
    assert "{otp}" in otp_email["body"]
    assert otp_email["is_active"] is True

    sms = client.get("/api/core/sms-templates/").data
    otp_sms = next((t for t in sms if t["trigger_key"] == "OTP_LOGIN"), None)
    assert otp_sms is not None, "OTP_LOGIN SMS template was not seeded"
    assert "${otp}" in otp_sms["content"]
    # DLT id is intentionally blank — only the tenant can register one, and the
    # send is skipped without it rather than being rejected by the carrier.
    assert otp_sms["dlt_template_id"] == ""


def test_template_trigger_key_is_read_only_so_templates_must_be_seeded(api, make_tenant, tenant_token):
    """Why the portal offers no "add template" button.

    `trigger_key` is read-only on the API and DELETE is not allowed, because the
    key has to match one the code looks up. A hand-made template would carry an
    empty trigger and could never fire — so the platform seeds the rows and
    admins edit their wording instead.
    """
    tenant, _ = make_tenant(package_code="P1")
    client = auth(api, tenant_token(tenant)["access"])

    created = client.post("/api/core/email-templates/", {
        "name": "Welcome Mail", "trigger_key": "WELCOME",
        "subject": "Welcome aboard", "body": "<p>Hi {full_name}</p>",
    })
    assert created.status_code == 201, created.data
    # The requested trigger was ignored — the row can never fire.
    assert created.data["trigger_key"] == ""
    assert client.delete(f"/api/core/email-templates/{created.data['id']}/").status_code == 405

    # Editing a SEEDED template is the supported path and does persist.
    seeded = [t for t in client.get("/api/core/email-templates/").data
              if t["trigger_key"] == "OTP_LOGIN"][0]
    edited = client.patch(f"/api/core/email-templates/{seeded['id']}/",
                          {"subject": "Your KaySetu code"})
    assert edited.status_code == 200
    assert edited.data["subject"] == "Your KaySetu code"
    assert edited.data["trigger_key"] == "OTP_LOGIN"
