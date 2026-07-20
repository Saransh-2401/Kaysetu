from rest_framework import serializers

from apps.foundation.models import Party

from .models import (
    BillPayment,
    GoodsReceipt,
    GoodsReceiptItem,
    MaterialRequest,
    MaterialRequestItem,
    PurchaseBill,
    PurchaseOrder,
    PurchaseOrderItem,
)


class SupplierSerializer(serializers.ModelSerializer):
    """Suppliers ARE foundation Parties (kind=supplier). This maps the shared
    Party row onto the supplier shape the imported portal screens expect;
    purchase-only attributes live in Party.extra."""

    # NOTE: explicitly-declared fields do NOT inherit the model's max_length, so
    # set it here or an over-long value only fails at the DB (500 on Postgres).
    supplier_name = serializers.CharField(source="name", max_length=200)
    supplier_code = serializers.SerializerMethodField()
    tax_id = serializers.CharField(source="gstin", required=False, allow_blank=True, max_length=15)
    business_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    contact_person = serializers.CharField(required=False, allow_blank=True, max_length=150)
    payment_terms = serializers.CharField(required=False, allow_blank=True, max_length=100)
    supplier_group = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=30)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    billing_address = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    po_count = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()

    _EXTRA_FIELDS = ("business_name", "contact_person", "payment_terms",
                     "supplier_group", "notes", "billing_address")

    class Meta:
        model = Party
        fields = [
            "id", "supplier_name", "supplier_code", "business_name", "supplier_group",
            "contact_person", "email", "phone", "tax_id", "payment_terms",
            "billing_address", "notes", "is_active", "po_count", "total_spent", "created_at",
        ]
        read_only_fields = ["created_at"]

    # ---- extras (stored on Party.extra) ----
    def to_representation(self, obj):
        data = super().to_representation(obj)
        extra = obj.extra or {}
        for field in self._EXTRA_FIELDS:
            data[field] = extra.get(field, "")
        return data

    def _split_extra(self, validated):
        return {f: validated.pop(f, "") for f in self._EXTRA_FIELDS if f in validated}

    def create(self, validated_data):
        extra = self._split_extra(validated_data)
        validated_data["kind"] = Party.Kind.SUPPLIER
        party = Party(**validated_data)
        party.extra = {**(party.extra or {}), **extra}
        party.save()
        return party

    def update(self, instance, validated_data):
        extra = self._split_extra(validated_data)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if extra:
            instance.extra = {**(instance.extra or {}), **extra}
        instance.save()
        return instance

    def get_supplier_code(self, obj):
        return (obj.extra or {}).get("supplier_code") or f"SUP-{obj.pk}"

    def get_po_count(self, obj):
        return PurchaseOrder.objects.filter(supplier_id=obj.pk).count()

    def get_total_spent(self, obj):
        from django.db.models import Sum

        total = PurchaseOrder.objects.filter(supplier_id=obj.pk).aggregate(s=Sum("total"))["s"]
        return float(total or 0)


# ------------------------------------------------------------- material requests
class MaterialRequestItemSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, allow_null=True)

    class Meta:
        model = MaterialRequestItem
        fields = ["id", "item", "item_name", "quantity", "estimated_rate",
                  "supplier", "supplier_name", "specification"]


class MaterialRequestSerializer(serializers.ModelSerializer):
    items = MaterialRequestItemSerializer(many=True, read_only=True)
    request_number = serializers.CharField(source="number", read_only=True)   # portal alias
    request_status = serializers.CharField(source="status", read_only=True)   # portal alias
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, allow_null=True)

    class Meta:
        model = MaterialRequest
        fields = ["id", "number", "request_number", "required_date", "purpose", "priority",
                  "status", "request_status", "reject_reason", "total_amount",
                  "created_by", "created_by_name", "items", "status_history",
                  "created_at", "updated_at"]
        # created_by + reject_reason are the approval trail — never client-writable.
        read_only_fields = ["number", "total_amount", "status", "created_by",
                            "reject_reason", "status_history", "created_at", "updated_at"]


# --------------------------------------------------------------- purchase orders
class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    outstanding_quantity = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderItem
        fields = ["id", "item", "item_name", "quantity", "rate", "tax_rate",
                  "amount", "received_quantity", "outstanding_quantity"]

    def get_outstanding_quantity(self, obj):
        return float((obj.quantity or 0) - (obj.received_quantity or 0))


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    po_number = serializers.CharField(source="number", read_only=True)          # portal alias
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    outstanding_amount = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = ["id", "number", "po_number", "supplier", "supplier_name", "order_date",
                  "delivery_date", "material_request", "subtotal", "tax_amount", "total",
                  "status", "receipt_status", "payment_status", "paid_amount",
                  "outstanding_amount", "payment_terms", "payment_reference", "notes",
                  "items", "status_history", "created_at", "updated_at"]
        # supplier/material_request are set at creation only — swapping the supplier
        # on a live PO would desync it from the payable already posted in BOOKS.
        read_only_fields = ["number", "subtotal", "tax_amount", "total", "status",
                            "receipt_status", "payment_status", "paid_amount",
                            "payment_reference", "status_history", "supplier",
                            "material_request", "created_at", "updated_at"]

    def get_outstanding_amount(self, obj):
        return float((obj.total or 0) - (obj.paid_amount or 0))


# ---------------------------------------------------------------- goods receipts
class GoodsReceiptItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoodsReceiptItem
        fields = ["id", "item", "item_name", "quantity_ordered",
                  "quantity_accepted", "quantity_rejected", "rate"]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    items = GoodsReceiptItemSerializer(many=True, read_only=True)
    receipt_number = serializers.CharField(source="number", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    po_number = serializers.CharField(source="purchase_order.number", read_only=True)

    class Meta:
        model = GoodsReceipt
        fields = ["id", "number", "receipt_number", "purchase_order", "po_number",
                  "supplier", "supplier_name", "receipt_date", "warehouse_id",
                  "status", "notes", "items", "created_at"]


# ------------------------------------------------------------------------ bills
class BillPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillPayment
        fields = ["id", "amount", "mode", "reference", "paid_at"]


class PurchaseBillSerializer(serializers.ModelSerializer):
    payments = BillPaymentSerializer(many=True, read_only=True)
    invoice_number = serializers.CharField(source="number", read_only=True)   # portal alias
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    po_number = serializers.CharField(source="purchase_order.number", read_only=True, allow_null=True)
    outstanding_amount = serializers.SerializerMethodField()
    payment_status = serializers.CharField(source="status", read_only=True)   # portal alias

    class Meta:
        model = PurchaseBill
        fields = ["id", "number", "invoice_number", "supplier_invoice_no", "purchase_order",
                  "po_number", "supplier", "supplier_name", "invoice_date", "due_date",
                  "subtotal", "tax_amount", "total", "paid_amount", "outstanding_amount",
                  "status", "payment_status", "payments", "created_at"]

    def get_outstanding_amount(self, obj):
        return float((obj.total or 0) - (obj.paid_amount or 0))
