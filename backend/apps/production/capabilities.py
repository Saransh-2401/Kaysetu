"""Capabilities PROD provides — recipe + output facts, no imports needed."""


def _bom_for(item_id):
    """The active recipe for a finished item: {bom_id, output_quantity, materials[]}."""
    from .models import BillOfMaterials

    bom = BillOfMaterials.objects.filter(item_id=item_id, is_active=True).order_by("-id").first()
    if bom is None:
        return None
    return {
        "bom_id": bom.pk,
        "output_quantity": float(bom.output_quantity),
        "material_cost": float(bom.material_cost),
        "materials": [
            {"item_id": m.raw_material_id, "name": m.material_name, "quantity": float(m.quantity)}
            for m in bom.materials.all()
        ],
    }


def _produced_quantity(item_id):
    """Total finished quantity produced for an item across completed work orders."""
    from django.db.models import Sum

    from .models import WorkOrder

    total = WorkOrder.objects.filter(item_id=item_id, status=WorkOrder.Status.COMPLETED).aggregate(
        s=Sum("produced_quantity"))["s"]
    return float(total or 0)


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("production.bom_for", "PROD", _bom_for)
    capabilities.provide("production.produced_quantity", "PROD", _produced_quantity)
