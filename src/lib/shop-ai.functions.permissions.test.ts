/**
 * Phase 1 permission regression tests (P12-04) for shop-ai.functions.ts.
 * Covers listAiActions' use_assistant grant/revoke, matching the SQL-level
 * effective_ai_actions_read policy added in migration 0023. This file only
 * tests listAiActions; Iron is actively changing shop-ai.functions.ts's other
 * exports and ShopAiToolContext construction (P12-13) in a different worktree,
 * so nothing here depends on that in-flight work.
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

import { listAiActions } from "./shop-ai.functions";

type Handler = (input: { context: { supabase: unknown; userId: string } }) => Promise<unknown>;

function supabaseFor(
  role: string,
  overrides: { role: string; permission: string; allowed: boolean }[],
) {
  return {
    from: (table: string) => {
      if (table === "shop_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { shop_id: "shop-a", role, shops: { timezone: "America/Chicago" } },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "role_permissions") {
        return { select: () => ({ eq: async () => ({ data: overrides, error: null }) }) };
      }
      if (table === "ai_actions") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: [{ id: "action-1" }], error: null }) }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("listAiActions honors use_assistant grant/revoke", () => {
  it("returns actions for staff, whose default keeps use_assistant", async () => {
    const supabase = supabaseFor("staff", []);
    const result = await (listAiActions as unknown as Handler)({
      context: { supabase, userId: "staff" },
    });
    expect(result).toEqual([{ id: "action-1" }]);
  });

  it("denies staff with use_assistant explicitly revoked", async () => {
    const supabase = supabaseFor("staff", [
      { role: "staff", permission: "use_assistant", allowed: false },
    ]);
    await expect(
      (listAiActions as unknown as Handler)({ context: { supabase, userId: "staff" } }),
    ).rejects.toThrow("The AI assistant is not enabled for your role.");
  });

  it("denies display, whose default has no use_assistant", async () => {
    const supabase = supabaseFor("display", []);
    await expect(
      (listAiActions as unknown as Handler)({ context: { supabase, userId: "display" } }),
    ).rejects.toThrow("The AI assistant is not enabled for your role.");
  });
});
