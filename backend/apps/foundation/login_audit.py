"""
Login audit — record every tenant login attempt into the tenant DB.

Called from the login view. Deliberately best-effort: an audit-write failure
must NEVER stop someone logging in, so every call is wrapped and swallowed.
"""
import logging

logger = logging.getLogger("kaysetu.foundation")

# User-agent fragments the mobile app sends. Anything else is treated as web.
_MOBILE_MARKERS = ("dart", "okhttp", "flutter", "kaysetu-app", "cfnetwork")


def client_ip(request):
    """The caller's IP, preferring the proxy-forwarded address (we sit behind
    pgbouncer/a reverse proxy in every real deployment)."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (request.META.get("REMOTE_ADDR") or "")[:64]


def _platform(request):
    explicit = (request.META.get("HTTP_X_CLIENT_PLATFORM") or "").strip().lower()
    if explicit in ("web", "mobile"):
        return explicit
    ua = (request.META.get("HTTP_USER_AGENT") or "").lower()
    return "mobile" if any(m in ua for m in _MOBILE_MARKERS) else "web"


def record_login(request, *, user=None, username_attempted="", success=True,
                 event=None, method="password", detail=""):
    """Write one LoginActivity row in the CURRENT tenant context.

    Must be called inside `use_tenant(...)` — the row lives in the tenant DB.
    Never raises: auditing is not allowed to break authentication.
    """
    from .models import LoginActivity

    try:
        role = getattr(getattr(user, "role", None), "slug", "") or ""
        LoginActivity.objects.create(
            user=user if (user and getattr(user, "pk", None)) else None,
            user_name=(getattr(user, "full_name", "") or username_attempted),
            username_attempted=username_attempted,
            user_role=role,
            event=event or (LoginActivity.Event.LOGIN if success else LoginActivity.Event.FAILED),
            success=success,
            method=method,
            platform=_platform(request),
            ip_address=client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:400],
            detail=detail,
        )
    except Exception:   # noqa: BLE001 — auditing must never block a login
        logger.exception("failed to record login activity")
