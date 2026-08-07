"""
NOTIFY services. `notify_event()` is the ONE entry point every module uses —
nothing else creates a notification, so audience rules, per-user preferences and
quiet hours are applied in exactly one place.

Channel delivery today: `in_app` is real (a feed row). push/email/sms are
resolved and reported but NOT dispatched — no provider is configured, and SMS in
India additionally needs a DLT-registered template per event key. The resolution
result names them so the wiring is a provider away, and callers get an honest
answer about what actually went out rather than a silent no-op.
"""
import logging

from django.db import transaction
from django.utils import timezone

from apps.tenancy.context import require_tenant
from apps.tenancy.db import ensure_alias

from . import events as catalog
from .models import (
    Notification,
    NotificationBroadcast,
    OrgNotificationSetting,
    RoleNotificationDefault,
    UserNotificationProfile,
    UserNotificationSetting,
)

logger = logging.getLogger("kaysetu.notifications")

# Channels we actually dispatch. Email and SMS go out on the PLATFORM account
# (apps.control.messaging) using the platform templates. `push` is still only
# resolved and reported — no push provider is wired yet.
DELIVERABLE_CHANNELS = {"in_app", "email", "sms"}


def _tenant_atomic():
    return transaction.atomic(using=ensure_alias(require_tenant()))


# ------------------------------------------------------------------ resolution
def effective_channels(event_key, *, role_slug=None, user_overrides=None, role_overrides=None,
                       org_overrides=None):
    """catalog default -> ORG setting -> role default -> user override.

    Each layer is sparse and only overrides the channels it names, so an admin
    can switch an event off org-wide without having to edit every role, while a
    role or an individual can still tune it further.
    """
    entry = catalog.event(event_key)
    if entry is None:
        return dict.fromkeys(catalog.CHANNELS, False)
    resolved = dict(entry["defaults"])
    for layer in (org_overrides or {}, role_overrides or {}, user_overrides or {}):
        for channel, on in (layer or {}).items():
            if channel in resolved:
                resolved[channel] = bool(on)
    if entry["mandatory"]:
        # An announcement cannot be silenced entirely — the in-app copy always
        # lands; only the noisier channels are tunable.
        resolved["in_app"] = True
    return resolved


def _role_defaults_for(role_slug):
    if not role_slug:
        return {}
    return {
        row.event_key: row.channels or {}
        for row in RoleNotificationDefault.objects.filter(role_slug=role_slug)
    }


def _user_overrides_for(user_id):
    return {
        row.event_key: row.channels or {}
        for row in UserNotificationSetting.objects.filter(user_id=user_id)
    }


def resolve_for_user(user, event_key):
    role_slug = getattr(getattr(user, "role", None), "slug", None)
    return effective_channels(
        event_key,
        role_slug=role_slug,
        role_overrides=_role_defaults_for(role_slug).get(event_key, {}),
        user_overrides=_user_overrides_for(user.pk).get(event_key, {}),
    )


def _in_quiet_hours(profile, *, now=None):
    if profile is None or not profile.quiet_hours_start or not profile.quiet_hours_end:
        return False
    current = (now or timezone.localtime()).time()
    start, end = profile.quiet_hours_start, profile.quiet_hours_end
    if start <= end:
        return start <= current < end
    return current >= start or current < end   # window wraps past midnight


# --------------------------------------------------------------------- sending
def audience_users(event_key, *, extra_user_ids=None):
    """Everyone whose ROLE puts them in this event's audience, plus anyone the
    caller named explicitly (e.g. the agent a visit was assigned to)."""
    from apps.foundation.models import TenantUser

    entry = catalog.event(event_key)
    qs = TenantUser.objects.filter(is_active=True).select_related("role")
    if entry and entry["audience"]:
        by_role = qs.filter(role__slug__in=entry["audience"])
    else:
        by_role = qs.none()
    if extra_user_ids:
        return (by_role | qs.filter(pk__in=list(extra_user_ids))).distinct()
    return by_role.distinct()


def notify_event(event_key, *, subject, message="", user_ids=None, users=None,
                 reference_doctype="", reference_name="", is_urgent=None, exclude_user_id=None,
                 context=None, force_channels=None):
    """Tell whoever cares that `event_key` happened. Returns a delivery summary.

    Unknown keys are refused loudly: a typo'd event would otherwise notify
    nobody, forever, silently.

    `context` is optional extra data for the message templates (e.g.
    {"order_number": "SO-1024"}). An event template is only used when EVERY
    placeholder it references can be filled from this; otherwise the designed
    general template goes out, so a caller that passes nothing still produces a
    correct email rather than one full of raw {placeholders}.
    """
    entry = catalog.event(event_key)
    if entry is None:
        raise ValueError(f"unknown notification event '{event_key}'")

    recipients = list(users) if users is not None else list(
        audience_users(event_key, extra_user_ids=user_ids)
    )
    if exclude_user_id:   # don't tell someone about their own action
        recipients = [u for u in recipients if u.pk != exclude_user_id]

    urgent = entry["critical"] if is_urgent is None else bool(is_urgent)
    role_cache, created, channel_tally = {}, [], dict.fromkeys(catalog.CHANNELS, 0)
    skipped_muted = 0
    # (user, channels) for everyone resolved onto email/SMS — sent after commit.
    outbound = []

    with _tenant_atomic():
        profiles = {
            p.user_id: p for p in UserNotificationProfile.objects.filter(
                user_id__in=[u.pk for u in recipients])
        }
        user_overrides = {
            row.user_id: row.channels or {}
            for row in UserNotificationSetting.objects.filter(
                user_id__in=[u.pk for u in recipients], event_key=event_key)
        }
        # Org-wide switch for this event — one row, applies to everyone.
        org_row = OrgNotificationSetting.objects.filter(event_key=event_key).first()
        org_overrides = (org_row.channels or {}) if org_row else {}
        for user in recipients:
            role_slug = getattr(getattr(user, "role", None), "slug", None)
            if role_slug not in role_cache:
                role_cache[role_slug] = _role_defaults_for(role_slug)
            channels = effective_channels(
                event_key,
                role_slug=role_slug,
                org_overrides=org_overrides,
                role_overrides=role_cache[role_slug].get(event_key, {}),
                user_overrides=user_overrides.get(user.pk, {}),
            )
            if force_channels is not None:
                # An explicit send (an admin broadcast) means exactly the
                # channels that were ticked — not each person's standing
                # preference. Without this, ticking "Email" on a broadcast did
                # nothing, because the announcement event defaults to in_app +
                # push and email stayed off for everyone.
                channels = {c: (c in force_channels) for c in catalog.CHANNELS}
                if entry["mandatory"]:
                    channels["in_app"] = True
            profile = profiles.get(user.pk)
            # Muting and quiet hours never suppress a critical event, nor a
            # mandatory one (an org-wide announcement must still land).
            if not urgent and not entry["mandatory"] and profile is not None:
                if profile.muted or _in_quiet_hours(profile):
                    skipped_muted += 1
                    continue
            for channel, on in channels.items():
                if on:
                    channel_tally[channel] += 1
            if channels.get("in_app"):
                created.append(Notification(
                    user=user, event_key=event_key, subject=subject, message=message,
                    reference_doctype=reference_doctype, reference_name=reference_name,
                    is_urgent=urgent,
                ))
            if channels.get("email") or channels.get("sms"):
                outbound.append((user, channels))
        if created:
            Notification.objects.bulk_create(created)

    # Dispatch AFTER the transaction: an SMTP round-trip inside it would hold a
    # tenant DB connection open for the length of the send, and a provider
    # timeout would roll back feed items that were perfectly fine.
    sent = _dispatch_external(event_key, outbound, subject, message, context)

    pending = {c: n for c, n in channel_tally.items()
               if n and c not in DELIVERABLE_CHANNELS}
    if pending:
        logger.info("notify %s: %s resolved but no provider configured", event_key, pending)
    return {
        "event": event_key,
        "recipients": len(recipients),
        "delivered_in_app": len(created),
        "delivered_email": sent["email"],
        "delivered_sms": sent["sms"],
        "skipped_muted": skipped_muted,
        "channels": channel_tally,
        "not_dispatched": pending,   # resolved on, but no provider wired yet
    }


def _dispatch_external(event_key, outbound, subject, message, context):
    """Send the email/SMS half of a notification on the PLATFORM account.

    Entirely best-effort: notifications must never break the business operation
    that triggered them, and one bad address must not stop the rest of the batch.
    """
    result = {"email": 0, "sms": 0}
    if not outbound:
        return result

    from apps.control import messaging
    from apps.tenancy.context import get_tenant

    tenant = get_tenant()
    base = {
        "title": subject,
        "message": message,
        "org_name": getattr(tenant, "name", "") or "",
        "org_code": getattr(tenant, "org_code", "") or "",
        **(context or {}),
    }

    for user, channels in outbound:
        payload = {**base, "full_name": user.full_name or user.email}
        if channels.get("email") and user.email:
            try:
                ok, _ = messaging.send_event_email(event_key, user.email, payload)
                if ok:
                    result["email"] += 1
            except Exception:                     # noqa: BLE001
                logger.exception("email for %s -> %s failed", event_key, user.pk)
        if channels.get("sms") and user.phone:
            try:
                ok, _ = messaging.send_event_sms(event_key, user.phone, payload)
                if ok:
                    result["sms"] += 1
            except Exception:                     # noqa: BLE001
                logger.exception("sms for %s -> %s failed", event_key, user.pk)
    return result


def broadcast(*, title, body="", audience_type="all", roles=None, user_ids=None,
              channels=None, sent_by=None):
    """Admin announcement. Recorded as a broadcast AND delivered as feed items."""
    from apps.foundation.models import TenantUser

    if not title:
        raise ValueError("a broadcast needs a title")
    qs = TenantUser.objects.filter(is_active=True).select_related("role")
    warnings = []
    if audience_type == NotificationBroadcast.Audience.ROLES:
        roles = [r for r in (roles or []) if r]
        if not roles:
            raise ValueError("select at least one role")
        recipients = list(qs.filter(role__slug__in=roles))
        missing = set(roles) - {getattr(u.role, "slug", None) for u in recipients}
        if missing:
            warnings.append(f"no active users in role(s): {', '.join(sorted(missing))}")
    elif audience_type == NotificationBroadcast.Audience.USERS:
        user_ids = [u for u in (user_ids or []) if u]
        if not user_ids:
            raise ValueError("select at least one person")
        recipients = list(qs.filter(pk__in=user_ids))
        missing = set(user_ids) - {u.pk for u in recipients}
        if missing:
            warnings.append(f"{len(missing)} selected user(s) are inactive or unknown")
    else:
        recipients = list(qs)
    if not recipients:
        warnings.append("nobody matched — nothing was sent")

    with _tenant_atomic():
        record = NotificationBroadcast.objects.create(
            title=title, body=body, audience_type=audience_type,
            roles=roles or [], recipient_user_ids=[u.pk for u in recipients],
            channels=channels or ["in_app"], recipient_count=len(recipients), sent_by=sent_by,
        )
        result = notify_event(
            "announcement", subject=title, message=body, users=recipients,
            reference_doctype="broadcast", reference_name=str(record.pk),
            # Honour exactly what the admin ticked. These were recorded on the
            # broadcast row but never reached delivery, so choosing "Email" sent
            # no email — the announcement event defaults to in_app + push.
            force_channels=channels or ["in_app"],
        ) if recipients else {"delivered_in_app": 0}
    return record, warnings, result


# ------------------------------------------------------------------- feed ops
def mark_read(notification):
    if notification.status != Notification.Status.READ:
        notification.status = Notification.Status.READ
        notification.read_at = timezone.now()
        notification.save(update_fields=["status", "read_at"])
    return notification


def mark_all_read(user):
    return Notification.objects.filter(
        user=user, status=Notification.Status.UNREAD
    ).update(status=Notification.Status.READ, read_at=timezone.now())


def summary(user):
    qs = Notification.objects.filter(user=user)
    return {"unread": qs.filter(status=Notification.Status.UNREAD).count(), "total": qs.count()}
