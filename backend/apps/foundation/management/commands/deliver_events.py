"""Retry domain events whose delivery to a subscriber never succeeded.

The event bus is fire-and-forget, so a subscriber that failed (or a process that
died mid-handler) leaves an undelivered row in foundation.EventDelivery. This
command walks every tenant and replays those rows — an invoice that never
reached the ledger, a dispatch that never left stock — and abandons anything
still failing after --max-attempts so it surfaces for a human.

Run it on a schedule (cron/Celery beat), e.g. every few minutes:

    python manage.py deliver_events
    python manage.py deliver_events --org-code SLX-ABC123 --max-attempts 8
"""
from django.core.management.base import BaseCommand

from apps.control.models import Tenant
from apps.foundation.integration import redeliver
from apps.tenancy.context import use_tenant


class Command(BaseCommand):
    help = "Replay undelivered domain events for every tenant."

    def add_arguments(self, parser):
        parser.add_argument("--org-code", help="Only this tenant (else all active).")
        parser.add_argument("--max-attempts", type=int, default=5,
                            help="Give up (abandon) after this many attempts.")
        parser.add_argument("--limit", type=int, default=200,
                            help="Maximum deliveries to retry per tenant per run.")

    def handle(self, *args, **options):
        tenants = Tenant.objects.exclude(status=Tenant.Status.FAILED)
        if options.get("org_code"):
            tenants = tenants.filter(org_code=options["org_code"])

        totals = {"delivered": 0, "failed": 0, "abandoned": 0, "unknown_subscriber": 0}
        for tenant in tenants:
            try:
                with use_tenant(tenant):
                    result = redeliver(max_attempts=options["max_attempts"],
                                       limit=options["limit"])
            except Exception as exc:  # noqa: BLE001 — one bad tenant must not stop the rest
                self.stderr.write(f"  FAILED {tenant.org_code}: {exc}")
                continue
            for key in totals:
                totals[key] += result.get(key, 0)
            if result["attempted"]:
                self.stdout.write(
                    f"  {tenant.org_code}: delivered {result['delivered']}, "
                    f"failed {result['failed']}, abandoned {result['abandoned']}"
                )

        summary = (f"redelivered {totals['delivered']}, still failing {totals['failed']}, "
                   f"abandoned {totals['abandoned']}, orphaned {totals['unknown_subscriber']}")
        style = self.style.SUCCESS if not totals["abandoned"] else self.style.WARNING
        self.stdout.write(style(summary))
