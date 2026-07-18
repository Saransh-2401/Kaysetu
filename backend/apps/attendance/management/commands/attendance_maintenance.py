"""Close attendance rows left open on earlier days.

Someone who forgets to punch out would otherwise leave an open row forever,
so their working hours never compute. Run daily (see run_scheduler).

    python manage.py attendance_maintenance
"""
from django.core.management.base import BaseCommand

from apps.control.models import Tenant
from apps.tenancy.context import use_tenant


class Command(BaseCommand):
    help = "Auto-close attendance days left open, for every tenant with ATT."

    def add_arguments(self, parser):
        parser.add_argument("--org-code", help="Only this tenant (else all active).")

    def handle(self, *args, **options):
        tenants = Tenant.objects.exclude(status=Tenant.Status.FAILED)
        if options.get("org_code"):
            tenants = tenants.filter(org_code=options["org_code"])

        closed_total = 0
        for tenant in tenants:
            if "ATT" not in tenant.entitled_modules():
                continue
            try:
                with use_tenant(tenant):
                    from apps.attendance.services import auto_close_open_days

                    closed = auto_close_open_days()
            except Exception as exc:  # noqa: BLE001 — one tenant must not stop the rest
                self.stderr.write(f"  FAILED {tenant.org_code}: {exc}")
                continue
            closed_total += closed
            if closed:
                self.stdout.write(f"  {tenant.org_code}: closed {closed}")
        self.stdout.write(self.style.SUCCESS(f"auto-closed {closed_total} attendance day(s)"))
