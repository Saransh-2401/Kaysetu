/**
 * Frontend mirror of the backend permission catalogue
 * (apps/core/permission_modules.py). The module KEYS must match exactly — the
 * admin matrix UI, the /me/ endpoint, and the seed defaults all key off them.
 */
import type { ModulePermission, PermissionActions } from "./permission-service";

export const PERMISSION_ACTION_KEYS: (keyof PermissionActions)[] = [
  "view", "create", "edit", "delete", "export", "approve", "print",
];

export const ACTION_LABELS: Record<keyof PermissionActions, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete",
  export: "Export", approve: "Approve", print: "Print",
};

export interface ModuleDef {
  key: string;
  label: string;
}
export interface ModuleGroup {
  group: string;
  modules: ModuleDef[];
}

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    group: "Admin",
    modules: [
      { key: "admin_dashboard", label: "Dashboard" },
      { key: "admin_reports", label: "Reports & Analytics" },
      { key: "company_settings", label: "Company Settings" },
      { key: "attendance", label: "Attendance" },
      { key: "users", label: "Users" },
      { key: "notifications", label: "Notifications" },
      { key: "permissions", label: "Permission Matrix" },
    ],
  },
  {
    group: "Sales",
    modules: [
      { key: "sales_team", label: "Sales Team" },
      { key: "sales_targets", label: "Targets & Goals" },
      { key: "leads", label: "Leads" },
      { key: "visits", label: "Field Visits" },
      { key: "customers", label: "Customers" },
      { key: "sales_orders", label: "Sales Orders" },
      { key: "order_history", label: "Order History" },
      { key: "stock_requests", label: "Stock Requests" },
      { key: "backordered", label: "Backordered" },
      { key: "invoices", label: "Invoices" },
      { key: "travel_allowance", label: "Travel Allowance" },
    ],
  },
  {
    group: "Distributor",
    modules: [
      { key: "distributors", label: "Distributors" },
      { key: "distributor_products", label: "Distributor Products" },
      { key: "distributor_invoices", label: "Distributor Invoices" },
      { key: "distributor_requests", label: "Distributor Requests" },
      { key: "distributor_adjustments", label: "Distributor Adjustments" },
    ],
  },
  {
    group: "Masters",
    modules: [
      { key: "items", label: "Item Master" },
      { key: "products", label: "Product Master" },
      { key: "suppliers", label: "Supplier Master" },
      { key: "taxes", label: "Taxes" },
    ],
  },
  {
    group: "Purchase",
    modules: [
      { key: "purchase_orders", label: "Purchase Orders" },
      { key: "material_requests", label: "Material Requests" },
    ],
  },
  {
    group: "Warehouse",
    modules: [
      { key: "warehouse_dashboard", label: "Warehouse Dashboard" },
      { key: "warehouse_reports", label: "Warehouse Reports" },
      { key: "raw_materials", label: "Raw Materials" },
      { key: "our_products", label: "Our Products" },
      { key: "stock_adjustments", label: "Stock Adjustments" },
      { key: "stock_ledger", label: "Stock Ledger" },
    ],
  },
  {
    group: "Production",
    modules: [
      { key: "production_dashboard", label: "Production Dashboard" },
      { key: "production_reports", label: "Production Reports" },
      { key: "bom", label: "Bill of Materials" },
      { key: "production_planning", label: "Production Planning" },
      { key: "work_orders", label: "Work Orders" },
      { key: "job_cards", label: "Job Cards" },
    ],
  },
  {
    group: "Accounts",
    modules: [
      { key: "accounts_dashboard", label: "Accounts Dashboard" },
      { key: "accounts_reports", label: "Accounts Reports" },
      { key: "credit_notes", label: "Credit/Debit Notes" },
      { key: "general_ledger", label: "General Ledger" },
      { key: "customer_ledger", label: "Customer Ledger" },
      { key: "supplier_ledger", label: "Supplier Ledger" },
      { key: "stock_invoices", label: "Stock Invoices" },
    ],
  },
];

export const ALL_MODULE_KEYS: string[] = MODULE_GROUPS.flatMap((g) =>
  g.modules.map((m) => m.key)
);

// Roles whose matrix is editable. Admin always has full access (the backend
// ignores its stored matrix), so it is shown read-only.
// NOTE: MDO and Quality Manager are intentionally omitted — they are not used
// by this deployment. The backend still recognises both roles (FULL_ROLES,
// ROLE_CHOICES) so any existing data/enforcement is unaffected; they're just
// hidden from the role pickers.
export const EDITABLE_ROLES: { slug: string; label: string }[] = [
  { slug: "sales_manager", label: "Sales Manager" },
  { slug: "sales_agent", label: "Sales Agent" },
  { slug: "warehouse_manager", label: "Warehouse Manager" },
  { slug: "production_manager", label: "Production Manager" },
  { slug: "purchase_manager", label: "Purchase Manager" },
  { slug: "accounts_officer", label: "Accounts Officer" },
  { slug: "distributor", label: "Distributor" },
];

export const FULL_ACCESS_ROLES: { slug: string; label: string }[] = [
  { slug: "admin", label: "Administrator" },
];

export function emptyActions(on = false): PermissionActions {
  return {
    view: on, create: on, edit: on, delete: on,
    export: on, approve: on, print: on,
  };
}

/** A full-access module map (every module enabled, every action on). */
export function fullModuleMap(): Record<string, ModulePermission> {
  const map: Record<string, ModulePermission> = {};
  for (const key of ALL_MODULE_KEYS) {
    map[key] = { enabled: true, actions: emptyActions(true) };
  }
  return map;
}

/**
 * Normalise a (possibly partial / unseeded) stored map into a complete map
 * covering every known module, so the grid always renders fully. Missing
 * modules default to enabled (fail-open — matches current behaviour).
 */
export function normaliseModuleMap(
  stored: Record<string, ModulePermission> | undefined,
  fallbackEnabled: boolean
): Record<string, ModulePermission> {
  const map: Record<string, ModulePermission> = {};
  for (const key of ALL_MODULE_KEYS) {
    const s = stored?.[key];
    if (s) {
      map[key] = { enabled: !!s.enabled, actions: { ...emptyActions(), ...s.actions } };
    } else {
      map[key] = { enabled: fallbackEnabled, actions: emptyActions(fallbackEnabled) };
    }
  }
  return map;
}
