"""Seed the module registry + launch packages (blueprint §4/§5).

This is platform data (OUR catalog of what is sellable), not tenant seed
data — it ships as a migration so every environment gets it automatically.
Prices are placeholders; the SuperAdmin package composer edits them live.
"""
from django.db import migrations

MODULES = [
    ("TRACK", "Agent Live Tracking", "GPS attendance, live map, route replay, tracking health"),
    ("FIELD", "Field Sales Operations", "Beat plans, visits, field orders, collections, expenses, targets"),
    ("ORDERS", "Sales Orders & Dispatch", "Order approval chain, pick lists, delivery notes, invoicing"),
    ("DIST", "Distribution Network", "Distributors, allocation, stock requests, distributor invoices"),
    ("INV", "Inventory & Warehouse", "Warehouses, stock ledger, adjustments, transfers"),
    ("PROD", "Production", "BOM, work orders, job cards, production planning"),
    ("PURCH", "Procurement", "Suppliers, material requests, purchase orders, GRN"),
    ("BOOKS", "Accounts & Finance", "Ledgers, invoices, bills, payments, GST hub, banking"),
    ("CRM", "Leads & Pipeline", "Leads, opportunities, funnel, follow-ups"),
    ("ATT", "Attendance & Leave", "Office attendance, leave management, holidays"),
    ("TA", "Travel Allowance", "TA claims with GPS-auto distance and approval chain"),
]

# code, name, tagline, modules, is_addon, mobile_level, monthly, annual, included_users, per_user
PACKAGES = [
    ("P1", "Agent Live Tracking", "Know where your field team is — without killing their battery",
     ["TRACK"], False, "tracking", 999, 9990, 5, 99),
    ("P2", "Sales Management", "Sales manager + sales agents + your catalog. Nothing you don't need",
     ["FIELD"], False, "sales", 1499, 14990, 5, 149),
    ("P3", "Sales & Field Force", "Tracking, beat plans, visits, field orders and leads — the full field suite",
     ["TRACK", "FIELD", "CRM"], False, "sales", 2499, 24990, 5, 199),
    ("P4", "Order & Distribution", "Back-office orders, warehouse stock and your distributor network",
     ["ORDERS", "INV", "DIST"], False, "sales", 2999, 29990, 5, 199),
    ("P5", "Production Management", "BOM to finished goods — production and warehouse together",
     ["PROD", "INV"], False, "none", 2499, 24990, 3, 249),
    ("P6", "Procurement", "Suppliers, material requests and purchase orders with approvals",
     ["PURCH"], False, "none", 999, 9990, 3, 99),
    ("P7", "Books & Accounts", "GST-ready books: invoices, bills, ledgers, returns, banking",
     ["BOOKS"], False, "none", 1999, 19990, 3, 199),
    ("P8", "Enterprise", "Every module, one platform",
     ["TRACK", "FIELD", "ORDERS", "DIST", "INV", "PROD", "PURCH", "BOOKS", "CRM", "ATT", "TA"],
     False, "sales", 7999, 79990, 10, 299),
    ("A1", "Travel Allowance", "Add TA claims with tracked-distance auto-fill",
     ["TA"], True, "none", 499, 4990, 0, 49),
    ("A2", "Attendance & Leave", "Add office attendance and leave management",
     ["ATT"], True, "none", 499, 4990, 0, 49),
]


def seed(apps, schema_editor):
    ModuleDef = apps.get_model("control", "ModuleDef")
    Package = apps.get_model("control", "Package")

    modules = {}
    for i, (code, name, description) in enumerate(MODULES):
        modules[code], _ = ModuleDef.objects.get_or_create(
            code=code, defaults={"name": name, "description": description, "sort_order": i}
        )

    for i, (code, name, tagline, module_codes, is_addon, mobile, monthly, annual, users, per_user) in enumerate(PACKAGES):
        package, created = Package.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "tagline": tagline,
                "is_addon": is_addon,
                "mobile_level": mobile,
                "base_price_monthly": monthly,
                "base_price_annual": annual,
                "included_users": users,
                "per_user_price": per_user,
                "sort_order": i,
            },
        )
        if created:
            package.modules.set([modules[m] for m in module_codes])


def unseed(apps, schema_editor):
    Package = apps.get_model("control", "Package")
    ModuleDef = apps.get_model("control", "ModuleDef")
    Package.objects.filter(code__in=[p[0] for p in PACKAGES]).delete()
    ModuleDef.objects.filter(code__in=[m[0] for m in MODULES]).delete()


class Migration(migrations.Migration):
    dependencies = [("control", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
