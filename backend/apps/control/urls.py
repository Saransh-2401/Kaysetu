from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("tenants", views.TenantViewSet, basename="sa-tenants")
router.register("packages", views.PackageViewSet, basename="sa-packages")
router.register("modules", views.ModuleDefViewSet, basename="sa-modules")
router.register("provisioning-jobs", views.ProvisioningJobViewSet, basename="sa-jobs")

urlpatterns = [
    path("health", views.HealthView.as_view()),
    path("public/packages", views.PublicPackagesView.as_view()),
    path("public/signup", views.SignupView.as_view()),
    path("public/signup-status", views.SignupStatusView.as_view()),
    path("auth/admin/login", views.AdminLoginView.as_view()),
    path("sa/stats", views.StatsView.as_view()),
    path("sa/", include(router.urls)),
]
