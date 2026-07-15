"""
Tenant context — a contextvar holding the currently-active control-plane
Tenant. The DB router refuses to touch tenant-plane models while this is
unset, which is the hard isolation guard: no code path can accidentally
read another tenant's data by "forgetting" the tenant.
"""
from contextlib import contextmanager
import contextvars

_current_tenant = contextvars.ContextVar("salexa_current_tenant", default=None)


class TenantContextError(Exception):
    """A tenant-plane model was accessed with no tenant in context."""


def set_tenant(tenant):
    _current_tenant.set(tenant)


def get_tenant():
    return _current_tenant.get()


def clear_tenant():
    _current_tenant.set(None)


def require_tenant():
    tenant = get_tenant()
    if tenant is None:
        raise TenantContextError(
            "Tenant-plane data was accessed without an active tenant context. "
            "Wrap the call in `with use_tenant(tenant):` or authenticate with a tenant token."
        )
    return tenant


@contextmanager
def use_tenant(tenant):
    token = _current_tenant.set(tenant)
    try:
        yield tenant
    finally:
        _current_tenant.reset(token)
