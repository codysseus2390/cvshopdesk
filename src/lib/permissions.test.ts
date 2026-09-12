import { describe, expect, it } from "vitest";
import { can, DEFAULT_PERMISSIONS, OWNER_ONLY_PERMISSIONS, resolvePermissions } from "./permissions";

describe("permission model", () => {
  it("gives the owner everything, whatever the overrides say", () => {
    const perms = resolvePermissions("owner", [
      { role: "owner", permission: "manage_staff", allowed: false },
    ]);
    expect(Object.values(perms).every(Boolean)).toBe(true);
  });

  it("never grants ownership or security actions to another role", () => {
    for (const role of ["manager", "staff", "display"] as const) {
      const perms = resolvePermissions(role, [
        { role, permission: "manage_security", allowed: true },
        { role, permission: "manage_permissions", allowed: true },
      ]);
      for (const key of OWNER_ONLY_PERMISSIONS) expect(perms[key]).toBe(false);
    }
  });

  it("applies owner overrides for normal permissions", () => {
    expect(DEFAULT_PERMISSIONS.staff.approve_imports).toBe(false);
    expect(
      resolvePermissions("staff", [{ role: "staff", permission: "approve_imports", allowed: true }])
        .approve_imports,
    ).toBe(true);
    expect(
      resolvePermissions("staff", [{ role: "manager", permission: "approve_imports", allowed: true }])
        .approve_imports,
    ).toBe(false);
  });

  it("keeps the display role to viewing only", () => {
    const perms = resolvePermissions("display");
    expect(perms.view_dashboard).toBe(true);
    expect(perms.manage_staff).toBe(false);
    expect(perms.upload_imports).toBe(false);
  });

  it("treats unknown or missing roles as having no access", () => {
    expect(can(null, "view_dashboard")).toBe(false);
    expect(can("pirate", "view_dashboard")).toBe(false);
  });

  it("ignores overrides for unknown permission keys", () => {
    const perms = resolvePermissions("staff", [
      { role: "staff", permission: "delete_everything", allowed: true },
    ]);
    expect("delete_everything" in perms).toBe(false);
  });
});
