"""
Analytics API. Served at /api/analytics/ — the ported dashboards call it without
the /t/ segment, and tenant selection comes from the JWT rather than the path,
so the prefix is cosmetic.

Not package-gated as a whole: every tenant gets a dashboard, and each BLOCK
inside it degrades to zero when the module feeding it isn't entitled. Gating the
endpoint instead would show a smaller tenant an error page where their own
figures should be.
"""
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.foundation.auth import SCOPE_TENANT

from . import dashboard, services


class IsTenantMember(BasePermission):
    message = "Tenant access required."

    def has_permission(self, request, view):
        auth = request.auth if isinstance(request.auth, dict) else {}
        return auth.get("scope") == SCOPE_TENANT


class IsManagerOrAdmin(IsTenantMember):
    """Company-wide dashboards are a management view. An agent asking for the
    admin dashboard would otherwise see every colleague's numbers."""

    message = "Manager access required."
    ALLOWED = {"admin", "sales_manager", "field_manager", "accounts", "accounts_officer"}

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        user = request.user
        role = getattr(getattr(user, "role", None), "slug", "")
        return bool(getattr(user, "is_owner", False) or role in self.ALLOWED)


class _Report(APIView):
    """One report = one callable taking (query_params, user)."""

    permission_classes = [IsTenantMember]
    report = None

    def get(self, request):
        return Response(self.report(request.query_params, request.user))


class SalesOverviewView(_Report):
    report = staticmethod(services.sales_overview)


class SalesByCustomerView(_Report):
    report = staticmethod(services.sales_by_customer)


class SalesReportsView(_Report):
    permission_classes = [IsManagerOrAdmin]
    report = staticmethod(services.sales_reports)


class PurchaseOverviewView(_Report):
    report = staticmethod(services.purchase_overview)


class CRMFunnelView(_Report):
    report = staticmethod(services.crm_funnel)


class FieldSalesOverviewView(_Report):
    report = staticmethod(services.field_sales_overview)


class SalesAgentOverviewView(_Report):
    """An agent's own numbers — deliberately NOT manager-gated. Requesting
    someone else's is checked inside the service."""

    report = staticmethod(services.sales_agent_overview)


class WarehouseStockLevelsView(_Report):
    report = staticmethod(services.warehouse_stock_levels)


class AdminDashboardView(_Report):
    permission_classes = [IsManagerOrAdmin]
    report = staticmethod(dashboard.admin_dashboard)


class AdminEntityDetailView(APIView):
    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        data, error = dashboard.entity_detail(request.query_params, request.user)
        if error is not None:
            return Response(error, status=404 if "not found" in error["detail"].lower() else 400)
        return Response(data)
