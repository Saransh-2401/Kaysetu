"""Seed the OTP sign-in message templates.

The Notification screen could only EDIT templates — nothing ever created any, and
the portal exposes no "add" action, so every tenant saw two empty lists with no
way forward. `trigger_key` also has to match a key the code actually looks up, so
it is not something an admin can be expected to invent.

OTP_LOGIN is the only trigger_key the platform reads today (foundation's
send-otp view); the notifications app delivers through its own path and does not
consume these tables. So exactly those two rows are seeded here rather than one
per catalog event, which would look configurable while doing nothing.

Idempotent: existing rows (including ones an admin has edited) are left alone,
so re-running `migrate_tenants` is safe.
"""
from django.db import migrations

EMAIL_BODY = """<p>Hello {full_name},</p>
<p>Your one-time sign-in code is <b>{otp}</b>.</p>
<p>It expires in 5 minutes. If you did not request it, you can ignore this email.</p>
"""

SMS_CONTENT = "${otp} is your one-time sign-in code. It expires in 5 minutes."


def seed(apps, schema_editor):
    # Every query must name the alias being migrated. Routing it normally would
    # send TenantRouter through require_tenant(), and no tenant context is set
    # during `migrate` — which aborts provisioning for the whole tenant.
    db = schema_editor.connection.alias
    EmailTemplate = apps.get_model("foundation", "EmailTemplate")
    SMSTemplate = apps.get_model("foundation", "SMSTemplate")

    if not EmailTemplate.objects.using(db).filter(trigger_key="OTP_LOGIN").exists():
        EmailTemplate.objects.using(db).create(
            name="OTP Login Code",
            trigger_key="OTP_LOGIN",
            subject="Your sign-in code",
            body=EMAIL_BODY,
            available_variables=["full_name", "otp"],
            is_active=True,
        )

    if not SMSTemplate.objects.using(db).filter(trigger_key="OTP_LOGIN").exists():
        SMSTemplate.objects.using(db).create(
            name="OTP Login Code",
            trigger_key="OTP_LOGIN",
            content=SMS_CONTENT,
            # Blank on purpose: Indian carriers reject a send without a
            # DLT-registered id, and only the tenant can supply their own.
            dlt_template_id="",
            is_active=True,
        )


def unseed(apps, schema_editor):
    """Remove only the untouched seeds, so an admin's edits are never destroyed."""
    db = schema_editor.connection.alias
    EmailTemplate = apps.get_model("foundation", "EmailTemplate")
    SMSTemplate = apps.get_model("foundation", "SMSTemplate")
    EmailTemplate.objects.using(db).filter(trigger_key="OTP_LOGIN", body=EMAIL_BODY).delete()
    SMSTemplate.objects.using(db).filter(trigger_key="OTP_LOGIN", content=SMS_CONTENT).delete()


class Migration(migrations.Migration):

    dependencies = [("foundation", "0013_login_otp")]

    operations = [migrations.RunPython(seed, unseed)]
