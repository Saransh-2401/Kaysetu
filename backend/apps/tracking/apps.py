from django.apps import AppConfig


class TrackingConfig(AppConfig):
    name = "apps.tracking"
    label = "tracking"
    verbose_name = "Agent Live Tracking (TRACK)"

    def ready(self):
        # Register capabilities/events ONLY (no DB access here — runs at startup
        # with no tenant context). Provider bodies stay lazy.
        from . import capabilities

        capabilities.register_all()
