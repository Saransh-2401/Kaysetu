"""Finish tenant provisioning that never completed.

Signup hands provisioning to a background thread so the request returns fast.
The thread is not the durability guarantee — this is. Anything left QUEUED, or
RUNNING for longer than a provision could plausibly take (a process that died
mid-migrate), is picked up and re-run here.

`provision_tenant` is idempotent, so re-running a half-finished tenant is safe:
the database is created if needed, migrations are a no-op when already applied,
and the baseline uses get_or_create.

    python manage.py provision_pending
    python manage.py provision_pending --stale-minutes 5 --max-attempts 5
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.control.models import ProvisioningJob, Tenant
from apps.tenancy.provisioning import ProvisioningError, provision_tenant


class Command(BaseCommand):
    help = "Re-run provisioning jobs that never finished."

    def add_arguments(self, parser):
        parser.add_argument("--org-code", help="Only this tenant.")
        parser.add_argument("--stale-minutes", type=int, default=10,
                            help="RUNNING for longer than this counts as dead.")
        parser.add_argument("--max-attempts", type=int, default=5,
                            help="Stop retrying a job after this many attempts.")

    def handle(self, *args, **options):
        cutoff = timezone.now() - timezone.timedelta(minutes=options["stale_minutes"])
        # A RUNNING job whose CURRENT attempt started before the cutoff means
        # the worker died. Measuring from created_at instead made every retried
        # job look dead the instant it went RUNNING again — two sweeps would
        # then migrate the same tenant database concurrently, and the loser's
        # exception marked a healthy tenant FAILED, locking out every user in
        # it. started_at is per-attempt, so it cannot do that.
        jobs = ProvisioningJob.objects.filter(
            status__in=[ProvisioningJob.Status.PENDING, ProvisioningJob.Status.FAILED]
        ) | ProvisioningJob.objects.filter(
            status=ProvisioningJob.Status.RUNNING, started_at__lt=cutoff)
        jobs = jobs.filter(attempts__lt=options["max_attempts"]).select_related("tenant")
        if options.get("org_code"):
            jobs = jobs.filter(tenant__org_code=options["org_code"])

        done = failed = 0
        for job in jobs.distinct():
            tenant = job.tenant
            self.stdout.write(f"  provisioning {tenant.org_code} (attempt {job.attempts + 1})")
            try:
                # No owner password: a retry must not reset a password the owner
                # may already have changed. The baseline only sets one on first
                # creation.
                provision_tenant(tenant, owner_password=None, job=job)
                done += 1
            except ProvisioningError as exc:
                self.stderr.write(f"    FAILED {tenant.org_code}: {exc}")
                failed += 1

        stuck = ProvisioningJob.objects.filter(
            status=ProvisioningJob.Status.FAILED,
            attempts__gte=options["max_attempts"]).count()
        summary = f"provisioned {done}, failed {failed}, needing a human: {stuck}"
        self.stdout.write((self.style.WARNING if (failed or stuck)
                           else self.style.SUCCESS)(summary))
