import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminConfig } from "@/lib/admin.functions";
import { resolvePermissions, type AppRole, type PermissionKey } from "@/lib/permissions";

/** Role, overrides and the effective permissions for the signed-in employee. */
export function usePermissions() {
  const fetchConfig = useServerFn(getAdminConfig);
  const query = useQuery({ queryKey: ["admin-config"], queryFn: () => fetchConfig(), staleTime: 30_000 });

  const role = (query.data?.role ?? null) as AppRole | null;
  const overrides = query.data?.overrides ?? [];
  const permissions = role ? resolvePermissions(role, overrides) : null;

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
