"""Add newly-shipped catalog entries (the general NOTIFICATION fallback).

Re-runs the same idempotent seed as 0006: templates that already exist are left
untouched — including any wording Ops has edited — and only genuinely new ones
are inserted. That makes this the standard way to ship a catalog addition.
"""
from django.db import migrations


def seed(apps, schema_editor):
    db = schema_editor.connection.alias
    MessageTemplate = apps.get_model("control", "MessageTemplate")

    from apps.control.message_catalog import iter_catalog

    for channel, defaults in iter_catalog():
        MessageTemplate.objects.using(db).get_or_create(
            channel=channel,
            trigger_key=defaults["trigger_key"],
            defaults={**defaults, "is_active": True},
        )


def noop(apps, schema_editor):
    """Nothing to undo: 0006's reverse already removes unedited seed rows."""


class Migration(migrations.Migration):

    dependencies = [("control", "0006_seed_message_catalog")]

    operations = [migrations.RunPython(seed, noop)]
