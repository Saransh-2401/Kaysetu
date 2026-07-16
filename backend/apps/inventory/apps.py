from django.apps import AppConfig


class InventoryConfig(AppConfig):
    name = "apps.inventory"
    label = "inventory"
    verbose_name = "Inventory & Warehouse (INV)"

    def ready(self):
        from . import capabilities, handlers

        capabilities.register_all()
        handlers.register_all()
