"""
PROD module — Production. Lives in EACH TENANT'S database.

Bill of Materials -> Work Order -> completion. Finished goods and raw materials
are both foundation CatalogItems; PROD holds no stock of its own. Imports ONLY
foundation.

Integration is event-only:
  * completing a work order emits `prod.materials_consumed` -> INV deducts the
    raw materials, and `prod.goods_produced` -> INV receives the finished goods.
So a manufacturing run turns raw stock into finished stock without PROD ever
importing INV.
"""
from django.db import models


class BillOfMaterials(models.Model):
    """A recipe: how much of each raw material makes `output_quantity` of an item."""

    number = models.CharField(max_length=50, unique=True, db_index=True)
    item = models.ForeignKey(
        "foundation.CatalogItem", on_delete=models.PROTECT, related_name="boms"
    )
    output_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    is_active = models.BooleanField(default=True)
    material_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class BOMItem(models.Model):
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.CASCADE, related_name="materials")
    raw_material = models.ForeignKey(
        "foundation.CatalogItem", on_delete=models.PROTECT, related_name="used_in_boms"
    )
    material_name = models.CharField(max_length=200, blank=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)   # per output_quantity
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]
        unique_together = [("bom", "raw_material")]


class Workstation(models.Model):
    """A machine or station work is routed through."""

    class Type(models.TextChoices):
        MACHINE = "machine", "Machine"
        ASSEMBLY = "assembly", "Assembly"
        PACKAGING = "packaging", "Packaging"
        QUALITY = "quality", "Quality Control"

    name = models.CharField(max_length=200, unique=True)
    workstation_type = models.CharField(max_length=30, choices=Type.choices, default=Type.MACHINE)
    capacity = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                   help_text="Units per hour")
    operating_cost_per_hour = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    power_consumption = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                            help_text="kWh")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class BOMOperation(models.Model):
    """A routing step on a BOM — what is done, where, and for how long."""

    bom = models.ForeignKey(BillOfMaterials, on_delete=models.CASCADE, related_name="operations")
    operation_name = models.CharField(max_length=200)
    workstation = models.ForeignKey(
        Workstation, null=True, blank=True, on_delete=models.SET_NULL, related_name="bom_operations"
    )
    time_in_mins = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    operating_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sequence = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["sequence", "id"]


class ProductionPlan(models.Model):
    """A dated batch of what to make; work orders are raised from its items."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    batch_no = models.CharField(max_length=50, unique=True, db_index=True)
    from_date = models.DateField()
    to_date = models.DateField()
    source = models.CharField(max_length=50, default="Manual")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    progress = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-from_date", "-id"]

    def __str__(self):
        return self.number


class ProductionPlanItem(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    plan = models.ForeignKey(ProductionPlan, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey(
        "foundation.CatalogItem", on_delete=models.PROTECT, related_name="plan_items"
    )
    item_name = models.CharField(max_length=200, blank=True)
    planned_qty = models.DecimalField(max_digits=14, decimal_places=3)
    produced_qty = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)

    class Meta:
        ordering = ["id"]


class WorkOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        RELEASED = "released", "Released"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    production_plan = models.ForeignKey(
        ProductionPlan, null=True, blank=True, on_delete=models.SET_NULL, related_name="work_orders"
    )
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.PROTECT, related_name="work_orders")
    item = models.ForeignKey(
        "foundation.CatalogItem", on_delete=models.PROTECT, related_name="work_orders"
    )
    planned_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    produced_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    # Loose reference to an INV warehouse (INV owns Warehouse); None => default.
    warehouse_id = models.IntegerField(null=True, blank=True)
    has_shortage = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class JobCard(models.Model):
    """One routing operation of a work order, executed at a workstation."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"

    number = models.CharField(max_length=50, unique=True, db_index=True)
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name="job_cards")
    operation = models.ForeignKey(
        BOMOperation, null=True, blank=True, on_delete=models.PROTECT, related_name="job_cards"
    )
    operation_name = models.CharField(max_length=200, blank=True)
    workstation = models.ForeignKey(
        Workstation, null=True, blank=True, on_delete=models.SET_NULL, related_name="job_cards"
    )
    assigned_to = models.ForeignKey(
        "foundation.TenantUser", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="job_cards",
    )
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    for_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    completed_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    remarks = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.number


class WorkOrderMaterial(models.Model):
    """BOM exploded for this order's planned quantity, plus what was consumed."""

    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name="materials")
    raw_material = models.ForeignKey(
        "foundation.CatalogItem", on_delete=models.PROTECT, related_name="work_order_materials"
    )
    material_name = models.CharField(max_length=200, blank=True)
    required_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    consumed_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    available_at_release = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)

    class Meta:
        ordering = ["id"]
        unique_together = [("work_order", "raw_material")]
