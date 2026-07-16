/**
 * Pure, dependency-free permission-decision logic for the Role Permission
 * Matrix. Kept import-free so it can be unit-tested in isolation (and so the
 * HTTP service in permission-service.ts can re-export it).
 *
 * Every function is FAIL-OPEN: when in doubt it grants access, so the matrix
 * can only ever *restrict* — it can never lock a user out due to missing/loading
 * data.
 */

export interface PermissionActions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  approve: boolean;
  print: boolean;
}

export interface ModulePermission {
  enabled: boolean;
  actions: PermissionActions;
}

export interface EffectivePermissions {
  role: string;
  access_type: "full" | "custom";
  is_full: boolean;
  permissions: Record<string, ModulePermission>;
}

/** Minimal structural shape of a sidebar menu item for permission filtering. */
export interface GatedMenuItem {
  moduleKey?: string;
  path?: string;
  children?: { moduleKey?: string }[];
}

/**
 * Fail-open visibility check: a module is visible UNLESS the matrix explicitly
 * disables it. Full-access users, untagged items, and missing/loading data all
 * resolve to visible.
 */
export function canViewModule(
  perms: EffectivePermissions | null,
  moduleKey?: string
): boolean {
  if (!perms || perms.is_full || !moduleKey) return true;
  const mod = perms.permissions?.[moduleKey];
  if (!mod) return true; // module not in the matrix → fail-open
  return mod.enabled !== false;
}

/**
 * Fail-open action check: an action is allowed unless the matrix explicitly
 * turns it off for an enabled module. A disabled module denies all actions.
 */
export function canDoAction(
  perms: EffectivePermissions | null,
  moduleKey: string,
  action: keyof PermissionActions
): boolean {
  if (!perms || perms.is_full) return true;
  const mod = perms.permissions?.[moduleKey];
  if (!mod || !mod.enabled) return mod ? false : true;
  return mod.actions?.[action] !== false;
}

/**
 * Filter a sidebar menu by the matrix (fail-open). Rules:
 *   - full access / unseeded / loading (perms null) → return items unchanged
 *   - leaf item → keep unless its module is explicitly disabled
 *   - parent with children → keep only visible children; if NONE remain, drop
 *     the whole group UNLESS the parent is itself a viewable link (own `path`
 *     and viewable `moduleKey`). Prevents empty expandable group headers.
 */
export function filterMenuByPermissions<T extends GatedMenuItem>(
  items: readonly T[],
  perms: EffectivePermissions | null
): T[] {
  if (!perms || perms.is_full) return items as T[];
  return items.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter((c) => canViewModule(perms, c.moduleKey));
      if (children.length === 0) {
        return item.path && canViewModule(perms, item.moduleKey)
          ? [{ ...item, children: undefined } as T]
          : [];
      }
      return [{ ...item, children } as T];
    }
    return canViewModule(perms, item.moduleKey) ? [item] : [];
  });
}
