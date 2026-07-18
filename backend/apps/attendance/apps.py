from django.apps import AppConfig


class AttendanceConfig(AppConfig):
    name = "apps.attendance"
    label = "attendance"
    verbose_name = "Attendance & Leave (ATT)"

    def ready(self):
        from . import capabilities

        capabilities.register_all()
