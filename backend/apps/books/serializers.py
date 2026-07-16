from rest_framework import serializers

from apps.foundation.models import Party

from .models import Account, JournalEntry, JournalLine


class AccountSerializer(serializers.ModelSerializer):
    parent_account_name = serializers.CharField(source="parent.name", read_only=True, allow_null=True)
    # portal-compat aliases (Old Project used account_number/account_name)
    account_number = serializers.CharField(source="code")
    account_name = serializers.CharField(source="name")

    class Meta:
        model = Account
        fields = [
            "id", "account_name", "account_number", "account_type",
            "parent", "parent_account_name", "is_group", "is_active",
            "system_key", "description", "created_at",
        ]
        read_only_fields = ["created_at", "system_key"]


class JournalLineSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True)
    party_name = serializers.CharField(source="party.name", read_only=True, allow_null=True)

    class Meta:
        model = JournalLine
        fields = ["id", "account", "account_code", "account_name", "party", "party_name",
                  "debit", "credit", "description"]


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True, read_only=True)
    # portal-compat: Old Project journal serializer exposed `accounts` + `user_remark`
    accounts = JournalLineSerializer(many=True, read_only=True, source="lines")

    class Meta:
        model = JournalEntry
        fields = [
            "id", "number", "posting_date", "narration", "reference", "source",
            "total_debit", "total_credit", "status", "lines", "accounts", "created_at",
        ]
        read_only_fields = ["number", "total_debit", "total_credit", "status", "created_at"]


class JournalLineWriteSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    party = serializers.PrimaryKeyRelatedField(
        queryset=Party.objects.all(), required=False, allow_null=True
    )
    debit = serializers.DecimalField(max_digits=15, decimal_places=2, default=0, min_value=0)
    credit = serializers.DecimalField(max_digits=15, decimal_places=2, default=0, min_value=0)
    description = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, data):
        debit, credit = data.get("debit", 0), data.get("credit", 0)
        if debit > 0 and credit > 0:
            raise serializers.ValidationError("A line cannot have both a debit and a credit.")
        if debit == 0 and credit == 0:
            raise serializers.ValidationError("A line needs a non-zero debit or credit.")
        return data


class JournalEntryCreateSerializer(serializers.Serializer):
    """Manual journal entry with balanced lines (debits must equal credits)."""

    posting_date = serializers.DateField()
    narration = serializers.CharField(required=False, allow_blank=True, default="")
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    lines = JournalLineWriteSerializer(many=True)

    def validate_lines(self, lines):
        if len(lines) < 2:
            raise serializers.ValidationError("A journal entry needs at least two lines.")
        return lines

    def validate(self, data):
        total_debit = sum(l["debit"] for l in data["lines"])
        total_credit = sum(l["credit"] for l in data["lines"])
        if total_debit != total_credit:
            raise serializers.ValidationError("Total debits must equal total credits.")
        if total_debit == 0:
            raise serializers.ValidationError("Journal entry total cannot be zero.")
        return data

    def create(self, validated_data):
        from . import services

        lines = [
            {"account": l["account"], "party": l.get("party"),
             "debit": l["debit"], "credit": l["credit"], "description": l.get("description", "")}
            for l in validated_data["lines"]
        ]
        return services.post_journal(
            posting_date=validated_data["posting_date"],
            narration=validated_data.get("narration", ""),
            reference=validated_data.get("reference", ""),
            lines=lines,
        )
