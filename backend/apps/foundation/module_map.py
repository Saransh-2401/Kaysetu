"""
Maps the portal's fine-grained permission module keys (the ~50 keys the
existing sidebars gate on) to our sellable packages/modules.

This is what turns "which packages did the tenant buy" into "which sidebar
sections are visible" — WITHOUT rewriting the 8 role sidebars. The portal's
matrix endpoint (/core/role-permissions/me/) marks every module key belonging
to an un-entitled package as {enabled: false}; the portal's existing (fail-open)
filterMenuByPermissions then hides those items.

`None` = platform-core: always enabled regardless of packages (company
settings, users, notifications, product/customer master data, taxes, etc.).

Keep the keys in exact sync with the portal's lib/permission-modules.ts.
This mapping is a PRODUCT decision (what each package includes) — review it
against docs/SAAS_PACKAGE_BLUEPRINT.md when packages change.
"""

# moduleKey -> package code, a tuple of codes (visible if ANY is entitled),
# or None for platform-core / always-on.
MODULE_PACKAGE_MAP: dict[str, "str | tuple[str, ...] | None"] = {
    # --- Admin / platform-core (always visible) ---
    "admin_dashboard": None,
    "admin_reports": None,
    "company_settings": None,
    "users": None,
    "app_updates": None,
    "notifications": None,
    "permissions": None,
    "logs": None,
    # --- Attendance ---
    # The portal's single Attendance screen shows BOTH field-staff (GPS) data
    # — part of TRACK — and office punch/leave — part of the ATT add-on. Visible
    # if EITHER package is entitled (OR-mapping).
    "attendance": ("TRACK", "ATT"),
    # --- Field Sales Operations ---
    "sales_team": "FIELD",
    "sales_targets": "FIELD",
    "visits": "FIELD",
    # --- CRM (Leads & Pipeline) ---
    "leads": "CRM",
    # Shared master data (Foundation Core parties/catalog/taxes) -> always on.
    "customers": None,
    "suppliers": None,
    "products": None,
    "items": None,
    "taxes": None,
    # --- Sales Orders & Dispatch ---
    "sales_orders": "ORDERS",
    "order_history": "ORDERS",
    "backordered": "ORDERS",
    "stock_requests": "ORDERS",
    "invoices": "ORDERS",
    # --- Distribution Network ---
    "distributors": "DIST",
    "distributor_products": "DIST",
    "distributor_invoices": "DIST",
    "distributor_requests": "DIST",
    "distributor_adjustments": "DIST",
    # --- Procurement ---
    "purchase_orders": "PURCH",
    "material_requests": "PURCH",
    # --- Inventory & Warehouse ---
    "warehouse_dashboard": "INV",
    "warehouse_reports": "INV",
    "raw_materials": "INV",
    "our_products": "INV",
    "stock_adjustments": "INV",
    "stock_ledger": "INV",
    # --- Production ---
    "production_dashboard": "PROD",
    "production_reports": "PROD",
    "bom": "PROD",
    "production_planning": "PROD",
    "work_orders": "PROD",
    "job_cards": "PROD",
    # --- Accounts & Finance ---
    "accounts_dashboard": "BOOKS",
    "accounts_reports": "BOOKS",
    "credit_notes": "BOOKS",
    "general_ledger": "BOOKS",
    "customer_ledger": "BOOKS",
    "supplier_ledger": "BOOKS",
    "stock_invoices": "BOOKS",
    # --- Live Tracking ---
    "tracking_health": "TRACK",
    # --- Travel Allowance ---
    "travel_allowance": "TA",
}

ALL_ACTIONS = ["view", "create", "edit", "delete", "export", "approve", "print"]


def module_enabled(module_key: str, entitled_modules: set[str]) -> bool:
    """A module key is visible when it is platform-core (None), its package is
    entitled, or (for OR-mapped keys) ANY of its packages is entitled. Unknown
    keys default to visible (platform-core)."""
    package = MODULE_PACKAGE_MAP.get(module_key)
    if package is None:
        return True
    if isinstance(package, (tuple, list, set)):
        return any(p in entitled_modules for p in package)
    return package in entitled_modules


def build_effective_permissions(*, role_slug: str, is_owner: bool, entitled_modules) -> dict:
    """Produce the portal's EffectivePermissions shape with un-entitled
    packages disabled. is_full is False so per-module `enabled` flags are
    honoured (that is what actually enforces package gating in the portal).

    Per-role fine-grained restriction (the tenant admin's Permission Matrix
    editor) layers on top of this later; for now every entitled module is
    fully actionable.
    """
    entitled = set(entitled_modules or [])
    permissions: dict[str, dict] = {}
    for module_key in MODULE_PACKAGE_MAP:
        enabled = module_enabled(module_key, entitled)
        permissions[module_key] = {
            "enabled": enabled,
            "actions": {action: enabled for action in ALL_ACTIONS},
        }
    return {
        "role": role_slug or "",
        "access_type": "full" if (is_owner or role_slug == "admin") else "custom",
        # Deliberately False: the portal short-circuits gating on is_full=true,
        # which would defeat package entitlement. Keep it False so `enabled`
        # flags decide visibility.
        "is_full": False,
        "permissions": permissions,
    }
