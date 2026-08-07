"""Run the platform's periodic jobs on a schedule, in one process.

Several things only work if something invokes them regularly — most importantly
`deliver_events`, without which a failed auto-post is recorded but never
retried, so the whole durability guarantee only half-pays off.

This is a deliberately small scheduler rather than Celery beat: these jobs are a
handful of periodic management commands with no fan-out and no need for a
broker, so a single supervised process is less to deploy and less to break. If
async task queues arrive later (async provisioning, bulk imports), move these
onto beat and delete this — the commands themselves stay the same.

    python manage.py run_scheduler                  # run forever
    python manage.py run_scheduler --once           # one pass of everything (CI/manual)
    python manage.py run_scheduler --only deliver_events

Each job is isolated: one failing never stops the others or the loop. Jobs are
also runnable individually, so cron/Kubernetes CronJob remains a valid
alternative — see docs/DEPLOYMENT.md.
"""
import time
import traceback

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

# name -> (every N seconds, command, kwargs)
JOBS = {
    # The outbox retry. Frequent: this is what turns a failed ledger post or
    # stock movement from "lost" into "delivered a few minutes late".
    "deliver_events": (120, "deliver_events", {}),
    # Requeue deliveries stuck because a process died mid-handler, and prune
    # settled ones. Hourly: stuck rows are rare but invisible until swept.
    "reconcile_events": (3600, "reconcile_events", {}),
    # Turn login-audit IPs into locations. Nothing breaks without it, but the
    # Logs screen reads "Resolving…" against every row until it runs.
    "resolve_login_locations": (300, "resolve_login_locations", {}),
    # GPS/offline detection and duty-day rollover.
    "track_maintenance": (900, "track_maintenance", {}),
    # Attendance days someone forgot to punch out of.
    "attendance_maintenance": (86400, "attendance_maintenance", {}),
    # Signups whose background provisioning never finished (process died
    # mid-migrate). Frequent, because the tenant cannot log in until it does.
    "provision_pending": (300, "provision_pending", {}),
    # Trial expiry + past-due suspension.
    "billing_maintenance": (86400, "billing_maintenance", {}),
}


class Command(BaseCommand):
    help = "Run periodic platform jobs (outbox redelivery, maintenance) on a schedule."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true",
                            help="Run every due job once and exit.")
        parser.add_argument("--only", action="append",
                            help="Run only these job(s). Repeatable.")
        parser.add_argument("--tick", type=int, default=30,
                            help="Seconds between schedule checks (default 30).")

    def handle(self, *args, **options):
        selected = options.get("only") or list(JOBS)
        unknown = [name for name in selected if name not in JOBS]
        if unknown:
            self.stderr.write(self.style.ERROR(
                f"unknown job(s): {', '.join(unknown)}. Known: {', '.join(JOBS)}"))
            return

        if options["once"]:
            for name in selected:
                self._run(name)
            self.stdout.write(self.style.SUCCESS("single pass complete"))
            return

        # Run everything once at boot so a restart never leaves the outbox
        # sitting for a full interval before its first sweep.
        next_due = {name: 0.0 for name in selected}
        self.stdout.write(self.style.SUCCESS(
            "scheduler started: " + ", ".join(f"{n} every {JOBS[n][0]}s" for n in selected)))
        try:
            while True:
                now = time.monotonic()
                for name in selected:
                    if now >= next_due[name]:
                        self._run(name)
                        next_due[name] = time.monotonic() + JOBS[name][0]
                time.sleep(max(1, options["tick"]))
        except KeyboardInterrupt:
            self.stdout.write("scheduler stopped")

    def _run(self, name):
        """A failing job must never stop the loop or its siblings."""
        _interval, command, kwargs = JOBS[name]
        started = timezone.now()
        try:
            call_command(command, verbosity=0, **kwargs)
            self.stdout.write(f"[{started:%Y-%m-%d %H:%M:%S}] {name} ok")
        except Exception:
            self.stderr.write(f"[{started:%Y-%m-%d %H:%M:%S}] {name} FAILED\n{traceback.format_exc()}")
