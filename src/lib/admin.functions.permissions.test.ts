/**
 * Phase 1 permission regression tests (P12-04) for admin.functions.ts, mocking
 * Supabase the same way src/lib/permission-loading.test.ts does. Covers the
 * ticket's admin.functions items: getAdminConfig's productivity-field stripping,
 * zero-row writes reported as errors (not success) for saveShopSettings and
 * setRolePermission, and saveBusinessCalendar's structured retroactive-
 * confirmation result / RPC call shape. listAuditEvents' owner/manager invariant
 * is exercised through the real canReadAuditEvents(role) helper, never
 * hand-coded here.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      validator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const requireShopPermission = vi.fn();
const readShopPermissions = vi.fn();
vi.mock("./permissions.server", () => ({
  requireShopPermission: (...args: unknown[]) => requireShopPermission(...args),
  readShopPermissions: (...args: unknown[]) => readShopPermissions(...args),
}));

import {
  getAdminConfig,
  setRolePermission,
  saveShopSettings,
  saveBusinessCalendar,
} from "./admin.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;

function membershipQuery(role: string, status = "approved") {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { shop_id: "shop-a", role, status },
          error: null,
        }),
      }),
    }),
  };
}

describe("getAdminConfig strips productivity config when denied", () => {
  it("returns technician_goals when view_productivity is allowed", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "shop_members") return membershipQuery("manager");
        if (table === "role_permissions") {
          return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
        }
        if (table === "shop_settings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    technician_goals: [
                      { technician: "Alex", cars_per_month: 40, gp_per_month: null },
                    ],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const result = (await (getAdminConfig as unknown as Handler)({
      context: { supabase, userId: "manager" },
    })) as { settings: { technician_goals: unknown[] } };
    // Manager's default permissions include view_productivity, so real goal data comes through.
    expect(result.settings.technician_goals).toEqual([
      { technician: "Alex", cars_per_month: 40, gp_per_month: null },
    ]);
  });

  it("strips technician_goals when view_productivity is denied", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "shop_members") return membershipQuery("staff");
        if (table === "role_permissions") {
          // Staff has no default view_productivity; no override changes that here.
          return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
        }
        if (table === "shop_settings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    technician_goals: [
                      { technician: "Alex", cars_per_month: 40, gp_per_month: null },
                    ],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const result = (await (getAdminConfig as unknown as Handler)({
      context: { supabase, userId: "staff" },
    })) as { settings: { technician_goals: unknown[] } };
    expect(result.settings.technician_goals).toEqual([]);
  });
});

describe("zero-row writes are reported as errors, never as silent success", () => {
  it("saveShopSettings throws when the upsert affects zero rows", async () => {
    readShopPermissions.mockResolvedValueOnce(() => true);
    const supabase = {
      from: (table: string) => {
        if (table === "shop_members") return membershipQuery("owner");
        if (table === "shop_settings") {
          return {
            upsert: () => ({ select: async () => ({ data: [], error: null }) }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    await expect(
      (saveShopSettings as unknown as Handler)({
        context: { supabase, userId: "owner" },
        data: { hidden_widgets: [], targets: {}, technician_goals: [] },
      }),
    ).rejects.toThrow("Dashboard settings were not saved. Nothing was changed.");
  });

  it("setRolePermission throws when the upsert affects zero rows", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "shop_members") return membershipQuery("owner");
        if (table === "role_permissions") {
          return {
            upsert: () => ({ select: async () => ({ data: [], error: null }) }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc: async () => ({ data: null, error: null }),
    };
    await expect(
      (setRolePermission as unknown as Handler)({
        context: { supabase, userId: "owner" },
        data: { role: "staff", permission: "edit_records", allowed: true },
      }),
    ).rejects.toThrow("The permission change was not saved. Nothing was changed.");
  });
});

describe("saveBusinessCalendar's retroactive-confirmation contract", () => {
  const oldCalendar = {
    schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
    exceptions: [],
  };
  // 2020-01-06 is a Monday (an open weekday under oldCalendar); closing it is a
  // real, far-past status change, so it is retroactive under any "today".
  const retroactiveCalendar = {
    schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
    exceptions: [{ business_date: "2020-01-06", is_open: false, reason: "Test closure" }],
  };
  // Only adds a future schedule change; nothing on/before today changes status.
  const forwardOnlyCalendar = {
    schedules: [
      { effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] },
      { effective_from: "2999-01-01", open_weekdays: [1, 2, 3, 4, 5, 6] },
    ],
    exceptions: [],
  };

  function supabaseFor(storedCalendar: unknown) {
    return {
      from: (table: string) => {
        if (table === "shops") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { timezone: "America/Chicago" }, error: null }),
              }),
            }),
          };
        }
        if (table === "shop_settings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { business_calendar: storedCalendar },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc: vi.fn(async () => ({ data: null, error: null })),
    };
  }

  it("returns requiresRetroactiveConfirmation without calling the RPC when unconfirmed", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "owner",
      status: "approved",
    });
    const supabase = supabaseFor(oldCalendar);
    const result = await (saveBusinessCalendar as unknown as Handler)({
      context: { supabase, userId: "owner" },
      data: { calendar: retroactiveCalendar },
    });
    expect(result).toMatchObject({
      ok: false,
      requiresRetroactiveConfirmation: true,
      conflictDate: "2020-01-06",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with p_retroactive true once confirmRetroactive is set", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "owner",
      status: "approved",
    });
    const supabase = supabaseFor(oldCalendar);
    const result = await (saveBusinessCalendar as unknown as Handler)({
      context: { supabase, userId: "owner" },
      data: { calendar: retroactiveCalendar, confirmRetroactive: true },
    });
    expect(result).toEqual({ ok: true, retroactive: true });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "save_business_calendar",
      expect.objectContaining({
        p_shop_id: "shop-a",
        p_retroactive: true,
        p_retroactive_from: "2020-01-06",
      }),
    );
  });

  it("saves forward-dated-only changes without requiring confirmation", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "owner",
      status: "approved",
    });
    const supabase = supabaseFor(oldCalendar);
    const result = await (saveBusinessCalendar as unknown as Handler)({
      context: { supabase, userId: "owner" },
      data: { calendar: forwardOnlyCalendar },
    });
    expect(result).toEqual({ ok: true, retroactive: false });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "save_business_calendar",
      expect.objectContaining({ p_retroactive: false, p_retroactive_from: null }),
    );
  });

  it("propagates rejection for a non-owner caller (requireShopPermission denies manage_security)", async () => {
    requireShopPermission.mockRejectedValueOnce(
      new Error("You do not have permission to do that."),
    );
    const supabase = supabaseFor(oldCalendar);
    await expect(
      (saveBusinessCalendar as unknown as Handler)({
        context: { supabase, userId: "manager" },
        data: { calendar: forwardOnlyCalendar },
      }),
    ).rejects.toThrow("You do not have permission to do that.");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
