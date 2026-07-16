from django.urls import include, path

urlpatterns = [
    path("api/", include("apps.control.urls")),
    path("api/", include("apps.foundation.urls")),
    path("api/", include("apps.billing.urls")),
    path("api/", include("apps.tracking.urls")),
    path("api/", include("apps.field.urls")),
    path("api/", include("apps.crm.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.inventory.urls")),
]
