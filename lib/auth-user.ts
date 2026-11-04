/*
 * The signed-in user as the app sees them. Client-safe: the shell and navbar
 * import the type, the server-only session module builds the value. Never
 * carries a token or a password.
 */

import type { TablePageSize } from "@/components/table-pagination";
import type { Theme } from "@/components/theme-provider";
import type { PermissionAction, RolePermissions } from "@/lib/roles";

/** One table's settings, saved under `table.<its saveAs name>`. */
export type TablePreference = {
  pageSize?: TablePageSize;
  /** The sorted column, or null for the original order. */
  sort?: { id: string; desc: boolean } | null;
};

/**
 * The user's own screen settings, saved on their account so they follow them
 * to any browser. A key that was never set means "the default".
 */
export type Preferences = {
  theme?: Theme;
  sidebarCollapsed?: boolean;
  [table: `table.${string}`]: TablePreference | undefined;
};

/** A user as the API serialises them (UserSerializer). */
export type ApiUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  roles: { id: string; name: string }[];
  designation: { id: string; name: string } | null;
  is_active: boolean;
  is_superuser: boolean;
  /** Set when this account signs in as an agent. Null for staff. */
  agent_id: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Sidebar link code -> action flags, for links the roles grant anything on;
   * {} for a superuser, who has every link. Only GET /auth/me/ sends it
   * (MeSerializer); user lists leave it out.
   */
  permissions?: RolePermissions;
  /** Only GET /auth/me/ sends it; nobody else sees a user's settings. */
  preferences?: Preferences;
};

export type SessionUser = {
  id: string;
  /** Display name; falls back to the email when the profile has no name. */
  name: string;
  email: string;
  /** The roles' names; empty when none is assigned. */
  roles: string[];
  designation: string | null;
  isSuperuser: boolean;
  /** The agent this account signs in as. Null for staff. */
  agentId: string | null;
  /** What the roles grant, per sidebar link code. Read it through can(): a superuser's is empty. */
  permissions: RolePermissions;
  preferences: Preferences;
};

export function toSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    name: user.full_name?.trim() || user.email,
    email: user.email,
    roles: user.roles.map((role) => role.name),
    designation: user.designation?.name ?? null,
    isSuperuser: user.is_superuser,
    agentId: user.agent_id,
    permissions: user.permissions ?? {},
    preferences: user.preferences ?? {},
  };
}

/** Whether the roles let this user see `module`, a sidebar link's code (nav.ts). */
export function canView(user: SessionUser, module: string): boolean {
  return can(user, module, "view");
}

/** Whether the roles let this user create in `module`. */
export function canCreate(user: SessionUser, module: string): boolean {
  return can(user, module, "create");
}

/**
 * Whether the roles let this user do `action` on `module`. A superuser may do
 * anything. A bare section ("sold") is allowed when any of its links is
 * ("sold.form", "sold.list"), as the API's User.has_permission answers it.
 */
export function can(user: SessionUser, module: string, action: PermissionAction): boolean {
  if (user.isSuperuser) return true;
  return Object.entries(user.permissions).some(
    ([code, flags]) => (code === module || code.startsWith(`${module}.`)) && flags[action],
  );
}
