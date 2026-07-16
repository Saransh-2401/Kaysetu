from django.apps import AppConfig


class OrdersConfig(AppConfig):
    name = "apps.orders"
    label = "orders"
    verbose_name = "Sales Orders & Dispatch (ORDERS)"

    def ready(self):
        from . import capabilities, handlers

        capabilities.register_all()
        handlers.register_all()
