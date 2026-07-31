"""Media-service wiring: user photo/KYC uploads and TA documents.

The point of these tests is the failure modes. Before this wiring the portal
posted `profile_image` as a multipart FILE while the model field is a URLField,
so the file was silently dropped and the user saved with no photo. Silence is
the bug worth pinning down.
"""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _png():
    return SimpleUploadedFile("photo.png", b"\x89PNG\r\n\x1a\n fake", content_type="image/png")


def test_upload_refused_loudly_when_service_unconfigured(api, make_tenant, tenant_token, settings):
    """No API key -> 503, not a silent save with an empty photo."""
    settings.IMAGE_SERVICE_API_KEY = ""
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]

    response = auth(api, token).post(
        "/api/t/users/",
        {"email": "a@acme.test", "full_name": "A", "password": "agent-pass-123",
         "profile_image": _png()},
        format="multipart",
    )
    assert response.status_code == 503, response.data
    assert "media service" in response.data["detail"].lower()


def test_uploads_become_urls_on_the_user(api, make_tenant, tenant_token, settings, monkeypatch):
    """A successful upload stores the service's URL on the URLField."""
    settings.IMAGE_SERVICE_API_KEY = "test-key"
    settings.IMAGE_SERVICE_URL = "https://img.kaysetu.in"

    seen = []

    def fake_upload(file_obj, section="general"):
        seen.append(section)
        return {"original_url": f"https://img.kaysetu.in/{section}/{file_obj.name}"}

    monkeypatch.setattr(
        "apps.foundation.media_service.upload_file_to_media_service", fake_upload
    )

    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    response = auth(api, token).post(
        "/api/t/users/",
        {
            "email": "b@acme.test", "full_name": "B", "password": "agent-pass-123",
            "profile_image": _png(),
            "aadhaar_card": SimpleUploadedFile("a.png", b"x", content_type="image/png"),
        },
        format="multipart",
    )
    assert response.status_code == 201, response.data
    assert response.data["profile_image"] == "https://img.kaysetu.in/users/profiles/photo.png"
    assert response.data["aadhaar_card"].startswith("https://img.kaysetu.in/users/kyc/aadhaar/")
    # Sections must match the previous platform's folder layout.
    assert set(seen) == {"users/profiles", "users/kyc/aadhaar"}


def test_upload_failure_does_not_create_the_user(api, make_tenant, tenant_token, settings, monkeypatch):
    """If the service rejects the file we must fail, not save a photo-less user."""
    settings.IMAGE_SERVICE_API_KEY = "test-key"
    monkeypatch.setattr(
        "apps.foundation.media_service.upload_file_to_media_service",
        lambda file_obj, section="general": None,
    )

    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]
    before = auth(api, token).get("/api/t/users/").data["count"]

    response = auth(api, token).post(
        "/api/t/users/",
        {"email": "c@acme.test", "full_name": "C", "password": "agent-pass-123",
         "profile_image": _png()},
        format="multipart",
    )
    assert response.status_code == 502
    after = auth(api, token).get("/api/t/users/").data["count"]
    assert after == before, "user must not be created when its KYC upload failed"


def test_json_requests_are_unaffected(api, make_tenant, tenant_token, settings):
    """No files in the request -> the media service is never consulted."""
    settings.IMAGE_SERVICE_API_KEY = ""   # would 503 if it were consulted
    tenant, _ = make_tenant(package_code="P2")
    token = tenant_token(tenant)["access"]

    response = auth(api, token).post(
        "/api/t/users/",
        {"email": "d@acme.test", "full_name": "D", "password": "agent-pass-123",
         "profile_image": "https://img.kaysetu.in/users/profiles/existing.png"},
    )
    assert response.status_code == 201, response.data
    assert response.data["profile_image"].endswith("existing.png")


def test_absolutise_leaves_full_urls_alone(settings):
    from apps.foundation.media import absolutise

    settings.MEDIA_BASE_URL = "https://img.kaysetu.in"
    assert absolutise("/media/x.png") == "https://img.kaysetu.in/media/x.png"
    assert absolutise("https://cdn.example/x.png") == "https://cdn.example/x.png"
    assert absolutise("") == ""

    settings.MEDIA_BASE_URL = ""
    assert absolutise("/media/x.png") == "/media/x.png"
