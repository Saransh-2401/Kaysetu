from rest_framework import serializers

from .models import Holiday, LeaveRequest, LeaveType, OfficeAttendance


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name", "is_optional"]


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ["id", "name", "days_per_year", "is_paid", "is_active"]


class OfficeAttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    is_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = OfficeAttendance
        fields = ["id", "user", "user_name", "date", "check_in_time", "check_out_time",
                  "check_out_type", "working_hours", "checked_out_by", "is_open", "notes"]
        read_only_fields = fields


class LeaveRequestSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    decided_by_name = serializers.CharField(source="decided_by.full_name",
                                            read_only=True, allow_null=True)

    class Meta:
        model = LeaveRequest
        fields = ["id", "user", "user_name", "leave_type", "leave_type_name", "from_date",
                  "to_date", "days", "reason", "status", "decision_note", "decided_by",
                  "decided_by_name", "decided_at", "created_at"]
        read_only_fields = ["user", "days", "status", "decision_note", "decided_by",
                            "decided_at", "created_at"]
