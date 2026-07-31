from django.urls import path

from . import views

urlpatterns = [
    # Public — called by the marketing site (kaysetu.in). Unauthenticated.
    path("public/leads", views.PublicLeadView.as_view()),
    # SuperAdmin ops console
    path("sa/leads", views.SaLeadListView.as_view()),
    path("sa/leads/summary", views.SaLeadSummaryView.as_view()),
    path("sa/leads/<int:pk>", views.SaLeadDetailView.as_view()),
    path("sa/leads/<int:pk>/update", views.SaLeadUpdateView.as_view()),
    path("sa/leads/<int:pk>/note", views.SaLeadNoteView.as_view()),
]
