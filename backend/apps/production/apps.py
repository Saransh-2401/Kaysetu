from django.apps import AppConfig


class ProductionConfig(AppConfig):
    name = "apps.production"
    label = "production"
    verbose_name = "Production (PROD)"

    def ready(self):
        from . import capabilities

        capabilities.register_all()
