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
]
