"""Reconcile and prune the event outbox.

`deliver_events` retries what is known to have failed. This handles the two
cases it cannot:

  * **stuck rows** — PENDING long after they were created, meaning the process
    died between writing the row and running the handler. No exception was ever
    raised, so nothing marked them failed. They are requeued.
  * **settled rows** — DELIVERED and old. Pruned, so the table doesn't grow
    without bound. Failed/abandoned/skipped rows are NEVER pruned: they are the
    record of what did not happen.

Run daily (the scheduler does this):

    python manage.py reconcile_events
    python manage.py reconcile_events --prune-days 90 --stuck-minutes 15
"""
from django.core.management.base import BaseCommand

from apps.control.models import Tenant
from apps.foundation.integration import prune_deliveries, reconcile_deliveries
from apps.tenancy.context import use_tenant


class Command(BaseCommand):
    help = "Requeue stuck event deliveries and prune settled ones."

    def add_arguments(self, parser):
        parser.add_argument("--org-code", help="Only this tenant (else all active).")
        parser.add_argument("--stuck-minutes", type=int, default=30,
                            help="PENDING for longer than this is treated as stuck.")
        parser.add_argument("--prune-days", type=int, default=30,
                            help="Delete DELIVERED rows older than this.")
        parser.add_argument("--no-prune", action="store_true",
                            help="Reconcile only; keep every delivered row.")

    def handle(self, *args, **options):
        tenants = Tenant.objects.exclude(status=Tenant.Status.FAILED)
        if options.get("org_code"):
            tenants = tenants.filter(org_code=options["org_code"])

        totals = {"requeued": 0, "recovered": 0, "pruned": 0,
                  "abandoned": 0, "skipped_unentitled": 0}
        for tenant in tenants:
            try:
                with use_tenant(tenant):
                    result = reconcile_deliveries(
                        stuck_after_minutes=options["stuck_minutes"])
                    pruned = 0 if options["no_prune"] else prune_deliveries(
                        older_than_days=options["prune_days"])
            except Exception as exc:  # noqa: BLE001 — one bad tenant must not stop the rest
                self.stderr.write(f"  FAILED {tenant.org_code}: {exc}")
                continue
            totals["requeued"] += result["requeued"]
            totals["recovered"] += result.get("recovered", 0)
            totals["abandoned"] += result["abandoned"]
            totals["skipped_unentitled"] += result["skipped_unentitled"]
            totals["pruned"] += pruned
            if result["requeued"] or result["abandoned"] or result["skipped_unentitled"]:
                self.stdout.write(
                    f"  {tenant.org_code}: requeued {result['requeued']}, "
                    f"abandoned {result['abandoned']}, "
                    f"unentitled {result['skipped_unentitled']}")

        summary = (f"requeued {totals['requeued']}, recovered {totals['recovered']}, "
                   f"pruned {totals['pruned']}; "
                   f"NEEDS ATTENTION: {totals['abandoned']} abandoned, "
                   f"{totals['skipped_unentitled']} skipped for lost entitlement")
        # Abandoned and unentitled rows are work that never happened. Warn on
        # them every run — they do not resolve themselves.
        needs_human = totals["abandoned"] or totals["skipped_unentitled"]
        self.stdout.write((self.style.WARNING if needs_human else self.style.SUCCESS)(summary))
