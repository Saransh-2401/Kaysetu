from rest_framework import serializers

from .models import DeviceDiagnostic, DutyDay, RouteHistory, TrackingSettings


class DutyDaySerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    is_punched_in = serializers.BooleanField(read_only=True)

    class Meta:
        model = DutyDay
        fields = [
            "id", "agent", "agent_name", "date", "punch_in_time", "punch_out_time",
            "punch_out_type", "start_location", "end_location", "punch_in_selfie",
            "mock_detected", "last_location_at", "distance_traveled_km", "working_hours",
            "allowance_basis", "is_punched_in", "created_at",
        ]  # location_track intentionally omitted (fetch via day-route)


class DeviceDiagnosticSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceDiagnostic
        fields = [
            "id", "agent", "created_at", "client_time", "event", "detail",
            "device_model", "os_version", "app_version",
        ]


class RouteHistorySerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.full_name", read_only=True)
    route_points = serializers.SerializerMethodField()

    class Meta:
        model = RouteHistory
        fields = [
            "id", "agent", "agent_name", "date", "routes", "route_points",
            "distance_km", "visit_count", "status", "created_at",
        ]

    def get_route_points(self, obj):
        return len(obj.routes or [])


class TrackingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrackingSettings
        fields = [
            "offline_threshold_min", "geofence_radius_m", "auto_punchout_enabled",
            "auto_punchout_time", "interval_moving_s", "interval_idle_s",
            "upload_interval_s", "track_window_start", "track_window_end", "updated_at",
        ]
        read_only_fields = ["updated_at"]
