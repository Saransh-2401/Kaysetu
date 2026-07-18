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


class WorkOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        RELEASED = "released", "Released"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=50, unique=True, db_index=True)
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
