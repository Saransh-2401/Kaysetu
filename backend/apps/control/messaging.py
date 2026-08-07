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
from urllib.parse import quote

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
    """Substitute {placeholders} — and the ${placeholder} form too.

    Plain replacement rather than str.format(): template bodies are HTML full of
    literal braces in CSS, and a stray one would make format() raise mid-send.
    Unknown placeholders are left as-is so a missing value is visible in testing
    rather than silently blanking a line.

    `${var}` is handled FIRST and as a whole. DLT-registered SMS templates are
    written that way (it is what the previous platform used), and replacing the
    inner `{var}` on its own would leave a stray `$` in front of the value —
    which no longer matches the approved template, so the carrier rejects it.
    """
    out = text or ""
    for key, value in (context or {}).items():
        replacement = "" if value is None else str(value)
        out = out.replace("${%s}" % key, replacement)     # DLT style, first
        out = out.replace("{%s}" % key, replacement)
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


SMS_TIMEOUT = 15          # seconds; a hung gateway must not hold a request open


def normalise_msisdn(raw: str) -> str:
    """Indian mobile in the 91XXXXXXXXXX form every gateway here expects."""
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    elif len(digits) > 10:
        digits = digits[-10:]
    return f"91{digits}" if len(digits) == 10 else digits


def send_sms(to_phone: str, text: str, dlt_template_id: str = ""):
    """Send one SMS on the platform account. Returns (sent, error).

    Dispatches to whichever gateway Ops selected. Every provider here is a thin
    HTTP call: this stays the single integration point, so adding another is one
    branch rather than a change anywhere else in the codebase.
    """
    import requests

    config = get_config()
    if not config.sms_ready():
        return False, "Platform SMS is not configured (SuperAdmin → Messaging)."
    if not dlt_template_id:
        # Indian carriers reject a send with no DLT id; failing here is more
        # useful than a silent carrier-side drop.
        return False, "This template has no DLT template id, so the carrier would reject it."

    msisdn = normalise_msisdn(to_phone)
    if len(msisdn) != 12:
        return False, f"'{to_phone}' is not a valid 10-digit Indian mobile number."

    provider = (config.sms_provider or "").lower()
    if not provider:
        return False, "No SMS provider selected (SuperAdmin → Messaging)."

    try:
        if provider == "smsgatewayhub":
            # Same call the previous platform made, so an existing account and
            # its approved DLT templates keep working unchanged.
            response = requests.get(
                "https://www.smsgatewayhub.com/api/mt/SendSMS",
                params={
                    "APIKey": config.sms_api_key, "senderid": config.sms_sender_id,
                    "channel": "2", "DCS": "0", "flashsms": "0",
                    "number": msisdn, "text": text, "route": "clickhere",
                    "EntityId": config.sms_entity_id, "dlttemplateid": dlt_template_id,
                },
                timeout=SMS_TIMEOUT,
            )
            if response.status_code >= 400:
                return False, f"Gateway returned HTTP {response.status_code}: {response.text[:200]}"
            # SMSGatewayHub answers 200 with a JSON body; ErrorCode 000 is the
            # only success, everything else is a rejection dressed as a 200.
            try:
                payload = response.json()
            except ValueError:
                return False, f"Gateway returned an unreadable response: {response.text[:200]}"
            if str(payload.get("ErrorCode", "")).strip() != "000":
                return False, (f"Gateway rejected the message: "
                               f"{payload.get('ErrorCode')} {payload.get('ErrorMessage', '')}".strip())
            return True, ""

        if provider == "msg91":
            response = requests.get(
                "https://api.msg91.com/api/sendhttp.php",
                params={
                    "authkey": config.sms_api_key, "mobiles": msisdn, "message": text,
                    "sender": config.sms_sender_id, "route": "4", "country": "91",
                    "DLT_TE_ID": dlt_template_id,
                },
                timeout=SMS_TIMEOUT,
            )
        elif provider == "textlocal":
            response = requests.post(
                "https://api.textlocal.in/send/",
                data={
                    "apikey": config.sms_api_key, "numbers": msisdn, "message": text,
                    "sender": config.sms_sender_id, "dlt_template_id": dlt_template_id,
                },
                timeout=SMS_TIMEOUT,
            )
        elif provider == "generic":
            if not config.sms_endpoint:
                return False, "The generic provider needs an endpoint URL."
            url = (config.sms_endpoint
                   .replace("{phone}", msisdn)
                   .replace("{text}", quote(text))
                   .replace("{sender}", config.sms_sender_id)
                   .replace("{api_key}", config.sms_api_key)
                   .replace("{entity_id}", config.sms_entity_id)
                   .replace("{dlt_template_id}", dlt_template_id))
            response = requests.get(url, timeout=SMS_TIMEOUT)
        else:
            return False, f"Unknown SMS provider '{provider}'."

        if response.status_code >= 400:
            return False, f"Gateway returned HTTP {response.status_code}: {response.text[:200]}"
        body = (response.text or "").strip()
        # Gateways habitually answer 200 with an error body, so a 200 alone is
        # not proof of delivery.
        if any(marker in body.lower() for marker in ("error", "failure", "invalid")):
            return False, f"Gateway rejected the message: {body[:200]}"
        return True, ""
    except Exception as exc:                       # noqa: BLE001 - reported upward
        logger.warning("sms send failed via %s: %s", provider, exc)
        return False, f"{type(exc).__name__}: {exc}"


# ── Push (FCM HTTP v1) ────────────────────────────────────────────────────
# Deliberately the firebase-admin SDK and a service-account JSON, NOT the old
# "FCM server key": Google turned the legacy HTTP API off in June 2024, so a
# server key cannot send anything at all any more.
_fcm_app = None
_fcm_fingerprint = None


def _fcm_app_for(service_account_json: str):
    """Initialise (once) and return the Firebase app for these credentials.

    firebase_admin keeps a process-global app registry, so re-initialising on
    every send would raise. The credentials are re-read only when they actually
    change, which is what lets Ops rotate them without a restart.
    """
    global _fcm_app, _fcm_fingerprint
    import json

    import firebase_admin
    from firebase_admin import credentials

    fingerprint = hash(service_account_json)
    if _fcm_app is not None and _fcm_fingerprint == fingerprint:
        return _fcm_app

    if _fcm_app is not None:                       # credentials changed — swap
        try:
            firebase_admin.delete_app(_fcm_app)
        except Exception:                          # noqa: BLE001
            pass
        _fcm_app = None

    cred = credentials.Certificate(json.loads(service_account_json))
    _fcm_app = firebase_admin.initialize_app(cred, name="kaysetu-push")
    _fcm_fingerprint = fingerprint
    return _fcm_app


def send_push(tokens, title: str, body: str, data: dict | None = None):
    """Push to a list of device tokens. Returns (sent_count, error).

    Best-effort like every other channel here: a Firebase outage must not break
    the notification that triggered it.
    """
    config = get_config()
    if not config.fcm_service_account:
        return 0, "Push is not configured (SuperAdmin → Messaging)."
    tokens = [t for t in (tokens or []) if t]
    if not tokens:
        return 0, "No registered devices."

    try:
        from firebase_admin import messaging as fcm

        app = _fcm_app_for(config.fcm_service_account)
        message = fcm.MulticastMessage(
            tokens=tokens[:500],                   # v1 caps a multicast at 500
            notification=fcm.Notification(title=title, body=body),
            # FCM data values must all be strings, or the send is rejected.
            data={k: str(v) for k, v in (data or {}).items()},
        )
        response = fcm.send_each_for_multicast(message, app=app)
        return int(response.success_count), ""
    except Exception as exc:                       # noqa: BLE001
        logger.warning("push send failed: %s", exc)
        return 0, f"{type(exc).__name__}: {exc}"


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
