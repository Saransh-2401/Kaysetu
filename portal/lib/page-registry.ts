/**
 * Central registry of navigable pages, each tagged with the permission module
 * that governs it. This is the single source the Quick Links feature uses to
 * offer "accessible pages":
 *   - In the header bar, the picker shows pages whose module the current user
 *     can view (via canViewModule + the /me/ matrix).
 *   - In the admin "predefined links per role" screen, the admin picks from the
 *     full list for any role.
 *
 * Paths mirror the role sidebars. Role-specific landing pages (dashboards /
 * reports) are intentionally omitted — quick links are shortcuts to operational
 * pages, and the dashboard is already the user's home.
 */
export interface RegistryPage {
  label: string;
  path: string;
  moduleKey: string;
}

export const PAGE_REGISTRY: RegistryPage[] = [
  // People / masters
  { label: "All Users", path: "/users", moduleKey: "users" },
  { label: "Sales Team", path: "/sales-team", moduleKey: "sales_team" },
  { label: "Distributors", path: "/distributors", moduleKey: "distributors" },
  { label: "Customers", path: "/customers", moduleKey: "customers" },
  { label: "Suppliers", path: "/suppliers", moduleKey: "suppliers" },
  { label: "Raw Material", path: "/items", moduleKey: "items" },
  { label: "Product Master", path: "/products", moduleKey: "products" },
  { label: "Taxes", path: "/taxes", moduleKey: "taxes" },
  { label: "Permission Matrix", path: "/permissions", moduleKey: "permissions" },
  { label: "Travel Allowance", path: "/travel-allowance", moduleKey: "travel_allowance" },
  { label: "Attendance", path: "/admin/attendance", moduleKey: "attendance" },
  { label: "Company Settings", path: "/company", moduleKey: "company_settings" },
  { label: "Plan & Billing", path: "/billing", moduleKey: "company_settings" },
  { label: "Support Tickets", path: "/support", moduleKey: "company_settings" },
  { label: "Notifications", path: "/config/notifications", moduleKey: "notifications" },
  { label: "Reports & Analytics", path: "/admin/reports", moduleKey: "admin_reports" },

  // Sales / CRM
  { label: "Targets & Goals", path: "/sales-targets", moduleKey: "sales_targets" },
  { label: "Leads", path: "/leads", moduleKey: "leads" },
  { label: "Field Visits", path: "/visits", moduleKey: "visits" },
  { label: "Sales Orders", path: "/sales-orders", moduleKey: "sales_orders" },
  { label: "Stock Requests", path: "/stock-requests", moduleKey: "stock_requests" },
  { label: "Order History", path: "/order-history", moduleKey: "order_history" },
  { label: "Backordered", path: "/backordered", moduleKey: "backordered" },
  { label: "Invoices", path: "/invoices", moduleKey: "invoices" },

  // Distributor
  { label: "Distributor Invoices", path: "/distributor-invoices", moduleKey: "distributor_invoices" },
  { label: "Distributor Products", path: "/distributor-products", moduleKey: "distributor_products" },

  // Purchase
  { label: "Purchase Orders", path: "/purchase-orders", moduleKey: "purchase_orders" },
  { label: "Material Requests", path: "/material-requests", moduleKey: "material_requests" },

  // Warehouse
  { label: "Raw Materials (WH)", path: "/warehouse/raw-materials", moduleKey: "raw_materials" },
  { label: "Our Products", path: "/warehouse/our-products", moduleKey: "our_products" },
  { label: "Stock Adjustments", path: "/stock-adjustments", moduleKey: "stock_adjustments" },
  { label: "Distributor Adjustments", path: "/distributor-adjustments", moduleKey: "distributor_adjustments" },
  { label: "Stock Ledger", path: "/stock-ledger", moduleKey: "stock_ledger" },

  // Production
  { label: "BOM Master", path: "/bom", moduleKey: "bom" },
  { label: "Production Plans", path: "/production-planning", moduleKey: "production_planning" },
  { label: "Work Orders", path: "/work-orders", moduleKey: "work_orders" },
  { label: "Job Cards", path: "/job-cards", moduleKey: "job_cards" },

  // Accounts
  { label: "Credit/Debit Notes", path: "/credit-notes", moduleKey: "credit_notes" },
  { label: "General Ledger", path: "/general-ledgers", moduleKey: "general_ledger" },
  { label: "Customer Ledger", path: "/customer-ledgers", moduleKey: "customer_ledger" },
  { label: "Supplier Ledger", path: "/supplier-ledgers", moduleKey: "supplier_ledger" },
  { label: "Sales Invoices", path: "/stock-invoices", moduleKey: "stock_invoices" },
];

/** Quick lookup of a registry page by its path. */
export const PAGE_BY_PATH: Record<string, RegistryPage> = Object.fromEntries(
  PAGE_REGISTRY.map((p) => [p.path, p])
);
