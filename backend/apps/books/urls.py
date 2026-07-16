from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("accounts", views.AccountViewSet, basename="books-accounts")
router.register("journal-entries", views.JournalEntryViewSet, basename="books-journal")

urlpatterns = [
    path("t/books/", include(router.urls)),
    path("t/books/reports/<str:report>/", views.ReportsView.as_view()),
]
