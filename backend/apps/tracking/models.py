"""
TRACK module models — Agent Live Tracking. Live in EACH TENANT'S database.

Ported from the previous platform's field_sales.DailyReport / DeviceDiagnostic
and admin_module.RouteHistory, but reduced to the PURE GPS + attendance core:
no visits/orders/leads metrics (those belong to the FIELD module, which
consumes this module's data via the capability registry — never by import).

The only FK is to foundation.TenantUser (same tenant DB). No import of, or FK
to, any other module app.
"""
from django.db import models


class DutyDay(models.Model):
    """One agent's attendance + GPS track for one day (was field_sales.DailyReport)."""

    class PunchOutType(models.TextChoices):
        MANUAL = "manual", "Manual"
        AUTO = "auto", "Auto"

    class AllowanceBasis(models.TextChoices):
        HOME = "home", "Home"
        OFFICE = "office", "Office"

    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="duty_days"
    )
    date = models.DateField()

    punch_in_time = models.DateTimeField(null=True, blank=True)
    punch_out_time = models.DateTimeField(null=True, blank=True)
    punch_out_type = models.CharField(max_length=6, choices=PunchOutType.choices, blank=True)
    start_location = models.JSONField(default=dict, blank=True)  # {lat,lng,address}
    end_location = models.JSONField(default=dict, blank=True)
    punch_in_selfie = models.URLField(max_length=1000, blank=True)

    # The day's GPS points: [{timestamp, lat, lng, accuracy, is_mocked, suspect, ...}]
    location_track = models.JSONField(default=list, blank=True)
    mock_detected = models.BooleanField(default=False)
    mock_point_count = models.IntegerField(default=0)  # cumulative; DO NOT display (over-counts)
    last_location_at = models.DateTimeField(null=True, blank=True)   # GPS liveness anchor
    offline_alert_sent_at = models.DateTimeField(null=True, blank=True)  # offline-alert dedupe

    distance_traveled_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    # Home-vs-office basis for the Travel Allowance module (set by admin at EOD).
    allowance_basis = models.CharField(max_length=10, choices=AllowanceBasis.choices, blank=True)
    edit_logs = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("agent", "date")]
        indexes = [models.Index(fields=["agent", "-date"])]
        ordering = ["-date"]

    @property
    def is_punched_in(self) -> bool:
        return self.punch_in_time is not None and self.punch_out_time is None

    def __str__(self):
        return f"{self.agent_id} {self.date}"


class DeviceDiagnostic(models.Model):
    """Device telemetry for root-causing tracking failures (was field_sales.DeviceDiagnostic)."""

    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="device_diagnostics"
    )
    created_at = models.DateTimeField(auto_now_add=True)  # server receipt
    client_time = models.DateTimeField(null=True, blank=True)
    event = models.CharField(max_length=40, db_index=True)
    detail = models.JSONField(default=dict, blank=True)
    device_model = models.CharField(max_length=120, blank=True)
    os_version = models.CharField(max_length=60, blank=True)
    app_version = models.CharField(max_length=40, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["agent", "-created_at"]),
            models.Index(fields=["event", "-created_at"]),
        ]
        ordering = ["-created_at"]


class RouteHistory(models.Model):
    """Nightly per-agent GPS rollup (was admin_module.RouteHistory; company FK
    dropped — the tenant DB already scopes it). visit_count is fed by the FIELD
    module via a capability when present, else 0."""

    agent = models.ForeignKey(
        "foundation.TenantUser", on_delete=models.CASCADE, related_name="route_history"
    )
    date = models.DateField()
    routes = models.JSONField(default=list, blank=True)  # cleaned [{lat,lng,timestamp}]
    distance_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    visit_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default="completed")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("agent", "date")]
        indexes = [models.Index(fields=["agent", "-date"])]
        ordering = ["-date"]
        verbose_name_plural = "Route histories"


class TrackingSettings(models.Model):
    """Per-tenant tracking config singleton (pk=1). Replaces the previous
    platform's Django settings + single-Company office_end_time."""

    offline_threshold_min = models.PositiveIntegerField(default=15)
    geofence_radius_m = models.PositiveIntegerField(default=150)
    auto_punchout_enabled = models.BooleanField(default=True)
    auto_punchout_time = models.TimeField(default="18:00")
    # Adaptive capture cadence hints sent to the mobile app (seconds).
    interval_moving_s = models.PositiveIntegerField(default=15)
    interval_idle_s = models.PositiveIntegerField(default=120)
    upload_interval_s = models.PositiveIntegerField(default=60)
    # Duty window ("only track 9am-7pm"); blank = all day while punched in.
    track_window_start = models.TimeField(null=True, blank=True)
    track_window_end = models.TimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Tracking settings"

    @classmethod
    def get(cls) -> "TrackingSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
