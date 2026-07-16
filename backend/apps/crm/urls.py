from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("leads", views.LeadViewSet, basename="crm-leads")

urlpatterns = [
    path("t/crm/", include(router.urls)),
]
