from django.urls import path

from . import views

# Mounted at /api/ by config.urls -> /api/analytics/...
urlpatterns = [
    path("analytics/sales/overview/", views.SalesOverviewView.as_view()),
    path("analytics/sales/by-customer/", views.SalesByCustomerView.as_view()),
    path("analytics/sales/reports/", views.SalesReportsView.as_view()),
    path("analytics/purchase/overview/", views.PurchaseOverviewView.as_view()),
    path("analytics/crm/leads-funnel/", views.CRMFunnelView.as_view()),
    path("analytics/field-sales/overview/", views.FieldSalesOverviewView.as_view()),
    path("analytics/sales-agent/overview/", views.SalesAgentOverviewView.as_view()),
    path("analytics/warehouse/stock-levels/", views.WarehouseStockLevelsView.as_view()),
    path("analytics/admin/dashboard/", views.AdminDashboardView.as_view()),
    path("analytics/admin/entity-detail/", views.AdminEntityDetailView.as_view()),
]
