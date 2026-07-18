from rest_framework import serializers

from .models import Notification, NotificationBroadcast


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "event_key", "subject", "message", "reference_doctype",
                  "reference_name", "is_urgent", "status", "read_at", "created_at", "is_read"]
        read_only_fields = fields


class BroadcastSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source="sent_by.full_name", read_only=True,
                                         default="")

    class Meta:
        model = NotificationBroadcast
        fields = ["id", "title", "body", "audience_type", "roles", "recipient_user_ids",
                  "channels", "recipient_count", "sent_by", "sent_by_name", "created_at"]
        read_only_fields = ["recipient_count", "recipient_user_ids", "sent_by", "created_at"]
