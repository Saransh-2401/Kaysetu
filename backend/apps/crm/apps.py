from django.apps import AppConfig


class CrmConfig(AppConfig):
    name = "apps.crm"
    label = "crm"
    verbose_name = "Leads & Pipeline (CRM)"

    def ready(self):
        from . import capabilities

        capabilities.register_all()
