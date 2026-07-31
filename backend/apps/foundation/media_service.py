"""External media service client (img.kaysetu.in).

Same contract as the previous platform so the running service needs no change:

    POST {IMAGE_SERVICE_URL}/upload/{section}
    headers: X-API-Key: {IMAGE_SERVICE_API_KEY}
    body:    multipart form field "file"
    -> {"original_url": "...", "processed_url": "...", ...}

Uploads go to the service and we store the returned URL on a URLField. That is
why the API keeps no uploaded bytes of its own: the backend runs as several
stateless replicas behind PgBouncer, so a file written to one container's disk
would 404 from the next one.

Every caller must treat a ``None`` return as "upload failed" and refuse to
silently save a record with no document — losing a KYC image without telling
anyone is worse than rejecting the request.
"""
import logging

from django.conf import settings

logger = logging.getLogger("kaysetu.media")

# Section names — keep in step with the previous platform so existing stored
# URLs and the service's folder layout stay consistent.
SECTION_USER_PROFILE = "users/profiles"
SECTION_USER_AADHAAR = "users/kyc/aadhaar"
SECTION_USER_PAN = "users/kyc/pan"
SECTION_COMPANIES = "companies"
SECTION_CUSTOMERS = "customers"
SECTION_VISIT_SELFIE = "visits/selfies"
SECTION_VISIT_SHOP = "visits/shop_images"
SECTION_VISIT_VOICE = "visits/voice_notes"
SECTION_ATTENDANCE = "attendance"
SECTION_TRAVEL_ALLOWANCE = "travel-allowance"


def is_configured() -> bool:
    """True when an API key is present. Without one the service rejects us, so
    callers fall back to local storage rather than dropping the file."""
    return bool(settings.IMAGE_SERVICE_API_KEY)


def upload_file_to_media_service(file_obj, section: str = "general"):
    """Upload one file; returns the service's JSON dict, or None on failure.

    ``file_obj`` is a Django UploadedFile (has .name/.content_type/.read()).
    """
    if not is_configured():
        logger.warning("IMAGE_SERVICE_API_KEY is not set — skipping upload to %s", section)
        return None

    import requests  # imported lazily so the module is importable without the dep

    url = f"{settings.IMAGE_SERVICE_URL}/upload/{section}"
    try:
        file_obj.seek(0)
    except (AttributeError, OSError):
        pass
    try:
        response = requests.post(
            url,
            headers={"X-API-Key": settings.IMAGE_SERVICE_API_KEY},
            files={"file": (file_obj.name, file_obj, getattr(file_obj, "content_type", None))},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except Exception as error:  # noqa: BLE001 — network/parse failures are all "upload failed"
        logger.error("media service upload failed (%s): %s", section, error)
        return None


def upload_and_get_url(file_obj, section: str) -> str:
    """Upload and return the stored URL ("" when the upload failed)."""
    payload = upload_file_to_media_service(file_obj, section=section)
    if not payload:
        return ""
    return payload.get("original_url") or payload.get("processed_url") or ""
