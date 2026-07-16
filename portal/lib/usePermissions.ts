"use client";
import { useEffect, useState } from "react";
import {
  permissionService,
  canDoAction,
  canViewModule,
  EffectivePermissions,
  PermissionActions,
} from "./permission-service";

/**
 * React hook exposing the current user's effective permissions plus fail-open
 * helpers. While loading (perms === null) both `can` and `canView` return true,
 * so UI never hides controls prematurely (matches the fail-open backend).
 *
 *   const { can, canView, loading } = usePermissions();
 *   <Button disabled={!can("suppliers", "create")}>Add</Button>
 */
export function usePermissions() {
  // Initialise straight from the session cache so a warm cache needs no effect
  // setState (and no loading flash).
  const [perms, setPerms] = useState<EffectivePermissions | null>(
    permissionService._mine
  );
  const [loading, setLoading] = useState(!permissionService._mine);

  useEffect(() => {
    if (permissionService._mine) return; // already cached — state is correct
    let active = true;
    permissionService
      .getMine()
      .then((p) => active && setPerms(p))
      .catch(() => active && setPerms(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return {
    perms,
    loading,
    isFull: !!perms?.is_full,
    /** Can the role perform `action` within `module` (fail-open). */
    can: (module: string, action: keyof PermissionActions) =>
      canDoAction(perms, module, action),
    /** Is `module` visible to the role (fail-open). */
    canView: (module: string) => canViewModule(perms, module),
  };
}
