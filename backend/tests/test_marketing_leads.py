"""Marketing lead capture: public endpoint hardening + the ops queue.

The public endpoint is unauthenticated, so most of these tests are about what
it REFUSES to do — the happy path is the easy part.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.marketing.models import Lead
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")

CONTACT = {
    "name": "Asha Nair",
    "email": "Asha@Acme.CO.IN",
    "phone": "9876543210",
    "company": "Acme Distributors",
    "message": "We run 40 field agents and want a demo.",
    "source": "contact_form",
}


def test_public_lead_is_captured(api):
    response = api.post("/api/public/leads", CONTACT)
    assert response.status_code == 201, response.data
    # The response must not echo anything back — no id, no stored values.
    assert response.data == {"status": "received"}

    lead = Lead.objects.get()
    assert lead.email == "asha@acme.co.in"          # normalised
    assert lead.name == "Asha Nair"
    assert lead.company == "Acme Distributors"
    assert lead.status == Lead.Status.NEW
    assert lead.reference.startswith("LEAD-")


def test_validation_rejects_junk(api):
    bad = api.post("/api/public/leads", {"name": "", "email": "not-an-email"})
    assert bad.status_code == 400
    assert "name" in bad.data and "email" in bad.data
    assert Lead.objects.count() == 0


def test_honeypot_is_silently_swallowed(api):
    """A bot filling the hidden field gets 201 but nothing is stored."""
    payload = {**CONTACT, "website": "http://spam.example"}
    response = api.post("/api/public/leads", payload)
    assert response.status_code == 201
    assert Lead.objects.count() == 0


def test_unknown_source_falls_back_instead_of_erroring(api):
    """A stale/renamed CTA must never lose the lead over a bad enum."""
    response = api.post("/api/public/leads", {**CONTACT, "source": "billboard"})
    assert response.status_code == 201
    assert Lead.objects.get().source == Lead.Source.OTHER


def test_attribution_and_forensics_are_recorded(api):
    response = api.post(
        "/api/public/leads",
        {**CONTACT, "utm_source": "google", "utm_campaign": "q3-fmcg",
         "page_url": "https://kaysetu.in/industries/fmcg"},
        HTTP_USER_AGENT="pytest-agent",
    )
    assert response.status_code == 201
    lead = Lead.objects.get()
    assert lead.utm_source == "google"
    assert lead.utm_campaign == "q3-fmcg"
    assert lead.page_url.endswith("/industries/fmcg")
    assert lead.user_agent == "pytest-agent"
    assert lead.ip_address is not None


def test_oversized_attachment_rejected(api, settings):
    settings.IMAGE_SERVICE_API_KEY = "k"
    big = SimpleUploadedFile("big.pdf", b"x" * (5 * 1024 * 1024 + 1), content_type="application/pdf")
    response = api.post("/api/public/leads", {**CONTACT, "attachment": big}, format="multipart")
    assert response.status_code == 400
    assert "attachment" in response.data
    assert Lead.objects.count() == 0


def test_wrong_attachment_type_rejected(api, settings):
    settings.IMAGE_SERVICE_API_KEY = "k"
    exe = SimpleUploadedFile("x.exe", b"MZ", content_type="application/x-msdownload")
    response = api.post("/api/public/leads", {**CONTACT, "attachment": exe}, format="multipart")
    assert response.status_code == 400
    assert Lead.objects.count() == 0


def test_attachment_upload_failure_still_keeps_the_lead(api, settings, monkeypatch):
    """Losing the file is bad; losing the whole enquiry is worse."""
    settings.IMAGE_SERVICE_API_KEY = "k"
    monkeypatch.setattr(
        "apps.foundation.media_service.upload_file_to_media_service",
        lambda file_obj, section="general": None,
    )
    png = SimpleUploadedFile("a.png", b"\x89PNG", content_type="image/png")
    response = api.post("/api/public/leads", {**CONTACT, "attachment": png}, format="multipart")
    assert response.status_code == 201
    lead = Lead.objects.get()
    assert lead.attachment_url == ""
    assert lead.message.startswith("We run 40")


def test_throttled_after_the_hourly_limit(api):
    """Bulk spam from one IP gets cut off."""
    codes = [api.post("/api/public/leads", CONTACT).status_code for _ in range(12)]
    assert 429 in codes, codes
    assert codes.count(201) <= 10


def test_tenant_token_cannot_read_the_lead_queue(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/sa/leads").status_code == 403


def test_ops_workflow_list_assign_note_convert(api, admin_token, superadmin, make_tenant):
    api.post("/api/public/leads", CONTACT)
    api.credentials()  # drop any auth left on the shared client
    lead_id = Lead.objects.get().pk

    listing = auth(api, admin_token).get("/api/sa/leads")
    assert listing.status_code == 200
    assert listing.data[0]["email"] == "asha@acme.co.in"
    assert listing.data[0]["reference"].startswith("LEAD-")

    summary = auth(api, admin_token).get("/api/sa/leads/summary")
    assert summary.data["new"] == 1 and summary.data["needs_attention"] == 1

    # Assign + mark contacted (stamps contacted_at once)
    updated = auth(api, admin_token).post(
        f"/api/sa/leads/{lead_id}/update",
        {"status": "contacted", "assigned_to_id": superadmin.pk},
    )
    assert updated.status_code == 200, updated.data
    assert updated.data["status"] == "contacted"
    assert updated.data["assigned_to"]["id"] == superadmin.pk
    assert updated.data["contacted_at"] is not None

    # Internal note
    noted = auth(api, admin_token).post(
        f"/api/sa/leads/{lead_id}/note", {"body": "Called — wants pricing for 40 seats."}
    )
    assert noted.status_code == 200
    assert noted.data["notes"][0]["body"].startswith("Called")

    # Convert to a real tenant
    tenant, _ = make_tenant(package_code="P3")
    converted = auth(api, admin_token).post(
        f"/api/sa/leads/{lead_id}/update", {"converted_org_code": tenant.org_code}
    )
    assert converted.data["status"] == "converted"
    assert converted.data["converted_tenant"]["org_code"] == tenant.org_code

    bad = auth(api, admin_token).post(
        f"/api/sa/leads/{lead_id}/update", {"converted_org_code": "KST-NOPE99"}
    )
    assert bad.status_code == 400


def test_ops_filters(api, admin_token):
    api.post("/api/public/leads", CONTACT)
    api.post("/api/public/leads", {**CONTACT, "email": "b@x.com", "source": "footer_demo",
                                   "company": "Zeta Foods"})
    api.credentials()

    footer = auth(api, admin_token).get("/api/sa/leads", {"source": "footer_demo"})
    assert len(footer.data) == 1

    search = auth(api, admin_token).get("/api/sa/leads", {"q": "Zeta"})
    assert len(search.data) == 1
    assert search.data[0]["company"] == "Zeta Foods"
