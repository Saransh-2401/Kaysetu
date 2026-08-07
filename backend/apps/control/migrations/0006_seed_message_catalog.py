"""Seed the platform message catalog into the control DB.

One central copy shared by EVERY tenant — Ops edits it once and all tenants see
the change immediately, with no per-tenant copies to drift apart.

Idempotent and non-destructive: a template that already exists is left exactly
as it is, so re-running this (or shipping a later catalog change) can never
overwrite wording the Ops team has edited in production. Genuinely new
templates are added; nothing is ever silently reworded.
"""
from django.db import migrations


def seed(apps, schema_editor):
    # Control-plane models live only in `default`; the router already restricts
    # this migration to that alias, but name it explicitly for clarity.
    db = schema_editor.connection.alias
    MessageTemplate = apps.get_model("control", "MessageTemplate")
    PlatformMessagingConfig = apps.get_model("control", "PlatformMessagingConfig")

    from apps.control.message_catalog import iter_catalog

    for channel, defaults in iter_catalog():
        MessageTemplate.objects.using(db).get_or_create(
            channel=channel,
            trigger_key=defaults["trigger_key"],
            defaults={**defaults, "is_active": True},
        )

    PlatformMessagingConfig.objects.using(db).get_or_create(pk=1)


def unseed(apps, schema_editor):
    """Only drop rows that still match the shipped catalog, so Ops edits survive."""
    db = schema_editor.connection.alias
    MessageTemplate = apps.get_model("control", "MessageTemplate")

    from apps.control.message_catalog import iter_catalog

    for channel, defaults in iter_catalog():
        MessageTemplate.objects.using(db).filter(
            channel=channel,
            trigger_key=defaults["trigger_key"],
            subject=defaults["subject"],
            body=defaults["body"],
            content=defaults["content"],
        ).delete()


class Migration(migrations.Migration):

    dependencies = [("control", "0005_message_templates")]

    operations = [migrations.RunPython(seed, unseed)]
