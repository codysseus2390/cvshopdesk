/**
 * Phase 1 permission regression tests (P12-04) for metrics.functions.ts.
 * Covers listMetricHistory's view_dashboard grant/revoke, matching the SQL-level
 * effective_dashboard_read policy on metric_snapshots/metric_corrections added
 * in migration 0023.
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

import { listMetricHistory } from "./metrics.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;

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
                  data: {
                    shop_id: "shop-a",
                    role,
                    shops: { id: "shop-a", name: "Cedar Valley", timezone: "America/Chicago" },
                  },
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
      if (table === "metric_snapshots") {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({ order: async () => ({ data: [{ id: "snap-1" }], error: null }) }),
              }),
            }),
          }),
        };
      }
      if (table === "metric_corrections") {
        return {
          select: () => ({
            gte: () => ({ lte: () => ({ order: async () => ({ data: [], error: null }) }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const period = { from: "2026-09-01", to: "2026-09-30" };

describe("listMetricHistory honors view_dashboard grant/revoke", () => {
  it("returns history for display, whose default keeps view_dashboard", async () => {
    const supabase = supabaseFor("display", []);
    const result = (await (listMetricHistory as unknown as Handler)({
      context: { supabase, userId: "display" },
      data: period,
    })) as { rows: unknown[] };
    expect(result.rows).toEqual([{ id: "snap-1" }]);
  });

  it("denies staff with view_dashboard explicitly revoked", async () => {
    const supabase = supabaseFor("staff", [
      { role: "staff", permission: "view_dashboard", allowed: false },
    ]);
    await expect(
      (listMetricHistory as unknown as Handler)({
        context: { supabase, userId: "staff" },
        data: period,
      }),
    ).rejects.toThrow("You do not have permission to view metric history.");
  });
});
