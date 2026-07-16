from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("warehouses", views.WarehouseViewSet, basename="warehouses")
router.register("stock-levels", views.StockLevelViewSet, basename="stock-levels")
router.register("stock-ledger", views.StockLedgerViewSet, basename="stock-ledger")

urlpatterns = [
    path("t/inv/", include(router.urls)),
    path("t/inv/receive", views.StockOpsView.as_view(), {"op": "receive"}),
    path("t/inv/adjust", views.StockOpsView.as_view(), {"op": "adjust"}),
    path("t/inv/transfer", views.StockOpsView.as_view(), {"op": "transfer"}),
]
