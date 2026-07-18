from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("suppliers", views.SupplierViewSet, basename="purch-suppliers")
router.register("material-requests", views.MaterialRequestViewSet, basename="purch-mr")
router.register("purchase-orders", views.PurchaseOrderViewSet, basename="purch-po")
router.register("goods-receipts", views.GoodsReceiptViewSet, basename="purch-grn")
router.register("bills", views.PurchaseBillViewSet, basename="purch-bills")

urlpatterns = [
    path("t/purchase/", include(router.urls)),
]
