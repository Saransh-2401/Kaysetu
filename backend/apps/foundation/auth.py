"""
JWT auth for both planes.

One token format, two scopes:
  scope="control" -> Salexa staff (control.AdminUser, default DB)
  scope="tenant"  -> tenant user; the `tid` claim selects the tenant, whose
                     DB context is activated before loading foundation.TenantUser.
"""
from datetime import datetime, timezone as dt_timezone

import jwt
from django.conf import settings
from rest_framework import authentication, exceptions

SCOPE_CONTROL = "control"
SCOPE_TENANT = "tenant"


def _encode(payload: dict, ttl) -> str:
    now = datetime.now(dt_timezone.utc)
    payload = {**payload, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise exceptions.AuthenticationFailed("token_expired")
    except jwt.InvalidTokenError:
        raise exceptions.AuthenticationFailed("token_invalid")


def make_token_pair(*, sub: int, scope: str, tid: int | None = None) -> dict:
    claims = {"sub": str(sub), "scope": scope}
    if tid is not None:
        claims["tid"] = tid
    return {
        "access": _encode({**claims, "type": "access"}, settings.JWT_ACCESS_TTL),
        "refresh": _encode({**claims, "type": "refresh"}, settings.JWT_REFRESH_TTL),
    }


def resolve_user(payload: dict):
    """Load the user for a decoded token payload; sets tenant context for tenant scope."""
    from apps.control.models import AdminUser, Tenant
    from apps.tenancy.context import set_tenant

    scope = payload.get("scope")
    sub = payload.get("sub")

    if scope == SCOPE_CONTROL:
        user = AdminUser.objects.filter(pk=sub, is_active=True).first()
        if user is None:
            raise exceptions.AuthenticationFailed("admin_not_found")
        return user

    if scope == SCOPE_TENANT:
        tenant = Tenant.objects.filter(pk=payload.get("tid")).first()
        if tenant is None:
            raise exceptions.AuthenticationFailed("tenant_not_found")
        if not tenant.can_login():
            raise exceptions.AuthenticationFailed(f"tenant_{tenant.status}")
        set_tenant(tenant)

        from apps.foundation.models import TenantUser

        user = TenantUser.objects.filter(pk=sub, is_active=True).first()
        if user is None:
            raise exceptions.AuthenticationFailed("user_not_found")
        return user

    raise exceptions.AuthenticationFailed("bad_scope")


class JWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header or not header.lower().startswith("bearer "):
            return None
        payload = decode_token(header.split(" ", 1)[1].strip())
        if payload.get("type") != "access":
            raise exceptions.AuthenticationFailed("not_an_access_token")
        user = resolve_user(payload)
        return (user, payload)

    def authenticate_header(self, request):
        return self.keyword
