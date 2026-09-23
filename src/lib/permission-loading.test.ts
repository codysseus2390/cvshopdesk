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
vi.mock("./numbers.server", () => ({
  resolveShop: async () => ({ shopId: "shop-a", role: "manager" }),
}));

import { getAdminConfig } from "./admin.functions";
import { getMechanicProductivityEntry } from "./numbers.functions";

function database(failedTable: string) {
  const from = vi.fn((table: string) => {
    const result = {
      data:
        table === "shop_members"
          ? { shop_id: "shop-a", role: "manager", status: "approved" }
          : null,
      error: table === failedTable ? { message: "network failure" } : null,
    };
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => result,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
  return { from };
}

type Handler = (input: {
  context: { supabase: ReturnType<typeof database>; userId: string };
  data?: { previous_day: string; period_anchor: string };
}) => Promise<unknown>;

describe("permission lookup failures", () => {
  it("does not return default permissions when the permission table is unavailable", async () => {
    const supabase = database("role_permissions");
    await expect(
      (getAdminConfig as unknown as Handler)({ context: { supabase, userId: "manager" } }),
    ).rejects.toThrow("Unable to verify your permissions");
  });

  it("does not fetch protected numbers after a failed permission lookup", async () => {
    const supabase = database("role_permissions");
    await expect(
      (getMechanicProductivityEntry as unknown as Handler)({
        context: { supabase, userId: "manager" },
        data: { previous_day: "2026-09-18", period_anchor: "2026-09-21" },
      }),
    ).rejects.toThrow("Unable to verify your permissions");
    expect(supabase.from).not.toHaveBeenCalledWith("technician_productivity");
  });

  it("does not disguise failed settings reads as empty settings", async () => {
    await expect(
      (getAdminConfig as unknown as Handler)({
        context: { supabase: database("shop_settings"), userId: "manager" },
      }),
    ).rejects.toThrow("Unable to load shop settings");
  });
});
