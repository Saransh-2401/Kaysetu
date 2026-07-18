from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("feed", views.NotificationFeedViewSet, basename="notif-feed")
router.register("broadcast", views.BroadcastViewSet, basename="notif-broadcast")

urlpatterns = [
    # Paths match the imported portal exactly — its notification screens needed
    # no repointing. Notifications are CORE, so there is no /t/<module>/ prefix.
    path("notifications/events/", views.EventCatalogView.as_view()),
    path("notifications/my-preferences/", views.MyPreferencesView.as_view()),
    path("notifications/role-defaults/", views.RoleDefaultsView.as_view()),
    path("notifications/", include(router.urls)),
]
