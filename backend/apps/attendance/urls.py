from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("attendance", views.AttendanceViewSet, basename="att-attendance")
router.register("leave-requests", views.LeaveRequestViewSet, basename="att-leave")
router.register("leave-types", views.LeaveTypeViewSet, basename="att-leave-types")
router.register("holidays", views.HolidayViewSet, basename="att-holidays")

urlpatterns = [
    path("t/att/", include(router.urls)),
    path("t/att/working-days", views.WorkingDaysView.as_view()),

    # ---- portal aliases -------------------------------------------------
    # The imported office-attendance admin screen calls the previous
    # platform's /office-attendance/… paths; serve them off the same
    # AttendanceViewSet actions so that UI works untouched.
    path("office-attendance/by-date/",
         views.AttendanceViewSet.as_view({"get": "by_date"})),
    path("office-attendance/<int:pk>/admin-checkout/",
         views.AttendanceViewSet.as_view({"post": "admin_checkout"})),
    path("office-attendance/<int:pk>/admin-edit/",
         views.AttendanceViewSet.as_view({"patch": "admin_edit"})),
    path("office-attendance/<int:pk>/logs/",
         views.AttendanceViewSet.as_view({"get": "logs"})),
]
