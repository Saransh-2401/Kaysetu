/**
 * Tests for the Permission Matrix decision logic — the functions that drive
 * what shows/hides in the UI per role. Runnable today via Node's built-in test
 * runner (the project has no vitest yet); if vitest is added later it picks
 * these up automatically.
 *
 * Run (from frontend/):
 *   npx tsc lib/permission-logic.ts lib/permission-logic.test.ts \
 *       --outDir .tmp-permtest --module commonjs --target es2020 --skipLibCheck
 *   node --test .tmp-permtest
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canViewModule,
  canDoAction,
  filterMenuByPermissions,
  EffectivePermissions,
  PermissionActions,
} from "./permission-logic";

const ALL_ON: PermissionActions = {
  view: true, create: true, edit: true, delete: true, export: true, approve: true, print: true,
};
const ALL_OFF: PermissionActions = {
  view: false, create: false, edit: false, delete: false, export: false, approve: false, print: false,
};

const FULL: EffectivePermissions = {
  role: "admin", access_type: "full", is_full: true, permissions: {},
};

function custom(permissions: EffectivePermissions["permissions"]): EffectivePermissions {
  return { role: "sales_manager", access_type: "custom", is_full: false, permissions };
}

// ── canViewModule ──
test("canViewModule fail-open: null, full, unseeded module, no moduleKey", () => {
  assert.equal(canViewModule(null, "products"), true);
  assert.equal(canViewModule(FULL, "products"), true);
  assert.equal(canViewModule(custom({}), "products"), true); // module absent → visible
  assert.equal(canViewModule(custom({ products: { enabled: true, actions: ALL_ON } }), undefined), true);
});

test("canViewModule hides ONLY an explicitly disabled module", () => {
  assert.equal(canViewModule(custom({ products: { enabled: false, actions: ALL_OFF } }), "products"), false);
  assert.equal(canViewModule(custom({ products: { enabled: true, actions: ALL_ON } }), "products"), true);
});

// ── canDoAction ──
test("canDoAction gates individual actions within an enabled module", () => {
  const p = custom({ suppliers: { enabled: true, actions: { ...ALL_ON, delete: false } } });
  assert.equal(canDoAction(p, "suppliers", "create"), true);
  assert.equal(canDoAction(p, "suppliers", "edit"), true);
  assert.equal(canDoAction(p, "suppliers", "delete"), false);
});

test("canDoAction: disabled module denies all; unknown/full/null fail open", () => {
  assert.equal(canDoAction(custom({ suppliers: { enabled: false, actions: ALL_OFF } }), "suppliers", "create"), false);
  assert.equal(canDoAction(custom({}), "suppliers", "delete"), true); // unknown module
  assert.equal(canDoAction(FULL, "suppliers", "delete"), true);
  assert.equal(canDoAction(null, "suppliers", "delete"), true);
});

// ── filterMenuByPermissions ──
test("filter: full access / loading return the menu unchanged", () => {
  const menu = [{ text: "P", path: "/products", moduleKey: "products" }];
  assert.equal(filterMenuByPermissions(menu, FULL).length, 1);
  assert.equal(filterMenuByPermissions(menu, null).length, 1);
});

test("filter: a leaf is hidden when its module is disabled", () => {
  const menu = [
    { text: "Products", path: "/products", moduleKey: "products" },
    { text: "Customers", path: "/customers", moduleKey: "customers" },
  ];
  const p = custom({ products: { enabled: false, actions: ALL_OFF } });
  assert.deepEqual(filterMenuByPermissions(menu, p).map((i) => i.moduleKey), ["customers"]);
});

test("filter: group with ALL children disabled is dropped (no empty header)", () => {
  const menu = [{
    text: "Stock Operations", // group header — no path, no moduleKey
    children: [
      { text: "Adjustment", path: "/adj", moduleKey: "stock_adjustments" },
      { text: "Ledger", path: "/led", moduleKey: "stock_ledger" },
    ],
  }];
  const allDisabled = custom({
    stock_adjustments: { enabled: false, actions: ALL_OFF },
    stock_ledger: { enabled: false, actions: ALL_OFF },
  });
  assert.equal(filterMenuByPermissions(menu, allDisabled).length, 0);
});

test("filter: group with SOME children disabled keeps the survivors", () => {
  const menu = [{
    text: "Stock Operations",
    children: [
      { text: "Adjustment", path: "/adj", moduleKey: "stock_adjustments" },
      { text: "Ledger", path: "/led", moduleKey: "stock_ledger" },
    ],
  }];
  const out = filterMenuByPermissions(menu, custom({ stock_adjustments: { enabled: false, actions: ALL_OFF } }));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].children!.map((c) => c.moduleKey), ["stock_ledger"]);
});
