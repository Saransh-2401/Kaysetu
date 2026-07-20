"""
Entitlement-aware, import-free access to other modules' models.

Analytics has to read across the whole platform, which would normally mean
importing eleven modules — exactly the coupling the rest of this codebase
refuses. Instead every model is resolved by LABEL at call time and gated on the
tenant's entitlements, so:

  * analytics imports no module, at import time or ever;
  * a module the tenant did not buy simply yields None and its block of the
    dashboard reports zero instead of raising;
  * a module removed from the platform degrades the same way.

`None` from here always means "no data available", never "zero" — callers must
decide which of those the screen should show.
"""
from django.apps import apps as django_apps

from apps.foundation.models import EntitlementSnapshot

# Which module code owns each model. Reading a model whose module is not
# entitled would leak data the tenant is not paying for.
_OWNER = {
    ("orders", "SalesOrder"): "ORDERS",
    ("orders", "SalesOrderItem"): "ORDERS",
    ("orders", "Invoice"): "ORDERS",
    ("orders", "Payment"): "ORDERS",
    ("crm", "Lead"): "CRM",
    ("field", "Visit"): "FIELD",
    ("field", "SalesTarget"): "FIELD",
    ("tracking", "DutyDay"): "TRACK",
    ("inventory", "StockLevel"): "INV",
    ("inventory", "StockLedger"): "INV",
    ("inventory", "Warehouse"): "INV",
    ("books", "JournalLine"): "BOOKS",
    ("purchase", "PurchaseOrder"): "PURCH",
    ("purchase", "MaterialRequest"): "PURCH",
    ("purchase", "PurchaseBill"): "PURCH",
    ("distribution", "StockRequest"): "DIST",
    ("distribution", "StockRequestItem"): "DIST",
    ("distribution", "DistributorInvoice"): "DIST",
    ("production", "WorkOrder"): "PROD",
    ("production", "ProductionPlan"): "PROD",
    ("attendance", "OfficeAttendance"): "ATT",
}


def entitled_modules():
    return set(EntitlementSnapshot.current_modules())


def model(app_label, name, *, modules=None):
    """The model class, or None when its module isn't entitled/installed."""
    owner = _OWNER.get((app_label, name))
    if owner is not None and owner not in (modules if modules is not None else entitled_modules()):
        return None
    try:
        return django_apps.get_model(app_label, name)
    except LookupError:          # module not installed in this deployment
        return None


def has(*module_codes, modules=None):
    available = modules if modules is not None else entitled_modules()
    return all(code in available for code in module_codes)
