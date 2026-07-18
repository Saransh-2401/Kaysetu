from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("stock-requests", views.StockRequestViewSet, basename="dist-requests")
router.register("invoices", views.DistributorInvoiceViewSet, basename="dist-invoices")
router.register("distributor-stock", views.DistributorStockViewSet, basename="dist-stock")

urlpatterns = [
    path("t/dist/", include(router.urls)),
]
