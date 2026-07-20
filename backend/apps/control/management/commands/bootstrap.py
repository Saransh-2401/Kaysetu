"""Bootstrap a local/demo environment: a SuperAdmin + one tenant per package.

Idempotent by design — safe to run on every `docker compose up`. The SuperAdmin
is matched by email and each demo tenant by its owner email, so a re-run creates
nothing new and simply re-prints the credentials. That is what lets the one-shot
runner call this on every boot without piling up duplicate tenants.

Driven by env so a real deployment can set its own values:
    SUPERADMIN_EMAIL      (default admin@kaysetu.local)
    SUPERADMIN_PASSWORD   (default KaySetu@Admin1)
    DEMO_TENANTS          "1" to seed per-package demo tenants (default "1")
    DEMO_PASSWORD         (default Demo@12345)
"""
import os

from django.core.management.base import BaseCommand

from apps.control import services
from apps.control.models import AdminUser, Package, Tenant

DEMO_DOMAIN = "demo.kaysetu.local"


class Command(BaseCommand):
    help = "Create a SuperAdmin and one demo tenant per published base package (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--no-tenants", action="store_true",
                            help="Only ensure the SuperAdmin; skip the demo tenants.")

    def handle(self, *args, **options):
        admin = self._ensure_superadmin()
        rows = [] if options["no_tenants"] else self._ensure_demo_tenants()
        self._report(admin, rows)

    # ------------------------------------------------------------------ admin
    def _ensure_superadmin(self):
        email = os.environ.get("SUPERADMIN_EMAIL", "admin@kaysetu.local").strip().lower()
        password = os.environ.get("SUPERADMIN_PASSWORD", "KaySetu@Admin1")
        admin = AdminUser.objects.filter(email=email).first()
        if admin is None:
            AdminUser.objects.create_superuser(
                email=email, password=password, full_name="KaySetu Super Admin")
            created = True
        else:
            # Keep the local password in step with the env every boot, so a
            # forgotten dev password is always recoverable from the runner.
            admin.set_password(password)
            admin.admin_role = AdminUser.Role.SUPER
            admin.is_active = True
            admin.save()
            created = False
        return {"email": email, "password": password, "created": created}

    # ---------------------------------------------------------------- tenants
    def _ensure_demo_tenants(self):
        if os.environ.get("DEMO_TENANTS", "1") != "1":
            return []
        password = os.environ.get("DEMO_PASSWORD", "Demo@12345")
        rows = []
        # Base packages only — add-ons (A1/A2) attach to a base and cannot be
        # signed up for on their own. P8 (Enterprise) carries every module,
        # including the two add-on modules, so all 11 modules get coverage.
        packages = Package.objects.filter(
            is_published=True, is_addon=False).order_by("sort_order")
        for pkg in packages:
            owner_email = f"owner+{pkg.code.lower()}@{DEMO_DOMAIN}"
            existing = Tenant.objects.filter(owner_email=owner_email).first()
            if existing is not None:
                rows.append(self._row(pkg, existing.org_code, owner_email,
                                      password, existing.status, created=False))
                continue
            try:
                tenant = services.signup(
                    company_name=f"{pkg.name} Demo",
                    owner_name=f"{pkg.code} Owner",
                    owner_email=owner_email,
                    password=password,
                    package_code=pkg.code,
                    background=False,   # provision synchronously so it's ready now
                )
                rows.append(self._row(pkg, tenant.org_code, owner_email,
                                      password, tenant.status, created=True))
            except Exception as exc:   # noqa: BLE001 — one bad package must not stop the rest
                self.stderr.write(f"  FAILED {pkg.code}: {exc}")
                rows.append(self._row(pkg, "-", owner_email, password,
                                      f"FAILED: {exc}", created=False))
        return rows

    @staticmethod
    def _row(pkg, org_code, email, password, status, *, created):
        return {"package": pkg.code, "name": pkg.name, "modules": pkg.module_codes(),
                "org_code": org_code, "email": email, "password": password,
                "status": status, "created": created}

    # ----------------------------------------------------------------- report
    def _report(self, admin, rows):
        out = self.stdout
        bar = "=" * 72
        out.write("\n" + bar)
        out.write(self.style.MIGRATE_HEADING("  KaySetu — local environment ready"))
        out.write(bar)
        out.write("\n  SuperAdmin console:  http://localhost:3000/ops/login")
        out.write(f"    email     {admin['email']}")
        out.write(f"    password  {admin['password']}"
                  + ("   (created)" if admin["created"] else "   (updated)"))

        if rows:
            out.write("\n  Tenant portal:  http://localhost:3001  "
                      "(log in with the org code + owner email + password)")
            out.write("\n  " + "-" * 70)
            out.write(f"  {'PKG':<4} {'ORG CODE':<12} {'OWNER EMAIL':<34} {'STATUS':<10}")
            out.write("  " + "-" * 70)
            for r in rows:
                out.write(f"  {r['package']:<4} {r['org_code']:<12} "
                          f"{r['email']:<34} {r['status']:<10}")
            out.write("  " + "-" * 70)
            out.write(f"  every tenant password:  {rows[0]['password']}")
            out.write("\n  modules per package:")
            for r in rows:
                out.write(f"    {r['package']:<4} {r['name']:<22} "
                          f"{', '.join(r['modules'])}")
        out.write("\n" + bar + "\n")
