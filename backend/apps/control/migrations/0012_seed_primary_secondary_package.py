from django.db import migrations

# A distributor-led FMCG business: primary orders bought by distributors,
# secondary orders the agents book at retailers on their behalf, and live
# tracking of those agents. Deliberately WITHOUT production and accounts —
# the existing bundles all forced one or both, so this pattern had no package.
#
# ORDERS is in the list because the back office reads sales orders, not field
# orders: FIELD alone would let agents book secondary orders that nobody in the
# portal could see. INV is what company stock is dispatched from.
CODE = "P9"
NAME = "Primary & Secondary Sales"
TAGLINE = "Distributor primary orders, agent secondary orders at retailers, and live tracking"
MODULES = ["TRACK", "FIELD", "ORDERS", "DIST", "INV"]


def seed(apps, schema_editor):
    ModuleDef = apps.get_model("control", "ModuleDef")
    Package = apps.get_model("control", "Package")

    package, created = Package.objects.get_or_create(
        code=CODE,
        defaults={
            "name": NAME,
            "tagline": TAGLINE,
            "is_addon": False,
            "mobile_level": "sales",       # agents need the full field app
            "base_price_monthly": 3499,
            "base_price_annual": 34990,
            "included_users": 5,
            "per_user_price": 249,
            "sort_order": 8,               # after P8, before the add-ons
        },
    )
    if created:
        modules = ModuleDef.objects.filter(code__in=MODULES)
        package.modules.set(modules)


def unseed(apps, schema_editor):
    apps.get_model("control", "Package").objects.filter(code=CODE).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("control", "0011_fcm_service_account"),
    ]
    operations = [migrations.RunPython(seed, unseed)]
