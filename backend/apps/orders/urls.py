from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("sales-orders", views.SalesOrderViewSet, basename="sales-orders")
router.register("pick-lists", views.PickListViewSet, basename="pick-lists")
router.register("delivery-notes", views.DeliveryNoteViewSet, basename="delivery-notes")

urlpatterns = [
    path("t/", include(router.urls)),
]
