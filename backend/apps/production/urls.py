from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("boms", views.BOMViewSet, basename="prod-boms")
router.register("work-orders", views.WorkOrderViewSet, basename="prod-work-orders")
# Alias matching the imported portal's Old Project path (/production/bom/), so
# repointing that service is a single prefix change (/production -> /t/prod).
router.register("bom", views.BOMViewSet, basename="prod-boms-alias")

urlpatterns = [
    path("t/prod/", include(router.urls)),
]
