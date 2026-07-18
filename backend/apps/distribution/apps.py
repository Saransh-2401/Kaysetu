from django.apps import AppConfig


class DistributionConfig(AppConfig):
    name = "apps.distribution"
    label = "distribution"
    verbose_name = "Distribution Network (DIST)"

    def ready(self):
        from . import capabilities

        capabilities.register_all()
