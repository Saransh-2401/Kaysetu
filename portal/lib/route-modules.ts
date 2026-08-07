/**
 * Route → sellable-module map for portal entitlement gating.
 *
 * A tenant buys a PACKAGE which grants a set of MODULES (TRACK, FIELD, …).
 * The backend already enforces this on module APIs via HasModule("CODE") at
 * /api/t/<module>/. This map is the FRONTEND half: it stops non-entitled pages
 * from rendering at all (previously they rendered fully on direct URL and just
 * filled with 403 errors, which looked broken and exposed unsold modules).
 *
 * DESIGN RULES
 *  - FAIL OPEN. Any route not listed here is allowed. Locking a customer out of
 *    something they paid for is far worse than leaving one page reachable.
 *  - Longest-prefix wins, so a child route can override its parent.
 *  - Foundation/shared pages (dashboard, users, company, billing, support,
 *    profile, config, notifications) are intentionally ABSENT = always allowed.
 *    They are backed by foundation APIs (/api/t/users/, /api/t/parties/,
 *    /api/core/companies/, /api/warehouse/* catalog-compat, /api/masters/*)
 *    which are shared by every package and never module-gated.
 */

export type ModuleCode =
  | "TRACK" | "FIELD" | "ORDERS" | "DIST" | "INV"
  | "PROD" | "PURCH" | "BOOKS" | "CRM" | "ATT" | "TA";

export const MODULE_META: Record<ModuleCode, { name: string; description: string }> = {
  TRACK: { name: "Agent Live Tracking", description: "GPS attendance, live map, route replay, tracking health" },
  FIELD: { name: "Field Sales Operations", description: "Beat plans, visits, field orders, collections, expenses, targets" },
  ORDERS: { name: "Sales Orders & Dispatch", description: "Order approval chain, pick lists, delivery notes, invoicing" },
  DIST: { name: "Distribution Network", description: "Distributors, allocation, stock requests, distributor invoices" },
  INV: { name: "Inventory & Warehouse", description: "Warehouses, stock ledger, adjustments, transfers" },
  PROD: { name: "Production", description: "BOM, work orders, job cards, production planning" },
  PURCH: { name: "Procurement", description: "Suppliers, material requests, purchase orders, GRN" },
  BOOKS: { name: "Accounts & Finance", description: "Ledgers, invoices, bills, payments, GST hub, banking" },
  CRM: { name: "Leads & Pipeline", description: "Leads, opportunities, funnel, follow-ups" },
  ATT: { name: "Attendance & Leave", description: "Office attendance, leave management, holidays" },
  TA: { name: "Travel Allowance", description: "TA claims with GPS-auto distance and approval chain" },
};

/**
 * Gated routes only. Anything absent is always allowed (fail-open).
 * Populated from an adversarially-verified audit of each page's real API calls.
 */
export const ROUTE_MODULE: Record<string, ModuleCode> = {
  // — placeholder, replaced by the verified audit —
};

/** Routes that must NEVER be gated even if a prefix above would match them. */
const ALWAYS_ALLOWED = [
  "/", "/login", "/admin", "/company", "/users", "/billing", "/support",
  "/permissions", "/profile-settings", "/notifications", "/config",
];

/**
 * Longest-prefix lookup. Returns the module required for `pathname`,
 * or null when the route is foundation/unlisted (always allowed).
 */
export function moduleForPath(pathname: string): ModuleCode | null {
  if (!pathname) return null;
  const path = pathname.replace(/\/+$/, "") || "/";

  // Exact always-allowed match (prefix children of /config are covered below).
  if (ALWAYS_ALLOWED.includes(path)) return null;
  if (ALWAYS_ALLOWED.some((a) => a !== "/" && path.startsWith(a + "/"))) {
    // A child of an always-allowed section is allowed unless it is explicitly
    // gated by a longer, more specific entry (e.g. /admin/tracking-health).
    const explicit = Object.keys(ROUTE_MODULE)
      .filter((r) => path === r || path.startsWith(r + "/"))
      .sort((a, b) => b.length - a.length)[0];
    return explicit ? ROUTE_MODULE[explicit] : null;
  }

  const match = Object.keys(ROUTE_MODULE)
    .filter((r) => path === r || path.startsWith(r + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return match ? ROUTE_MODULE[match] : null;
}
