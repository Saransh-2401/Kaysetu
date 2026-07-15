from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("users", views.TenantUserViewSet, basename="tenant-users")
router.register("roles", views.RoleViewSet, basename="tenant-roles")
router.register("catalog", views.CatalogItemViewSet, basename="tenant-catalog")
router.register("parties", views.PartyViewSet, basename="tenant-parties")

urlpatterns = [
    path("auth/tenant/login", views.TenantLoginView.as_view()),
    path("auth/refresh", views.RefreshView.as_view()),
    path("me", views.MeView.as_view()),
    path("t/", include(router.urls)),
    # Module gate pings (entitlement smoke checks)
    path("t/track/ping", views.ModulePingView.as_view(module_code="TRACK")),
    path("t/field/ping", views.ModulePingView.as_view(module_code="FIELD")),
    path("t/orders/ping", views.ModulePingView.as_view(module_code="ORDERS")),
    path("t/books/ping", views.ModulePingView.as_view(module_code="BOOKS")),
]
