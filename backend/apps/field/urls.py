from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("visits", views.VisitViewSet, basename="field-visits")
router.register("targets", views.SalesTargetViewSet, basename="field-targets")
router.register("orders", views.FieldOrderViewSet, basename="field-orders")
router.register("collections", views.CollectionViewSet, basename="field-collections")

urlpatterns = [
    path("t/field/", include(router.urls)),
]
