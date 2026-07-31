"""Media URL helper.

Every media URL the API returns goes through :func:`media_url` so the host is
decided in ONE place by ``MEDIA_BASE_URL`` (img.kaysetu.in in production).

Why this exists: a relative ``/media/x.jpg`` is unresolvable to the mobile app
and to a portal served from a different origin — the browser resolves it against
the *frontend* host, not the API. Absolutising here fixes every consumer at once
and lets the delivery host move to a CDN by changing one env var.
"""
from django.conf import settings


def media_url(file_field) -> str:
    """Absolute URL for a FileField/ImageField value ("" when unset).

    Accepts the field object (not the raw path) because an unset FileField
    raises ValueError on ``.url`` rather than returning falsy.
    """
    if not file_field:
        return ""
    try:
        path = file_field.url
    except ValueError:
        return ""
    return absolutise(path)


def absolutise(path: str) -> str:
    """Prefix a stored media path with the delivery host.

    Already-absolute URLs pass through untouched — user photo/document fields
    are URLFields that may already hold a full URL from the image service.
    """
    if not path:
        return ""
    if path.startswith(("http://", "https://", "//")):
        return path
    base = settings.MEDIA_BASE_URL
    if not base:
        return path
    return f"{base}/{path.lstrip('/')}"
