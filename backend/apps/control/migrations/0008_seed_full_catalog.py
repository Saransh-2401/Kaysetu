"""Seed the full-coverage catalog: email + SMS for every notification event.

The first catalog only covered a handful of modules. This adds the rest so a
tenant on ANY package sees the messages that apply to what they bought.

Same idempotent seed as 0006/0007: templates that already exist are left exactly
as they are — including wording Ops has edited in production — and only genuinely
new rows are inserted.
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
    """Nothing to undo — 0006's reverse already drops unedited seed rows."""


class Migration(migrations.Migration):

    dependencies = [("control", "0007_seed_general_notification_template")]

    operations = [migrations.RunPython(seed, noop)]
