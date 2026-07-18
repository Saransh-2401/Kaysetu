from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("policies", views.PolicyConfigViewSet, basename="ta-policies")
router.register("trips", views.TripViewSet, basename="ta-trips")
router.register("claims", views.AllowanceClaimViewSet, basename="ta-claims")
# Alias matching the imported portal's Old Project path (/travel-allowance/requests/),
# so repointing that service is a single prefix change (/travel-allowance -> /t/ta).
router.register("requests", views.AllowanceClaimViewSet, basename="ta-requests-alias")

urlpatterns = [
    path("t/ta/", include(router.urls)),
]
