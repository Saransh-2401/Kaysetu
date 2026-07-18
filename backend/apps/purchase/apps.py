from django.apps import AppConfig


class PurchaseConfig(AppConfig):
    name = "apps.purchase"
    label = "purchase"
    verbose_name = "Procurement (PURCH)"

    def ready(self):
        from . import capabilities

        capabilities.register_all()
