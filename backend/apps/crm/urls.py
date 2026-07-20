from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("leads", views.LeadViewSet, basename="crm-leads")
router.register("quotations", views.QuotationViewSet, basename="crm-quotations")

urlpatterns = [
    path("t/crm/", include(router.urls)),
    # Portal alias: the ported CRM screens call /crm/ without the /t/ segment.
    path("crm/", include((router.urls, "crm"), namespace="crm-compat")),
]
