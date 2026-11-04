import "server-only";

/*
 * Data boundary for roles: what a signed-in user may do per sidebar link,
 * read from the Django API (`/api/v1/roles/`, backend/apps/accounts) as the
 * signed-in user. Adds, edits and deletes go through the server actions in
 * app/(dashboard)/roles/actions.ts; the API lets only a superuser make them,
 * and the Roles page is shown only to a superuser.
 *
 * A role holds one permission row per sidebar link (its code, from
 * app/(dashboard)/nav.ts permissionLinks), each with view / create / update /
 * delete flags. Create, update or delete also needs view; a link with no
 * flags is no access. `all` (View all) lets the flags reach everyone's records
 * on the link; without it they reach only the user's own (under their agent
 * profile, or made by them). Agents and staff follow the same rules; a
 * superuser has everything. Users are given roles on the Users page
 * (lib/users.ts).
 */

import { apiGet } from "@/lib/api-server";

export type RoleStatus = "active" | "inactive";

export type PermissionAction = "view" | "create" | "update" | "delete";

/** One link's flags; `all` is View all: everyone's records, not just the user's own. */
export type PermissionFlags = Record<PermissionAction, boolean> & { all: boolean };

/** Link code -> flags. A link missing here has no access. */
export type RolePermissions = Record<string, PermissionFlags>;

/**
 * A sidebar link a role can be granted, a row on the Roles page. `ownable`
 * links hold records that belong to someone, so the row offers View all.
 */
export type ModuleOption = { code: string; label: string; ownable: boolean };

export type RoleRecord = {
  /** The API's UUID. */
  id: string;
  name: string;
  description: string;
  /** The API's is_active. An inactive role grants its users nothing. */
  status: RoleStatus;
  permissions: RolePermissions;
  /** Live users assigned this role. A role with any cannot be deleted. */
  userCount: number;
  /** Admin, Operations, Agent, SDR or Sold Emails: cannot be deleted, renamed or made inactive. */
  builtIn: boolean;
};

/** What the add / edit form submits. */
export type RoleValues = {
  name: string;
  description: string;
  status: RoleStatus;
  permissions: RolePermissions;
};

/** A save error, shown under the field it names, or under the form for `form`. */
export type RoleError = { field: keyof RoleValues | "form"; message: string };

/** A permission as the API serialises it (RolePermissionSerializer). */
export type ApiRolePermission = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  view_all: boolean;
};

/** A role as the API serialises it (RoleSerializer). */
export type ApiRole = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  permissions: ApiRolePermission[];
  user_count: number;
  created_at: string;
  updated_at: string;
};

/** An API role as the Roles page holds them. Modules with no flags are left out. */
export function toRoleRecord(role: ApiRole): RoleRecord {
  const permissions: RolePermissions = {};
  for (const permission of role.permissions) {
    const flags: PermissionFlags = {
      view: permission.can_view,
      create: permission.can_create,
      update: permission.can_update,
      delete: permission.can_delete,
      all: permission.view_all,
    };
    if (flags.view || flags.create || flags.update || flags.delete) permissions[permission.module] = flags;
  }
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    status: role.is_active ? "active" : "inactive",
    permissions,
    userCount: role.user_count,
    builtIn: role.is_system,
  };
}

/** Every live role, active and inactive, by name. */
export async function getRoles(): Promise<RoleRecord[]> {
  const roles = await apiGet<ApiRole[]>("/roles/");
  return roles.map(toRoleRecord);
}

