"""Dunning sweep: suspend lapsed trials/subscriptions past the grace window.
Run daily (cron / compose scheduler / K8s CronJob); moves to Celery beat later."""
from django.core.management.base import BaseCommand

from apps.billing.services import run_dunning


class Command(BaseCommand):
    help = "Suspend tenants whose trial or paid period lapsed past grace days."

    def handle(self, *args, **options):
        result = run_dunning()
        self.stdout.write(f"suspended: {', '.join(result['suspended']) or 'none'}")
