"""
NOTIFY — the notification system. Lives in EACH TENANT'S database.

Unlike the eleven sellable modules this is CORE: every tenant gets it, because a
platform that can't tell you an order arrived isn't sellable in any package. It
imports only foundation.

Three layers decide whether a person hears about something:
    catalog default  (apps/notifications/events.py, ships with the code)
    -> role default  (RoleNotificationDefault, per tenant)
    -> user override (UserNotificationSetting, per person)
Each layer is SPARSE — it only records the channels it actually changes — so a
later catalog change still reaches everyone who never expressed an opinion.
"""
from django.db import models


class Notification(models.Model):
    """One item in a user's in-app feed."""

    class Status(models.TextChoices):
        UNREAD = "unread", "Unread"
        READ = "read", "Read"

    user = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="notifications"
    )
    event_key = models.CharField(max_length=64, db_index=True)
    subject = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    # Loose pointer to whatever this is about (an order, a claim). Deliberately
    # not a FK: the target lives in whichever module raised it, and that module
    # may not even be installed.
    reference_doctype = models.CharField(max_length=64, blank=True)
    reference_name = models.CharField(max_length=120, blank=True)
    is_urgent = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UNREAD)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    @property
    def is_read(self):
        return self.status == self.Status.READ

    def __str__(self):
        return f"{self.event_key} -> {self.user_id}"


class OrgNotificationSetting(models.Model):
    """Whether an event is on AT ALL for this organisation — the widest layer.

    Sits between the shipped catalog defaults and the per-role policy, so an
    admin can switch a whole event off (or turn its email/SMS on) for everyone
    at once without editing every role. This is what the portal's "System Alerts"
    screen writes; before it existed that screen toggled message templates,
    which did nothing.
    """

    event_key = models.CharField(max_length=64, unique=True, db_index=True)
    # Sparse: only the channels this layer actually overrides.
    channels = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["event_key"]

    def __str__(self):
        return f"org:{self.event_key}"


class RoleNotificationDefault(models.Model):
    """What a ROLE hears by default — the tenant admin's policy layer."""

    role_slug = models.CharField(max_length=50, db_index=True)
    event_key = models.CharField(max_length=64, db_index=True)
    # Sparse: only the channels this layer actually overrides.
    channels = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("role_slug", "event_key")]
        ordering = ["role_slug", "event_key"]


class UserNotificationSetting(models.Model):
    """What ONE person hears — their personal override, highest precedence."""

    user = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="notification_settings"
    )
    event_key = models.CharField(max_length=64, db_index=True)
    channels = models.JSONField(default=dict, blank=True)   # sparse
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "event_key")]
        ordering = ["user_id", "event_key"]


class UserNotificationProfile(models.Model):
    """Per-user switches that apply across every event."""

    user = models.OneToOneField(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="notification_profile"
    )
    muted = models.BooleanField(default=False)
    # Outside-hours suppression for NON-critical events; a critical event
    # (an agent going offline) still gets through.
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class NotificationBroadcast(models.Model):
    """An admin message sent to everyone / some roles / named people."""

    class Audience(models.TextChoices):
        ALL = "all", "Everyone"
        ROLES = "roles", "Selected roles"
        USERS = "users", "Selected people"

    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    audience_type = models.CharField(max_length=10, choices=Audience.choices,
                                     default=Audience.ALL)
    roles = models.JSONField(default=list, blank=True)
    recipient_user_ids = models.JSONField(default=list, blank=True)
    channels = models.JSONField(default=list, blank=True)
    recipient_count = models.PositiveIntegerField(default=0)
    sent_by = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="broadcasts_sent",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class DeviceToken(models.Model):
    """An FCM registration token for one signed-in device.

    Tenant-side because a token belongs to a tenant user, while the Firebase
    credentials that send to it are platform-side (KaySetu owns the project and
    pays for it) — same split as email and SMS.

    One user can have several devices, so tokens are unique on their own rather
    than per user. A token is reassigned on conflict instead of duplicated:
    handsets get passed on, and FCM would otherwise deliver to the wrong person.
    """

    class Platform(models.TextChoices):
        ANDROID = "android", "Android"
        IOS = "ios", "iOS"
        WEB = "web", "Web"

    user = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="device_tokens"
    )
    token = models.CharField(max_length=255, unique=True, db_index=True)
    platform = models.CharField(max_length=10, choices=Platform.choices, default=Platform.ANDROID)
    is_active = models.BooleanField(default=True)
    last_seen = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_seen"]
        indexes = [models.Index(fields=["user", "is_active"])]

    def __str__(self):
        return f"{self.platform}:{self.token[:12]}…"
