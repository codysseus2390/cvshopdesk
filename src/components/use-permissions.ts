import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminConfig } from "@/lib/admin.functions";
import { PERMISSIONS, resolvePermissions, type AppRole, type PermissionKey } from "@/lib/permissions";
import { SHOWCASE_PERMISSIONS, useShowcaseMode } from "@/lib/showcase";

/** Role, overrides and the effective permissions for the signed-in employee. */
export function usePermissions() {
  const fetchConfig = useServerFn(getAdminConfig);
  const showcase = useShowcaseMode();
  const query = useQuery({ queryKey: ["admin-config"], queryFn: () => fetchConfig(), staleTime: 30_000 });

  const role = (query.data?.role ?? null) as AppRole | null;
  const overrides = query.data?.overrides ?? [];
  let permissions = role ? resolvePermissions(role, overrides) : null;

  // Showcase Mode: look-only access to the interface. Every change is still
  // refused by the database, this only keeps the screens reachable.
  if (showcase) {
    permissions = Object.fromEntries(
      PERMISSIONS.map((p) => [p.key, SHOWCASE_PERMISSIONS.includes(p.key)]),
    ) as Record<PermissionKey, boolean>;
  }

  return {
    ...query,
    role,
    overrides,
    settings: query.data?.settings ?? null,
    permissions,
    can: (permission: PermissionKey) => Boolean(permissions?.[permission]),
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "manager",
  };
}
