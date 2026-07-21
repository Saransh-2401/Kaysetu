from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views, warehouse_compat

router = DefaultRouter()
router.register("warehouses", views.WarehouseViewSet, basename="warehouses")
router.register("stock-levels", views.StockLevelViewSet, basename="stock-levels")
router.register("stock-ledger", views.StockLedgerViewSet, basename="stock-ledger")

urlpatterns = [
    path("t/inv/", include(router.urls)),
    path("t/inv/receive", views.StockOpsView.as_view(), {"op": "receive"}),
    path("t/inv/adjust", views.StockOpsView.as_view(), {"op": "adjust"}),
    path("t/inv/transfer", views.StockOpsView.as_view(), {"op": "transfer"}),

    # ---- portal alias -------------------------------------------------
    # The ported Stock Adjustments screen speaks the old warehouse document
    # API; back it with the INV ledger. (foundation also mounts /warehouse/
    # for items/products — Django backtracks to here for stock-entries.)
    path("warehouse/stock-entries/", warehouse_compat.StockEntryCompatView.as_view()),
    path("warehouse/stock-entries/<int:pk>/submit/", warehouse_compat.StockEntrySubmitView.as_view()),
]
