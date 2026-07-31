from django.urls import include, path

urlpatterns = [
    path("api/", include("apps.control.urls")),
    path("api/", include("apps.foundation.urls")),
    path("api/", include("apps.billing.urls")),
    path("api/", include("apps.support.urls")),
    path("api/", include("apps.marketing.urls")),
    path("api/", include("apps.tracking.urls")),
    path("api/", include("apps.field.urls")),
    path("api/", include("apps.crm.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.inventory.urls")),
    path("api/", include("apps.books.urls")),
    path("api/", include("apps.purchase.urls")),
    path("api/", include("apps.distribution.urls")),
    path("api/", include("apps.production.urls")),
    path("api/", include("apps.attendance.urls")),
    path("api/", include("apps.travel.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.sales.urls")),
    path("api/", include("apps.analytics.urls")),
]
