from django.urls import path

from . import views

urlpatterns = [
    path("t/billing", views.BillingSummaryView.as_view()),
    path("t/billing/quote", views.QuoteView.as_view()),
    path("t/billing/checkout", views.CheckoutView.as_view()),
    path("t/billing/verify", views.VerifyView.as_view()),
    path("billing/webhook/razorpay", views.RazorpayWebhookView.as_view()),
]
