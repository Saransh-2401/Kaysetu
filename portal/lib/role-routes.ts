/**
 * SALEXA RBAC - Role-Based Route Access System
 * Hard-coded routes for each role
 * Users inherit routes based on their assigned role
 */

export interface RouteAccess {
  path: string;
  label: string;
  icon: string;
  description: string;
  subRoutes?: RouteAccess[];
}

export interface RoleConfig {
  role: string;
  description: string;
  accessLevel: number; // 0-100
  routes: RouteAccess[];
}

// ============================================
// ADMIN ROLE - 100% Access
// ============================================
export const ADMIN_ROUTES: RouteAccess[] = [
  {
    path: "/admin",
    label: "Dashboard",
    icon: "dashboard",
    description: "System overview and metrics",
  },
  {
    path: "/admin/users",
    label: "User Management",
    icon: "people",
    description: "Create, edit, delete users",
    subRoutes: [
      {
        path: "/admin/users",
        label: "All Users",
        icon: "list",
        description: "View all system users",
      },
      {
        path: "/admin/users/roles",
        label: "Role Management",
        icon: "security",
        description: "Manage user roles",
      },
      {
        path: "/admin/users/permissions",
        label: "Permissions",
        icon: "lock",
        description: "Configure permissions",
      },
    ],
  },
  {
    path: "/admin/company",
    label: "Company Settings",
    icon: "business",
    description: "Organization configuration (OTP required)",
    subRoutes: [
      {
        path: "/admin/company/profile",
        label: "Company Profile",
        icon: "info",
        description: "Edit company details",
      },
      {
        path: "/admin/company/billing",
        label: "Billing",
        icon: "payment",
        description: "Subscription and billing",
      },
      {
        path: "/admin/company/integrations",
        label: "Integrations",
        icon: "extension",
        description: "Third-party integrations",
      },
    ],
  },
  {
    path: "/distributors",
    label: "Distributors",
    icon: "local_shipping",
    description: "Manage distributors",
  },
  {
    path: "/admin/system",
    label: "System Settings",
    icon: "settings",
    description: "Core system configuration",
    subRoutes: [
      {
        path: "/admin/system/route-history",
        label: "Route History",
        icon: "map",
        description: "View all user routes",
      },
      {
        path: "/admin/system/activity-log",
        label: "Activity Log",
        icon: "history",
        description: "System activity tracking",
      },
      {
        path: "/admin/system/audit",
        label: "Audit Trail",
        icon: "assessment",
        description: "Compliance audit log",
      },
    ],
  },
  {
    path: "/admin/masters",
    label: "Masters",
    icon: "database",
    description: "Master data management",
    subRoutes: [
      {
        path: "/admin/masters/items",
        label: "Items",
        icon: "category",
        description: "Product catalog",
      },
      {
        path: "/admin/masters/customers",
        label: "Customers",
        icon: "person",
        description: "Customer master",
      },
      {
        path: "/admin/masters/suppliers",
        label: "Suppliers",
        icon: "business",
        description: "Supplier master",
      },
    ],
  },
];

// ============================================
// SALES MANAGER ROLE - 65% Access
// ============================================
export const SALES_MANAGER_ROUTES: RouteAccess[] = [
  {
    path: "/sales-manager",
    label: "Dashboard",
    icon: "dashboard",
    description: "Team sales overview",
  },
  {
    path: "/sales-manager/team",
    label: "Team Management",
    icon: "people",
    description: "Manage sales agents",
    subRoutes: [
      {
        path: "/sales-manager/team",
        label: "Team Members",
        icon: "list",
        description: "View team agents",
      },
      {
        path: "/sales-manager/team/assignments",
        label: "Client Assignments",
        icon: "assignment",
        description: "Assign clients to agents",
      },
    ],
  },
  {
    path: "/distributors",
    label: "Distributors",
    icon: "local_shipping",
    description: "Manage distributors",
  },
  {
    path: "/sales-manager/customers",
    label: "Customers",
    icon: "people",
    description: "View all team customers",
  },
  {
    path: "/product-catalog",
    label: "Product Catalogue",
    icon: "category",
    description: "Browse products by name, SKU or HSN (read-only)",
  },
  {
    path: "/sales-manager/orders",
    label: "Orders",
    icon: "shopping_cart",
    description: "Manage team orders",
  },
  {
    path: "/stock-adjustments",
    label: "Stock Adjustment",
    icon: "compare_arrows",
    description: "Adjust stock quantities",
  },
  {
    path: "/sales-manager/quotes",
    label: "Quotes",
    icon: "description",
    description: "Sales quotations",
  },
  {
    path: "/sales-manager/reports",
    label: "Reports",
    icon: "assessment",
    description: "Sales reports and analytics",
    subRoutes: [
      {
        path: "/sales-manager/reports/sales",
        label: "Sales Report",
        icon: "trending_up",
        description: "Sales metrics",
      },
      {
        path: "/sales-manager/reports/agent-activity",
        label: "Agent Activity",
        icon: "history",
        description: "Export agent logs",
      },
    ],
  },
];

// ============================================
// SALES AGENT ROLE - 35% Access
// ============================================
export const SALES_AGENT_ROUTES: RouteAccess[] = [
  {
    path: "/sales-agent",
    label: "Dashboard",
    icon: "dashboard",
    description: "Personal sales overview",
  },
  {
    path: "/sales-agent/customers",
    label: "My Customers",
    icon: "people",
    description: "Assigned customers only (READ-ONLY)",
  },
  {
    path: "/distributors",
    label: "Distributors",
    icon: "local_shipping",
    description: "Manage assigned distributors",
  },
  {
    path: "/sales-agent/leads",
    label: "Leads",
    icon: "trending_up",
    description: "Create and manage leads",
  },
  {
    path: "/sales-agent/orders",
    label: "Orders",
    icon: "shopping_cart",
    description: "Create and view orders",
  },
  {
    path: "/sales-agent/visits",
    label: "Field Visits",
    icon: "location_on",
    description: "Track field visits with GPS",
  },
  {
    path: "/sales-agent/reports",
    label: "My Reports",
    icon: "assessment",
    description: "Personal activity report",
  },
];

// ============================================
// WAREHOUSE MANAGER ROLE - 55% Access
// ============================================
export const WAREHOUSE_MANAGER_ROUTES: RouteAccess[] = [
  {
    path: "/warehouse",
    label: "Dashboard",
    icon: "dashboard",
    description: "Warehouse overview",
  },
  {
    path: "/stock-requests",
    label: "Stock Requests",
    icon: "request_quote",
    description: "Manage distributor stock requests",
  },
  {
    path: "/backordered",
    label: "Backordered",
    icon: "hourglass_empty",
    description: "View backordered items",
  },
  {
    path: "/purchase-orders",
    label: "Purchase Orders",
    icon: "shopping_cart",
    description: "Receive incoming shipments",
  },
  {
    path: "/stock-adjustments",
    label: "Adjustments",
    icon: "settings",
    description: "Stock adjustment operations",
  },
  {
    path: "/warehouse/reports",
    label: "Reports",
    icon: "assessment",
    description: "Warehouse reports",
  },
];

// ============================================
// PURCHASE MANAGER ROLE - 60% Access
// ============================================
export const PURCHASE_MANAGER_ROUTES: RouteAccess[] = [
  {
    path: "/purchase",
    label: "Dashboard",
    icon: "dashboard",
    description: "Purchase overview",
  },
  {
    path: "/purchase-orders",
    label: "Purchase Orders",
    icon: "shopping_cart",
    description: "Create and manage POs",
  },
  {
    path: "/purchase/quotations",
    label: "Quotations",
    icon: "description",
    description: "RFQ and quotes",
  },
  {
    path: "/purchase/suppliers",
    label: "Suppliers",
    icon: "business",
    description: "Supplier management",
  },
  {
    path: "/material-requests",
    label: "Material Requests",
    icon: "request_page",
    description: "Internal requests",
  },
  {
    path: "/purchase/receipts",
    label: "Receipts",
    icon: "receipt",
    description: "Goods receipt",
  },
  {
    path: "/purchase/reports",
    label: "Reports",
    icon: "assessment",
    description: "Purchase reports",
  },
];

// ============================================
// PRODUCTION MANAGER ROLE - 50% Access
// ============================================
export const PRODUCTION_MANAGER_ROUTES: RouteAccess[] = [
  {
    path: "/production",
    label: "Dashboard",
    icon: "dashboard",
    description: "Production overview",
  },
  {
    path: "/production/work-orders",
    label: "Work Orders",
    icon: "assignment",
    description: "Manage work orders",
  },
  {
    path: "/production/job-cards",
    label: "Job Cards",
    icon: "description",
    description: "Job card management",
  },
  {
    path: "/production/bom",
    label: "BOM",
    icon: "build",
    description: "Bill of Materials",
  },
  {
    path: "/material-requests",
    label: "Material Requests",
    icon: "assignment",
    description: "Internal material requisitions",
  },
  {
    path: "/production-planning",
    label: "Planning",
    icon: "calendar_today",
    description: "Production planning",
  },
  {
    path: "/production/reports",
    label: "Reports",
    icon: "assessment",
    description: "Production reports",
  },
];

// ============================================
// ACCOUNTS MANAGER ROLE - 45% Access
// ============================================
export const ACCOUNTS_MANAGER_ROUTES: RouteAccess[] = [
  {
    path: "/accounts",
    label: "Dashboard",
    icon: "dashboard",
    description: "Accounts overview",
  },
  {
    path: "/accounts/invoices",
    label: "Invoices",
    icon: "receipt",
    description: "Invoice management",
  },
  {
    path: "/accounts/credit-notes",
    label: "Credit Notes",
    icon: "description",
    description: "Credit note management",
  },
  {
    path: "/accounts/ledgers",
    label: "Ledgers",
    icon: "menu_book",
    description: "Account ledgers",
  },
  {
    path: "/purchase-orders",
    label: "Purchase Orders",
    icon: "shopping_cart",
    description: "Verify and manage POs",
  },
  {
    path: "/material-requests",
    label: "Material Requests",
    icon: "assignment",
    description: "Review material requisitions",
  },
  {
    path: "/accounts/reports",
    label: "Reports",
    icon: "assessment",
    description: "Financial reports",
  },
];

// ============================================
// DISTRIBUTOR ROLE - 25% Access
// ============================================
export const DISTRIBUTOR_ROUTES: RouteAccess[] = [
  {
    path: "/distributor",
    label: "Dashboard",
    icon: "dashboard",
    description: "Distributor overview",
  },
  {
    path: "/distributor/products",
    label: "Products",
    icon: "category",
    description: "Available products",
  },
  {
    path: "/distributor/orders",
    label: "Orders",
    icon: "shopping_cart",
    description: "Order management",
  },
  {
    path: "/distributor/invoices",
    label: "Invoices",
    icon: "receipt",
    description: "Purchase invoices",
  },
  {
    path: "/distributor/payments",
    label: "Payments",
    icon: "payment",
    description: "Payment history",
  },
];

// ============================================
// COMPLETE ROLE CONFIGURATION
// ============================================
export const ROLE_CONFIGURATIONS: Record<string, RoleConfig> = {
  Admin: {
    role: "Admin",
    description: "Full system access",
    accessLevel: 100,
    routes: ADMIN_ROUTES,
  },
  "Sales Manager": {
    role: "Sales Manager",
    description: "Manage sales team and clients",
    accessLevel: 65,
    routes: SALES_MANAGER_ROUTES,
  },
  "Sales Agent": {
    role: "Sales Agent",
    description: "Field sales operations",
    accessLevel: 35,
    routes: SALES_AGENT_ROUTES,
  },
  "Warehouse Manager": {
    role: "Warehouse Manager",
    description: "Warehouse operations",
    accessLevel: 55,
    routes: WAREHOUSE_MANAGER_ROUTES,
  },
  "Purchase Manager": {
    role: "Purchase Manager",
    description: "Purchase operations",
    accessLevel: 60,
    routes: PURCHASE_MANAGER_ROUTES,
  },
  "Production Manager": {
    role: "Production Manager",
    description: "Production operations",
    accessLevel: 50,
    routes: PRODUCTION_MANAGER_ROUTES,
  },
  "Accounts Officer": {
    role: "Accounts Officer",
    description: "Financial management",
    accessLevel: 45,
    routes: ACCOUNTS_MANAGER_ROUTES,
  },
  Distributor: {
    role: "Distributor",
    description: "Distributor operations",
    accessLevel: 25,
    routes: DISTRIBUTOR_ROUTES,
  },
};

/**
 * Get routes for a specific role
 * @param role - The user's role
 * @returns Array of accessible routes for that role
 */
export function getRoutesByRole(role: string): RouteAccess[] {
  return ROLE_CONFIGURATIONS[role]?.routes || [];
}

/**
 * Check if a role has access to a specific route
 * @param role - The user's role
 * @param routePath - The route path to check
 * @returns boolean - Whether the role has access
 */
export function hasRouteAccess(role: string, routePath: string): boolean {
  const routes = getRoutesByRole(role);
  return routes.some(
    (r) => r.path === routePath || r.subRoutes?.some((sr) => sr.path === routePath)
  );
}

/**
 * Get access level for a role (0-100)
 * @param role - The user's role
 * @returns number - Access level percentage
 */
export function getAccessLevel(role: string): number {
  return ROLE_CONFIGURATIONS[role]?.accessLevel || 0;
}

/**
 * Get all available roles
 * @returns string[] - Array of role names
 */
export function getAllRoles(): string[] {
  return Object.keys(ROLE_CONFIGURATIONS);
}
