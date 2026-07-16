from django.apps import AppConfig


class FieldConfig(AppConfig):
    name = "apps.field"
    label = "field"
    verbose_name = "Field Sales Operations (FIELD)"

    def ready(self):
        # Register the capabilities FIELD provides + the events it consumes.
        # No DB access here (startup, no tenant context) — bodies stay lazy.
        from . import capabilities, handlers

        capabilities.register_all()
        handlers.register_all()
