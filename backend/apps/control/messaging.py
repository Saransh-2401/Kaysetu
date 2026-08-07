"""Platform messaging — every tenant's email/SMS goes out on KaySetu's account.

Deliberately control-plane. Tenants neither configure nor pay for delivery, so
there is exactly ONE set of credentials and ONE copy of each template, both
owned by Ops. Nothing here reads tenant settings.

Every function is best-effort and never raises: a mail outage must not undo a
user that was already created, nor block a login. Callers get (sent, error) and
decide what to tell the operator.
"""
import logging
import re

logger = logging.getLogger("kaysetu.control")


def get_config():
    """The singleton platform messaging config (created on first use)."""
    from .models import PlatformMessagingConfig

    config, _ = PlatformMessagingConfig.objects.get_or_create(pk=1)
    return config


def get_template(channel: str, trigger_key: str):
    """The active platform template for a channel+trigger, or None."""
    from .models import MessageTemplate

    return MessageTemplate.objects.filter(
        channel=channel, trigger_key=trigger_key, is_active=True
    ).first()


def render(text: str, context: dict) -> str:
    """Substitute {placeholders}.

    Plain replacement rather than str.format(): template bodies are HTML full of
    literal braces in CSS, and a stray one would make format() raise mid-send.
    Unknown placeholders are left as-is so a missing value is visible in testing
    rather than silently blanking a line.
    """
    out = text or ""
    for key, value in (context or {}).items():
        out = out.replace("{%s}" % key, "" if value is None else str(value))
    return out


def send_email(to_address: str, subject: str, html_body: str):
    """Send one email on the platform SMTP account. Returns (sent, error)."""
    from django.core.mail import EmailMessage, get_connection

    config = get_config()
    if not config.email_ready():
        return False, "Platform email is not configured (SuperAdmin → Messaging)."
    if not to_address:
        return False, "No recipient address."

    try:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=config.smtp_host, port=config.smtp_port,
            username=config.smtp_username, password=config.smtp_password,
            use_tls=config.smtp_use_tls, use_ssl=config.smtp_use_ssl,
            fail_silently=False,
        )
        from_email = config.from_email or config.smtp_username
        if config.from_name:
            from_email = f"{config.from_name} <{from_email}>"
        message = EmailMessage(subject=subject, body=html_body,
                               from_email=from_email, to=[to_address],
                               connection=connection)
        message.content_subtype = "html"
        message.send()
        return True, ""
    except Exception as exc:                       # noqa: BLE001 - reported upward
        logger.warning("platform email send failed: %s", exc)
        return False, f"{type(exc).__name__}: {exc}"


def send_sms(to_phone: str, text: str, dlt_template_id: str = ""):
    """Send one SMS on the platform account. Returns (sent, error).

    No SMS gateway is wired into the platform yet — credentials and the DLT id
    are stored and ready, and this is the single place a provider gets plugged
    in. It reports honestly rather than pretending to have sent.
    """
    config = get_config()
    if not config.sms_ready():
        return False, "Platform SMS is not configured (SuperAdmin → Messaging)."
    if not dlt_template_id:
        # Indian carriers reject a send with no DLT id; failing here is more
        # useful than a silent carrier-side drop.
        return False, "This template has no DLT template id, so the carrier would reject it."
    return False, "No SMS provider is wired up yet — credentials and DLT id are stored and ready."


#: A {placeholder} the catalog might use. Restricted to lower_snake identifiers
#: so inline CSS / JS braces in an HTML body are never mistaken for one.
_PLACEHOLDER = re.compile(r"\{[a-z_][a-z0-9_]*\}")


def unfilled(text: str) -> list:
    """Placeholders still present after rendering, e.g. ['{order_number}'].

    Notification handlers supply only a subject and message today, so an
    event-specific template can easily reference data nobody passed. Sending it
    anyway would put a literal {order_number} in a customer's inbox — callers
    use this to fall back to the general template instead.
    """
    return _PLACEHOLDER.findall(text or "")


def send_event_email(event_key: str, to_address: str, context: dict):
    """Send the template for `event_key`, falling back to the general one.

    The specific template is used ONLY if every placeholder it references can be
    filled from `context`; otherwise the designed general notification goes out.
    That way richer templates light up automatically as callers start passing
    more context, and never leak raw placeholders in the meantime.
    """
    template = get_template("email", event_key)
    if template is not None:
        subject = render(template.subject, context)
        body = render(template.body, context)
        if not unfilled(subject) and not unfilled(body):
            return send_email(to_address, subject, body)
    return send_templated_email("NOTIFICATION", to_address, context)


def send_event_sms(event_key: str, to_phone: str, context: dict):
    """SMS twin of send_event_email — same fallback rule."""
    template = get_template("sms", event_key)
    if template is not None:
        text = render(template.content, context)
        if not unfilled(text):
            return send_sms(to_phone, text, template.dlt_template_id)
    return send_templated_sms("NOTIFICATION", to_phone, context)


def send_templated_email(trigger_key: str, to_address: str, context: dict):
    """Render and send the platform email template for `trigger_key`."""
    template = get_template("email", trigger_key)
    if template is None:
        return False, f"No active email template for '{trigger_key}'."
    return send_email(to_address,
                      render(template.subject, context),
                      render(template.body, context))


def send_templated_sms(trigger_key: str, to_phone: str, context: dict):
    """Render and send the platform SMS template for `trigger_key`."""
    template = get_template("sms", trigger_key)
    if template is None:
        return False, f"No active SMS template for '{trigger_key}'."
    return send_sms(to_phone, render(template.content, context), template.dlt_template_id)
