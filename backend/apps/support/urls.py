from django.urls import path

from . import views

urlpatterns = [
    # Tenant portal
    path("t/support/tickets", views.TicketListCreateView.as_view()),
    path("t/support/tickets/<int:pk>", views.TicketDetailView.as_view()),
    path("t/support/tickets/<int:pk>/reply", views.TicketReplyView.as_view()),
    path("t/support/tickets/<int:pk>/close", views.TicketCloseView.as_view()),
    # SuperAdmin ops console
    path("sa/support/tickets", views.SaTicketListView.as_view()),
    path("sa/support/tickets/<int:pk>", views.SaTicketDetailView.as_view()),
    path("sa/support/tickets/<int:pk>/reply", views.SaTicketReplyView.as_view()),
    path("sa/support/tickets/<int:pk>/update", views.SaTicketUpdateView.as_view()),
    path("sa/support/summary", views.SaTicketSummaryView.as_view()),
    path("sa/support/admins", views.SaAdminListView.as_view()),
]
