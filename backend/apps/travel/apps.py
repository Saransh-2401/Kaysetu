from django.apps import AppConfig


class TravelConfig(AppConfig):
    name = "apps.travel"
    label = "travel"
    verbose_name = "Travel Allowance (TA)"

    def ready(self):
        from . import capabilities

        capabilities.register_all()
