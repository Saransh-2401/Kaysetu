/**
 * Role Permission Service
 *
 * Two concerns:
 *  1. The CURRENT user's effective permissions (`getMine`) — used to gate menus
 *     and (later) page actions. Open to any authenticated user.
 *  2. Admin matrix management (`listAll` / `saveBulk`) — admin-only.
 *
 * Fail-open by design: if the matrix is unseeded, the API returns is_full=true,
 * and `canViewModule` treats missing modules as visible, so behaviour is
 * unchanged until an admin explicitly customises a role.
 */

import { apiClient } from "./api-client";

// Pure decision logic + shared types live in permission-logic.ts (dependency-
// free, unit-tested). Re-exported here so existing imports keep working.
export type {
  PermissionActions,
  ModulePermission,
  EffectivePermissions,
  GatedMenuItem,
} from "./permission-logic";
export {
  canViewModule,
  canDoAction,
  filterMenuByPermissions,
} from "./permission-logic";

import type { EffectivePermissions, ModulePermission } from "./permission-logic";

export interface RolePermissionRow {
  id: number;
  role: string;
  access_type: "full" | "custom";
  permissions: Record<string, ModulePermission>;
  updated_by_name?: string;
  updated_at?: string;
}

/** A role in the registry (system or custom) — drives the matrix tabs + pickers. */
export interface RoleRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  is_full_access: boolean;
  is_active: boolean;
  access_type: "full" | "custom";
  user_count: number;
  created_at?: string;
  updated_at?: string;
}

type RolePermPayload = { accessType: string; modules: Record<string, ModulePermission> };

export const permissionService = {
  _mine: null as EffectivePermissions | null,
  _inflight: null as Promise<EffectivePermissions> | null,

  /** Effective permissions for the logged-in user (cached for the session).
   * Concurrent callers (e.g. many components mounting at once) share a single
   * in-flight request rather than each firing their own. */
  async getMine(): Promise<EffectivePermissions> {
    if (this._mine) return this._mine;
    if (this._inflight) return this._inflight;
    this._inflight = apiClient
      .get<EffectivePermissions>("/core/role-permissions/me/")
      .then((data) => {
        this._mine = data;
        this._inflight = null;
        return data;
      })
      .catch((err) => {
        this._inflight = null;
        throw err;
      });
    return this._inflight;
  },

  clearCache() {
    this._mine = null;
    this._inflight = null;
  },

  /** Admin: the full matrix (one row per role). */
  async listAll(): Promise<RolePermissionRow[]> {
    return apiClient.get<RolePermissionRow[]>("/core/role-permissions/");
  },

  /**
   * Admin: save the matrix for one or more roles at once.
   * Payload shape: { "<role>": { accessType, modules }, ... }
   */
  async saveBulk(
    payload: Record<string, { accessType: string; modules: Record<string, ModulePermission> }>
  ): Promise<{ status: string; saved_roles: string[] }> {
    return apiClient.post("/core/role-permissions/bulk/", payload);
  },
};

/**
 * Admin: manage the role registry (authentication.Role).
 * Create/edit/delete custom roles; system roles are read-only on name/delete
 * (the backend enforces this — the UI just reflects it).
 */
export const roleService = {
  /** All roles, system + custom (unpaginated). */
  async list(): Promise<RoleRow[]> {
    return apiClient.get<RoleRow[]>("/core/roles/");
  },

  /** Create a custom role + its permission matrix in one step. */
  async create(payload: {
    name: string;
    description?: string;
    permissions?: RolePermPayload;
  }): Promise<RoleRow> {
    return apiClient.post<RoleRow>("/core/roles/", payload);
  },

  /** Update name/description/active and/or the permission matrix of a role. */
  async update(
    slug: string,
    payload: { name?: string; description?: string; is_active?: boolean; permissions?: RolePermPayload }
  ): Promise<RoleRow> {
    return apiClient.patch<RoleRow>(`/core/roles/${slug}/`, payload);
  },

  /**
   * Delete a custom role. If users are still assigned, the backend replies 409
   * (APIError.status === 409, details.requires_reassign) — pass `reassignTo`
   * with a replacement role slug to move those users first, then delete.
   */
  async remove(slug: string, reassignTo?: string): Promise<void> {
    await apiClient.delete(`/core/roles/${slug}/`, reassignTo ? { reassign_to: reassignTo } : undefined);
  },
};

/** One quick link (predefined-by-role or personal). */
export interface QuickLink {
  id: number;
  label: string;
  path: string;
  module_key?: string;
  order?: number;
  role?: string; // present on predefined (role) links
}

export interface MyQuickLinks {
  predefined: QuickLink[]; // from the user's role — not deletable by the user
  personal: QuickLink[]; // the user's own — deletable
}

/**
 * Quick Links shown in the header bar.
 *  - `getMine` = the current user's role predefined + personal links.
 *  - personal add/remove is self-service; predefined are admin-managed per role.
 */
export const quickLinkService = {
  async getMine(): Promise<MyQuickLinks> {
    return apiClient.get<MyQuickLinks>("/core/quick-links/me/");
  },
  async addPersonal(link: { label: string; path: string; module_key?: string }): Promise<QuickLink> {
    return apiClient.post<QuickLink>("/core/quick-links/", link);
  },
  async removePersonal(id: number): Promise<void> {
    await apiClient.delete(`/core/quick-links/${id}/`);
  },

  // ── Admin: predefined links per role ──
  async listRole(roleSlug: string): Promise<QuickLink[]> {
    return apiClient.get<QuickLink[]>("/core/role-quick-links/", { role: roleSlug });
  },
  async addRole(link: { role: string; label: string; path: string; module_key?: string }): Promise<QuickLink> {
    return apiClient.post<QuickLink>("/core/role-quick-links/", link);
  },
  async removeRole(id: number): Promise<void> {
    await apiClient.delete(`/core/role-quick-links/${id}/`);
  },
};
