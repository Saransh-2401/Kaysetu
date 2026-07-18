from rest_framework import serializers

from .models import BillOfMaterials, BOMItem, WorkOrder, WorkOrderMaterial


class BOMItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BOMItem
        fields = ["id", "raw_material", "material_name", "quantity", "rate", "amount"]


class BillOfMaterialsSerializer(serializers.ModelSerializer):
    materials = BOMItemSerializer(many=True, read_only=True)
    bom_number = serializers.CharField(source="number", read_only=True)   # portal alias
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = BillOfMaterials
        fields = ["id", "number", "bom_number", "item", "item_name", "output_quantity",
                  "is_active", "material_cost", "notes", "materials", "created_at", "updated_at"]
        read_only_fields = ["number", "material_cost", "item", "output_quantity",
                            "created_at", "updated_at"]


class WorkOrderMaterialSerializer(serializers.ModelSerializer):
    shortfall = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrderMaterial
        fields = ["id", "raw_material", "material_name", "required_quantity",
                  "consumed_quantity", "available_at_release", "shortfall"]

    def get_shortfall(self, obj):
        if obj.available_at_release is None:
            return None
        return float(max(0, obj.required_quantity - obj.available_at_release))


class WorkOrderSerializer(serializers.ModelSerializer):
    materials = WorkOrderMaterialSerializer(many=True, read_only=True)
    work_order_number = serializers.CharField(source="number", read_only=True)   # portal alias
    item_name = serializers.CharField(source="item.name", read_only=True)
    bom_number = serializers.CharField(source="bom.number", read_only=True)

    class Meta:
        model = WorkOrder
        fields = ["id", "number", "work_order_number", "bom", "bom_number", "item", "item_name",
                  "planned_quantity", "produced_quantity", "status", "start_date", "end_date",
                  "warehouse_id", "has_shortage", "notes", "materials", "created_at", "updated_at"]
        read_only_fields = ["number", "item", "produced_quantity", "status", "has_shortage",
                            "bom", "planned_quantity", "created_at", "updated_at"]
