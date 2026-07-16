"use client";
import React from "react";
import { usePermissions } from "@/lib/usePermissions";
import { PermissionActions } from "@/lib/permission-service";

/**
 * Declaratively render children only when the current role is allowed the given
 * module + action. Fail-open: while permissions load (or the matrix is
 * unseeded / full access) children render. Use it to hide create/edit/delete/
 * approve controls a role can't use, keeping the UI consistent with the
 * backend matrix enforcement.
 *
 *   <Can module="suppliers" action="create">
 *     <Button onClick={addSupplier}>Add Supplier</Button>
 *   </Can>
 *
 * `action` defaults to "view" (module visibility). Pass `fallback` to show
 * something else (e.g. a disabled state) when denied.
 */
export default function Can({
  module,
  action = "view",
  children,
  fallback = null,
}: {
  module: string;
  action?: keyof PermissionActions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can, canView } = usePermissions();
  const allowed = action === "view" ? canView(module) : can(module, action);
  return <>{allowed ? children : fallback}</>;
}
