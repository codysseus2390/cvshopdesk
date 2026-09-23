/**
 * Phase 1 permission regression tests (P12-04) for numbers.functions.ts,
 * mocking Supabase the same way src/lib/permission-loading.test.ts does.
 * Covers: saveNumbersGoals with change_settings granted to staff succeeds, and
 * with change_settings revoked from a manager fails.
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

const resolveShopMock = vi.fn();
vi.mock("./numbers.server", () => ({
  resolveShop: (...args: unknown[]) => resolveShopMock(...args),
}));

import { saveNumbersGoals } from "./numbers.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;

function supabaseWithOverride(overrides: { role: string; permission: string; allowed: boolean }[]) {
  return {
    from: (table: string) => {
      if (table === "role_permissions") {
        return { select: () => ({ eq: async () => ({ data: overrides, error: null }) }) };
      }
      if (table === "shop_settings") {
        return {
          upsert: () => ({ select: async () => ({ data: [{ shop_id: "shop-a" }], error: null }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  };
}

describe("saveNumbersGoals honors change_settings grant/revoke", () => {
  it("succeeds for staff explicitly granted change_settings", async () => {
    resolveShopMock.mockResolvedValueOnce({
      shopId: "shop-a",
      role: "staff",
      name: "Cedar Valley",
      timezone: "America/Chicago",
    });
    const supabase = supabaseWithOverride([
      { role: "staff", permission: "change_settings", allowed: true },
    ]);
    const result = await (saveNumbersGoals as unknown as Handler)({
      context: { supabase, userId: "staff" },
      data: { goal_rules: { sales: { method: "fixed", monthly: 50000 } } },
    });
    expect(result).toEqual({ ok: true });
  });

  it("fails for a manager with change_settings explicitly revoked", async () => {
    resolveShopMock.mockResolvedValueOnce({
      shopId: "shop-a",
      role: "manager",
      name: "Cedar Valley",
      timezone: "America/Chicago",
    });
    const supabase = supabaseWithOverride([
      { role: "manager", permission: "change_settings", allowed: false },
    ]);
    await expect(
      (saveNumbersGoals as unknown as Handler)({
        context: { supabase, userId: "manager" },
        data: { goal_rules: { sales: { method: "fixed", monthly: 50000 } } },
      }),
    ).rejects.toThrow("You do not have permission to do that.");
  });
});
