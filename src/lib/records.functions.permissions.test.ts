/**
 * Phase 1 permission regression tests (P12-04) for records.functions.ts.
 * Covers updateJobLocalState's edit_records gate and its zero-row write being
 * reported as an error rather than a silent success.
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
vi.mock("./permissions.server", () => ({
  requireShopPermission: (...args: unknown[]) => requireShopPermission(...args),
}));

import { updateJobLocalState } from "./records.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;

const jobId = "33333333-3333-4333-8333-333333333333";

describe("updateJobLocalState requires edit_records", () => {
  it("denies a caller without edit_records", async () => {
    requireShopPermission.mockRejectedValueOnce(
      new Error("You do not have permission to do that."),
    );
    const supabase = { from: () => ({}) };
    await expect(
      (updateJobLocalState as unknown as Handler)({
        context: { supabase, userId: "display" },
        data: { jobId, local_status: "in_progress", local_note: null },
      }),
    ).rejects.toThrow("You do not have permission to do that.");
  });

  it("throws when the update affects zero rows instead of reporting success", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "staff",
      status: "approved",
    });
    const supabase = {
      from: (table: string) => {
        if (table !== "shop_jobs") throw new Error(`unexpected table ${table}`);
        return {
          update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }),
        };
      },
    };
    await expect(
      (updateJobLocalState as unknown as Handler)({
        context: { supabase, userId: "staff" },
        data: { jobId, local_status: "in_progress", local_note: null },
      }),
    ).rejects.toThrow("That job could not be updated.");
  });

  it("succeeds when granted and the update affects a row", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "staff",
      status: "approved",
    });
    const supabase = {
      from: (table: string) => {
        if (table !== "shop_jobs") throw new Error(`unexpected table ${table}`);
        return {
          update: () => ({
            eq: () => ({ select: async () => ({ data: [{ id: jobId }], error: null }) }),
          }),
        };
      },
    };
    const result = await (updateJobLocalState as unknown as Handler)({
      context: { supabase, userId: "staff" },
      data: { jobId, local_status: "in_progress", local_note: null },
    });
    expect(result).toEqual({ ok: true });
  });
});
