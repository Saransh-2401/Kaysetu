"""TRACK periodic maintenance across all TRACK-entitled tenants.

Run on a schedule (cron / compose scheduler / K8s CronJob; Celery beat later):
  --offline   every ~10 min  (flag agents whose GPS went stale)
  --checkout  nightly 00:05  (auto punch-out reports left open)
  --rollup    nightly 00:15  (build route histories; after checkout)

    python manage.py track_maintenance --offline
    python manage.py track_maintenance --checkout --rollup
"""
from django.core.management.base import BaseCommand

from apps.control.models import Tenant
from apps.tenancy.context import use_tenant
from apps.tenancy.db import ensure_alias


class Command(BaseCommand):
    help = "Run TRACK maintenance (offline flag / auto punch-out / route rollup) per tenant."

    def add_arguments(self, parser):
        parser.add_argument("--offline", action="store_true")
        parser.add_argument("--checkout", action="store_true")
        parser.add_argument("--rollup", action="store_true")
        parser.add_argument("--date", help="Target date YYYY-MM-DD for checkout/rollup.")

    def handle(self, *args, **options):
        from apps.tracking import services

        if not any(options[k] for k in ("offline", "checkout", "rollup")):
            options["offline"] = options["checkout"] = options["rollup"] = True

        target_date = None
        if options.get("date"):
            from datetime import date as date_cls

            target_date = date_cls.fromisoformat(options["date"])

        tenants = [
            t for t in Tenant.objects.all()
            if "TRACK" in t.entitled_modules() and t.can_login()
        ]
        totals = {"offline": 0, "checkout": 0, "rollup": 0}
        failed = 0
        for tenant in tenants:
            ensure_alias(tenant)
            try:
                with use_tenant(tenant):
                    if options["offline"]:
                        totals["offline"] += len(services.flag_offline_agents())
                    if options["checkout"]:
                        totals["checkout"] += services.auto_punch_out(target_date)
                    if options["rollup"]:
                        totals["rollup"] += services.build_route_histories(target_date)
            except Exception as exc:  # noqa: BLE001 — one bad tenant must not abort the rest
                failed += 1
                self.stderr.write(f"  FAILED {tenant.org_code}: {exc}")
        self.stdout.write(self.style.SUCCESS(
            f"tenants={len(tenants)} failed={failed} offline_flagged={totals['offline']} "
            f"auto_checked_out={totals['checkout']} routes_built={totals['rollup']}"
        ))
