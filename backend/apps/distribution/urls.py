from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("stock-requests", views.StockRequestViewSet, basename="dist-requests")
router.register("invoices", views.DistributorInvoiceViewSet, basename="dist-invoices")
router.register("distributor-stock", views.DistributorStockViewSet, basename="dist-stock")
# Aliases matching the imported portal's Old Project paths, so repointing that
# service is a single prefix change (/distributor-inventory -> /t/dist).
router.register("shortages", views.StockRequestShortageViewSet, basename="dist-shortages")
router.register("adjustments", views.DistributorAdjustmentViewSet, basename="dist-adjustments")
router.register("requests", views.StockRequestViewSet, basename="dist-requests-alias")
router.register("inventory", views.DistributorStockViewSet, basename="dist-stock-alias")

urlpatterns = [
    path("t/dist/", include(router.urls)),
]
