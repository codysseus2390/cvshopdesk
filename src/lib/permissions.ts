/**
 * Role and permission model shared by the server functions and the UI.
 * Pure logic only, so it can be unit tested and imported anywhere.
 */

export const APP_ROLES = ["owner", "manager", "staff", "display"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Wording used in the interface. The database keeps the technical role names. */
export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Admin",
  staff: "Staff",
  display: "TV / Display",
};

/** Roles an owner or admin may assign. The owner role is never assignable. */
export const ASSIGNABLE_ROLES = ["manager", "staff", "display"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const PERMISSIONS = [
  { key: "view_dashboard", label: "View dashboard" },
  { key: "edit_dashboard_numbers", label: "Edit dashboard numbers" },
  { key: "upload_imports", label: "Upload / import reports" },
  { key: "approve_imports", label: "Approve imported data" },
  { key: "edit_records", label: "Edit and correct records" },
  { key: "view_productivity", label: "View staff productivity" },
  { key: "manage_staff", label: "Manage staff" },
  { key: "manage_notifications", label: "Manage notifications" },
  { key: "access_tools", label: "Access Tools" },
  { key: "use_assistant", label: "Use the AI assistant" },
  { key: "change_settings", label: "Change app settings" },
  { key: "manage_permissions", label: "Change permissions", ownerOnly: true },
  { key: "manage_security", label: "Security and ownership controls", ownerOnly: true },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const OWNER_ONLY_PERMISSIONS: PermissionKey[] = PERMISSIONS.filter(
  (p) => "ownerOnly" in p && p.ownerOnly,
).map((p) => p.key);

function all(value: boolean): Record<PermissionKey, boolean> {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.key, value])) as Record<
    PermissionKey,
    boolean
  >;
}

/** Starting point before any owner override. */
export const DEFAULT_PERMISSIONS: Record<AppRole, Record<PermissionKey, boolean>> = {
  owner: all(true),
  manager: {
    ...all(true),
    manage_permissions: false,
    manage_security: false,
  },
  staff: {
    ...all(false),
    view_dashboard: true,
    edit_dashboard_numbers: true,
    upload_imports: true,
    access_tools: true,
    use_assistant: true,
  },
  display: {
    ...all(false),
    view_dashboard: true,
  },
};

export interface PermissionOverride {
  role: string;
  permission: string;
  allowed: boolean;
}

/**
 * Effective permissions for a role. The owner always keeps everything, and
 * ownership/security actions can never be granted to another role.
 */
export function resolvePermissions(
  role: AppRole,
  overrides: PermissionOverride[] = [],
): Record<PermissionKey, boolean> {
  if (role === "owner") return all(true);
  const result = { ...DEFAULT_PERMISSIONS[role] };
  for (const override of overrides) {
    if (override.role !== role) continue;
    if (!(override.permission in result)) continue;
    result[override.permission as PermissionKey] = override.allowed;
  }
  for (const key of OWNER_ONLY_PERMISSIONS) result[key] = false;
  return result;
}

export function can(
  role: string | null | undefined,
  permission: PermissionKey,
  overrides: PermissionOverride[] = [],
): boolean {
  if (!role || !(APP_ROLES as readonly string[]).includes(role)) return false;
  return resolvePermissions(role as AppRole, overrides)[permission];
}

export function roleLabel(role: string | null | undefined): string {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as AppRole] : "Unknown";
}
