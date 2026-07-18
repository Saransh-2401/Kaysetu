from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("boms", views.BOMViewSet, basename="prod-boms")
router.register("work-orders", views.WorkOrderViewSet, basename="prod-work-orders")

urlpatterns = [
    path("t/prod/", include(router.urls)),
]
