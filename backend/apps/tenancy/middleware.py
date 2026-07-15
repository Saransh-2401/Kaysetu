"""
Request-scoped tenant context.

The authoritative tenant source is the JWT `tid` claim (set during DRF
authentication). This middleware only (a) guarantees a clean context per
request and (b) pre-resolves an `X-Org-Code` header so unauthenticated
endpoints (tenant login) know which tenant DB to talk to.
"""
from .context import clear_tenant, set_tenant


class TenantContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        clear_tenant()
        org_code = request.headers.get("X-Org-Code")
        if org_code:
            from apps.control.models import Tenant

            tenant = Tenant.objects.filter(org_code__iexact=org_code.strip()).first()
            if tenant is not None:
                set_tenant(tenant)
        try:
            return self.get_response(request)
        finally:
            clear_tenant()
