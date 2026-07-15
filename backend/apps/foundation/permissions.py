"""DRF permissions for scope + module entitlement gating."""
from rest_framework.permissions import BasePermission

from .auth import SCOPE_CONTROL, SCOPE_TENANT
from .models import EntitlementSnapshot


def _scope(request):
    return (request.auth or {}).get("scope") if isinstance(request.auth, dict) else None


class IsControlAdmin(BasePermission):
    message = "SuperAdmin access required."

    def has_permission(self, request, view):
        return _scope(request) == SCOPE_CONTROL


class IsTenantUser(BasePermission):
    message = "Tenant access required."

    def has_permission(self, request, view):
        return _scope(request) == SCOPE_TENANT


def get_entitled_modules(request) -> list[str]:
    """Entitlements for the request's tenant, cached per request."""
    cached = getattr(request, "_entitled_modules", None)
    if cached is None:
        cached = EntitlementSnapshot.current_modules()
        request._entitled_modules = cached
    return cached


def HasModule(module_code: str):
    """Permission factory: tenant scope AND the module is entitled."""

    class _HasModule(BasePermission):
        message = f"The '{module_code}' module is not enabled for this organization."

        def has_permission(self, request, view):
            if _scope(request) != SCOPE_TENANT:
                return False
            return module_code in get_entitled_modules(request)

    _HasModule.__name__ = f"HasModule_{module_code}"
    return _HasModule
