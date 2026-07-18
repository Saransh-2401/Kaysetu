from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("policies", views.PolicyConfigViewSet, basename="ta-policies")
router.register("trips", views.TripViewSet, basename="ta-trips")
router.register("claims", views.AllowanceClaimViewSet, basename="ta-claims")

urlpatterns = [
    path("t/ta/", include(router.urls)),
]
