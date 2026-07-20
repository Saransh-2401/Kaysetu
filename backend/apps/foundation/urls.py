from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import catalog_compat, config_views, masters_views, views

router = DefaultRouter()
router.register("users", views.TenantUserViewSet, basename="tenant-users")
router.register("roles", views.RoleViewSet, basename="tenant-roles")
router.register("catalog", views.CatalogItemViewSet, basename="tenant-catalog")
router.register("parties", views.PartyViewSet, basename="tenant-parties")

# Tenant configuration — platform-core, mounted under /core/ where the ported
# admin screens expect it.
config_router = DefaultRouter()
config_router.register("companies", config_views.CompanyViewSet, basename="core-companies")
config_router.register("email-templates", config_views.EmailTemplateViewSet,
                       basename="core-email-templates")
config_router.register("sms-templates", config_views.SMSTemplateViewSet,
                       basename="core-sms-templates")
config_router.register("app-versions", config_views.AppVersionViewSet,
                       basename="core-app-versions")
config_router.register("role-quick-links", config_views.RoleQuickLinkViewSet,
                       basename="core-role-quick-links")
config_router.register("quick-links", config_views.QuickLinkViewSet, basename="core-quick-links")
config_router.register("roles", config_views.RoleConfigViewSet, basename="core-roles")

# Masters — shared reference data (units, GST slabs).
masters_router = DefaultRouter()
masters_router.register("uom", masters_views.UOMViewSet, basename="masters-uom")
masters_router.register("tax-slabs", masters_views.TaxSlabViewSet, basename="masters-tax-slabs")

# Warehouse-catalog compatibility: the ported screens call /warehouse/items/ and
# /warehouse/products/ for what is one CatalogItem table here.
warehouse_router = DefaultRouter()
warehouse_router.register("items", catalog_compat.WarehouseItemViewSet,
                          basename="warehouse-items")
warehouse_router.register("products", catalog_compat.WarehouseItemViewSet,
                          basename="warehouse-products")

urlpatterns = [
    path("auth/tenant/login", views.TenantLoginView.as_view()),
    path("auth/refresh", views.RefreshView.as_view()),
    path("me", views.MeView.as_view()),
    # Portal (Old Project) compatibility endpoints
    path("auth/users/me/", views.LegacyProfileView.as_view()),
    path("auth/users/<int:pk>/change_password/", views.ChangePasswordView.as_view()),
    # Assignment pickers the ported forms populate their dropdowns from.
    path("auth/assigned-sales-agents/", config_views.AssignedSalesAgentsView.as_view()),
    path("auth/assigned-sales-managers/", config_views.AssignedSalesManagersView.as_view()),
    path("auth/assigned-distributors/", config_views.AssignedDistributorsView.as_view()),
    path("core/role-permissions/me/", views.RolePermissionsMeView.as_view()),
    path("t/org", views.OrgSettingsView.as_view()),
    # Portal-compat: invoice/PO headers read the company profile from here
    path("core/companies/current/", views.CurrentCompanyView.as_view()),
    path("core/role-permissions/", config_views.RolePermissionMatrixView.as_view()),
    path("core/role-permissions/bulk/", config_views.RolePermissionMatrixView.as_view()),
    path("core/email-config/", config_views.EmailConfigView.as_view()),
    path("core/email-config/verify/", config_views.EmailConfigVerifyView.as_view()),
    path("core/email-config/send_test/", config_views.EmailConfigSendTestView.as_view()),
    path("core/sms-config/", config_views.SMSConfigView.as_view()),
    path("core/", include(config_router.urls)),
    path("masters/", include(masters_router.urls)),
    path("warehouse/", include(warehouse_router.urls)),
    # Event outbox: what failed to deliver, and a manual replay
    path("t/event-deliveries", views.EventDeliveryView.as_view()),
    path("t/event-deliveries/retry", views.EventDeliveryView.as_view()),
    path("t/", include(router.urls)),
    # Module gate pings (entitlement smoke checks)
    path("t/track/ping", views.ModulePingView.as_view(module_code="TRACK")),
    path("t/field/ping", views.ModulePingView.as_view(module_code="FIELD")),
    path("t/orders/ping", views.ModulePingView.as_view(module_code="ORDERS")),
    path("t/books/ping", views.ModulePingView.as_view(module_code="BOOKS")),
]
