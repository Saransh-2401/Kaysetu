from django.urls import path

from . import views

# All under /api/t/track/ (mounted at /api/ by config.urls). No trailing slashes
# on these APIView paths — matches the foundation convention.
urlpatterns = [
    path("t/track/punch-in", views.PunchInView.as_view()),
    path("t/track/punch-out", views.PunchOutView.as_view()),
    path("t/track/track-location", views.TrackLocationView.as_view()),
    path("t/track/status", views.StatusView.as_view()),
    path("t/track/heartbeat", views.HeartbeatView.as_view()),
    path("t/track/device-diagnostics", views.DeviceDiagnosticsView.as_view()),
    path("t/track/current-location", views.CurrentLocationView.as_view()),
    path("t/track/day-route", views.DayRouteView.as_view()),
    path("t/track/live", views.LiveAgentsView.as_view()),
    path("t/track/tracking-health", views.TrackingHealthView.as_view()),
    path("t/track/attendance", views.AdminAttendanceView.as_view()),
    path("t/track/attendance/<int:pk>/checkout", views.AdminCheckoutView.as_view()),
    path("t/track/route-history", views.RouteHistoryView.as_view()),
    path("t/track/settings", views.TrackingSettingsView.as_view()),
    path("t/track/attendance/<int:pk>/edit", views.AdminAttendanceEditView.as_view()),
    path("t/track/attendance/<int:pk>/logs", views.AdminAttendanceLogsView.as_view()),
    path("t/track/attendance/edit", views.AdminAttendanceEditView.as_view()),

    # ---- portal aliases -------------------------------------------------
    # The imported field-sales screens call the previous platform's paths.
    # Serving them as aliases keeps that UI untouched; the canonical paths
    # above are unchanged.
    path("field-sales/admin-attendance/", views.AdminAttendanceListView.as_view()),
    path("field-sales/admin-attendance/edit/", views.AdminAttendanceEditView.as_view()),
    path("field-sales/admin-attendance/<int:pk>/edit/", views.AdminAttendanceEditView.as_view()),
    path("field-sales/admin-attendance/<int:pk>/logs/", views.AdminAttendanceLogsView.as_view()),
    path("field-sales/admin-checkout/<int:pk>/", views.AdminCheckoutView.as_view()),
    path("field-sales/daily-reports/current-location/", views.CurrentLocationView.as_view()),
    path("field-sales/daily-reports/day-route/", views.DayRouteView.as_view()),
    path("field-sales/locations/", views.TrackLocationView.as_view()),
]
