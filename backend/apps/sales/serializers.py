from rest_framework import serializers

from .models import (
    AdjustmentNote,
    ManualInvoice,
    ManualInvoiceItem,
    PaymentEntry,
    SalesInvoice,
    SalesInvoiceItem,
)


class SalesInvoiceItemSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True, default="")
    product_name = serializers.CharField(source="item_name", read_only=True)

    class Meta:
        model = SalesInvoiceItem
        fields = [
            "id", "item", "item_name", "item_code", "product_name", "hsn_code", "description",
            "quantity", "rate", "amount", "tax_rate",
            "cgst_rate", "sgst_rate", "igst_rate",
            "cgst_amount", "sgst_amount", "igst_amount",
            "taxable_value", "tax_amount", "total_price",
        ]


class SalesInvoiceSerializer(serializers.ModelSerializer):
    items = SalesInvoiceItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name",
                                            read_only=True, default="")
    # Portal alias: its table reads `status`, the model's field is payment_status.
    status = serializers.CharField(source="payment_status", read_only=True)
    sales_order = serializers.IntegerField(source="sales_order_id", read_only=True)

    class Meta:
        model = SalesInvoice
        fields = [
            "id", "invoice_number", "customer", "customer_name", "sales_order",
            "sales_order_number", "invoice_date", "due_date",
            "is_tax_inclusive", "tax_input_mode", "is_igst",
            "subtotal", "cgst_amount", "sgst_amount", "igst_amount", "tax_amount",
            "discount_type", "discount_value", "discount_amount",
            "total", "paid_amount", "adjustment_total", "outstanding_amount",
            "payment_status", "status",
            "payment_reference", "notes", "items", "created_by", "created_by_name",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class ManualInvoiceItemSerializer(serializers.ModelSerializer):
    # Frontend-compat aliases the ported modal reads.
    taxable_value = serializers.DecimalField(source="taxable_amount", max_digits=15,
                                             decimal_places=2, read_only=True)
    total = serializers.DecimalField(source="total_amount", max_digits=15,
                                     decimal_places=2, read_only=True)

    class Meta:
        model = ManualInvoiceItem
        fields = ["id", "item_name", "hsn_code", "quantity", "unit_price", "tax_percentage",
                  "taxable_amount", "taxable_value", "tax_amount", "cgst_amount",
                  "sgst_amount", "igst_amount", "total_amount", "total"]


class ManualInvoiceSerializer(serializers.ModelSerializer):
    items = ManualInvoiceItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name",
                                            read_only=True, default="")

    class Meta:
        model = ManualInvoice
        fields = [
            "id", "invoice_number", "customer_name", "customer_address", "customer_gstin",
            "invoice_date", "due_date", "tax_type", "is_tax_inclusive",
            "subtotal", "tax_amount", "cgst_amount", "sgst_amount", "igst_amount",
            "discount_amount", "advance_paid", "round_off", "grand_total",
            "payment_reference", "payment_date", "notes", "status",
            "created_by", "created_by_name", "items", "created_at", "updated_at",
        ]
        # Every money field is derived server-side from the lines.
        read_only_fields = fields


class PaymentEntrySerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="sales_invoice.invoice_number",
                                           read_only=True, default="")
    customer_name = serializers.CharField(source="sales_invoice.customer.name",
                                          read_only=True, default="")
    sales_order = serializers.IntegerField(source="sales_order_id", read_only=True)

    class Meta:
        model = PaymentEntry
        fields = ["id", "payment_number", "sales_invoice", "sales_order", "invoice_number",
                  "customer_name", "payment_date", "amount", "mode", "company_bank_account",
                  "reference_no", "status", "remarks", "created_at"]
        read_only_fields = fields


class AdjustmentNoteSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    stock_request_invoice = serializers.IntegerField(source="distributor_invoice_id",
                                                     read_only=True)

    class Meta:
        model = AdjustmentNote
        fields = ["id", "note_number", "note_type", "sales_invoice", "manual_invoice",
                  "stock_request_invoice", "adjustment_amount", "reason", "adjustment_date",
                  "status", "customer_name", "invoice_number", "created_at"]
        read_only_fields = fields

    def get_customer_name(self, obj):
        if obj.sales_invoice_id and obj.sales_invoice.customer_id:
            return obj.sales_invoice.customer.name
        if obj.manual_invoice_id:
            return obj.manual_invoice.customer_name
        return "N/A"

    def get_invoice_number(self, obj):
        if obj.sales_invoice_id:
            return obj.sales_invoice.invoice_number
        if obj.manual_invoice_id:
            return obj.manual_invoice.invoice_number
        return "N/A"
