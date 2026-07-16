"""Run migrations against every tenant database.

New tenants are migrated automatically by the provisioner. When a NEW tenant
app (e.g. tracking) is added, existing tenants need a one-off backfill — this
command loops all tenants and migrates each.

    python manage.py migrate_tenants
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.control.models import Tenant
from apps.tenancy.db import ensure_alias


class Command(BaseCommand):
    help = "Apply migrations to every tenant database (backfill new tenant apps)."

    def add_arguments(self, parser):
        parser.add_argument("--org-code", help="Only this tenant (else all).")

    def handle(self, *args, **options):
        tenants = Tenant.objects.all()
        if options.get("org_code"):
            tenants = tenants.filter(org_code=options["org_code"])
        done, failed = 0, 0
        for tenant in tenants:
            alias = ensure_alias(tenant)
            try:
                call_command("migrate", database=alias, interactive=False, verbosity=0)
                done += 1
                self.stdout.write(f"  migrated {tenant.org_code}")
            except Exception as exc:  # noqa: BLE001
                failed += 1
                self.stderr.write(f"  FAILED {tenant.org_code}: {exc}")
        self.stdout.write(self.style.SUCCESS(f"migrated {done}, failed {failed}"))
