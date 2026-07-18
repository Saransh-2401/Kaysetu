from rest_framework import serializers

from .models import (
    BillOfMaterials,
    BOMItem,
    BOMOperation,
    JobCard,
    ProductionPlan,
    ProductionPlanItem,
    WorkOrder,
    WorkOrderMaterial,
    Workstation,
)


class WorkstationSerializer(serializers.ModelSerializer):
    # portal alias (Old Project used workstation_name)
    workstation_name = serializers.CharField(source="name", max_length=200)

    class Meta:
        model = Workstation
        fields = ["id", "name", "workstation_name", "workstation_type", "capacity",
                  "operating_cost_per_hour", "power_consumption", "is_active", "created_at"]
        read_only_fields = ["name", "created_at"]


class BOMOperationSerializer(serializers.ModelSerializer):
    workstation_name = serializers.CharField(source="workstation.name", read_only=True,
                                             allow_null=True)

    class Meta:
        model = BOMOperation
        fields = ["id", "operation_name", "workstation", "workstation_name",
                  "time_in_mins", "operating_cost", "sequence"]


class BOMItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BOMItem
        fields = ["id", "raw_material", "material_name", "quantity", "rate", "amount"]


class BillOfMaterialsSerializer(serializers.ModelSerializer):
    materials = BOMItemSerializer(many=True, read_only=True)
    # portal aliases: it reads raw_materials + operations
    raw_materials = BOMItemSerializer(many=True, read_only=True, source="materials")
    operations = BOMOperationSerializer(many=True, read_only=True)
    bom_number = serializers.CharField(source="number", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = BillOfMaterials
        fields = ["id", "number", "bom_number", "item", "item_name", "output_quantity",
                  "is_active", "material_cost", "notes", "materials", "raw_materials",
                  "operations", "created_at", "updated_at"]
        read_only_fields = ["number", "material_cost", "item", "output_quantity",
                            "created_at", "updated_at"]


class ProductionPlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionPlanItem
        fields = ["id", "item", "item_name", "planned_qty", "produced_qty", "priority"]


class ProductionPlanSerializer(serializers.ModelSerializer):
    items = ProductionPlanItemSerializer(many=True, read_only=True)
    plan_number = serializers.CharField(source="number", read_only=True)   # portal alias

    class Meta:
        model = ProductionPlan
        fields = ["id", "number", "plan_number", "batch_no", "from_date", "to_date",
                  "source", "status", "progress", "notes", "items", "created_at", "updated_at"]
        read_only_fields = ["number", "batch_no", "status", "progress", "created_at", "updated_at"]


class JobCardSerializer(serializers.ModelSerializer):
    job_card_number = serializers.CharField(source="number", read_only=True)   # portal alias
    work_order_number = serializers.CharField(source="work_order.number", read_only=True)
    workstation_name = serializers.CharField(source="workstation.name", read_only=True,
                                             allow_null=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True,
                                             allow_null=True)

    class Meta:
        model = JobCard
        fields = ["id", "number", "job_card_number", "work_order", "work_order_number",
                  "operation", "operation_name", "workstation", "workstation_name",
                  "assigned_to", "assigned_to_name", "start_time", "end_time",
                  "for_quantity", "completed_quantity", "status", "remarks", "created_at"]
        read_only_fields = ["number", "status", "completed_quantity", "end_time", "created_at"]


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
    job_cards = JobCardSerializer(many=True, read_only=True)
    # portal aliases
    work_order_number = serializers.CharField(source="number", read_only=True)
    quantity_to_produce = serializers.DecimalField(source="planned_quantity", max_digits=14,
                                                   decimal_places=3, read_only=True)
    plan_number = serializers.CharField(source="production_plan.number", read_only=True,
                                        allow_null=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    bom_number = serializers.CharField(source="bom.number", read_only=True)
    completion_percentage = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        fields = ["id", "number", "work_order_number", "production_plan", "plan_number",
                  "bom", "bom_number", "item", "item_name", "planned_quantity",
                  "quantity_to_produce", "produced_quantity", "completion_percentage",
                  "status", "start_date", "end_date", "warehouse_id", "has_shortage",
                  "notes", "materials", "job_cards", "created_at", "updated_at"]
        read_only_fields = ["number", "item", "produced_quantity", "status", "has_shortage",
                            "bom", "planned_quantity", "created_at", "updated_at"]

    def get_completion_percentage(self, obj):
        if not obj.planned_quantity:
            return 0.0
        return float(round((obj.produced_quantity or 0) / obj.planned_quantity * 100, 2))
