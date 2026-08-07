"""Fill in the Location column of the Login Activity log, across all tenants.

`LoginActivity` records the caller's IP at sign-in and leaves the location
blank — resolving it means calling a third-party service, and authentication is
never made to wait on the network. Without something running this, the admin
Logs screen shows "Resolving…" against every row forever.

Addresses are gathered from every tenant BEFORE any lookup happens, so a
backlog spread over fifty tenants costs one batch of requests rather than
fifty. One lookup then resolves the entire history for that IP, not just the
rows that prompted it.

    python manage.py resolve_login_locations
    python manage.py resolve_login_locations --limit 100
"""
from django.core.management.base import BaseCommand

from apps.control.models import Tenant
from apps.tenancy.context import use_tenant
from apps.tenancy.db import ensure_alias

# How many unresolved rows to look at per tenant. Their IPs collapse to far
# fewer distinct addresses — one office NAT covers a whole team.
SCAN_ROWS = 2000


class Command(BaseCommand):
    help = "Resolve login-activity IP addresses to locations (all tenants)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit", type=int, default=500,
            help="Max distinct addresses to look up in one run (default 500). "
                 "The rest wait for the next run, which keeps a large backlog "
                 "inside the provider's rate limit.")

    def handle(self, *args, **options):
        from apps.foundation import geoip
        from apps.foundation.models import LoginActivity

        tenants = [t for t in Tenant.objects.all() if t.can_login()]

        # Pass 1 — collect what needs looking up, tenant by tenant.
        pending = {}
        failed = 0
        for tenant in tenants:
            ensure_alias(tenant)
            try:
                with use_tenant(tenant):
                    ips = (LoginActivity.objects.filter(location_resolved=False)
                           .order_by("-created_at")
                           .values_list("ip_address", flat=True)[:SCAN_ROWS])
                    unique = list(dict.fromkeys(ips))
                if unique:
                    pending[tenant.pk] = (tenant, unique)
            except Exception as exc:   # noqa: BLE001 — one bad tenant must not abort the rest
                failed += 1
                self.stderr.write(f"  FAILED {tenant.org_code}: {exc}")

        wanted = list(dict.fromkeys(ip for _t, ips in pending.values() for ip in ips))
        if not wanted:
            self.stdout.write(self.style.SUCCESS(
                f"tenants={len(tenants)} failed={failed} nothing to resolve"))
            return

        # Pass 2 — one round of lookups for every tenant's addresses at once.
        truncated = max(0, len(wanted) - options["limit"])
        verdicts = geoip.resolve(wanted[:options["limit"]])

        # Pass 3 — write the answers back. Filtering on the address rather than
        # on the rows we sampled means one lookup settles every row that ever
        # came from that IP.
        updated = 0
        for tenant, _ips in pending.values():
            try:
                with use_tenant(tenant):
                    for ip, location in verdicts.items():
                        updated += (LoginActivity.objects
                                    .filter(location_resolved=False, ip_address=ip)
                                    .update(location=location, location_resolved=True))
            except Exception as exc:   # noqa: BLE001
                failed += 1
                self.stderr.write(f"  FAILED {tenant.org_code}: {exc}")

        # Anything the provider could not answer for stays unresolved and is
        # retried next run — reported rather than passed over in silence.
        deferred = truncated + (len(wanted[:options["limit"]]) - len(verdicts))
        self.stdout.write(self.style.SUCCESS(
            f"tenants={len(tenants)} failed={failed} addresses={len(wanted)} "
            f"resolved={len(verdicts)} rows_updated={updated} deferred={deferred}"))
