from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("invoices", views.SalesInvoiceViewSet, basename="sales-invoices")
router.register("manual-invoices", views.ManualInvoiceViewSet, basename="manual-invoices")
router.register("payments", views.PaymentEntryViewSet, basename="sales-payments")
router.register("adjustments", views.AdjustmentNoteViewSet, basename="sales-adjustments")

urlpatterns = [path("sales/", include(router.urls))]
