/**
 * Phase 1 permission regression tests (P12-04) for imports.functions.ts.
 * Covers registerImport (upload_imports), acceptImport (approve_imports),
 * rejectImport (approve_imports) permission gating, and rejectImport's
 * zero-row write being reported as an error rather than a silent success.
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

import { registerImport, acceptImport, rejectImport } from "./imports.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;

describe("registerImport requires upload_imports", () => {
  it("denies a caller without upload_imports", async () => {
    requireShopPermission.mockRejectedValueOnce(
      new Error("You do not have permission to do that."),
    );
    const supabase = { from: () => ({}) };
    await expect(
      (registerImport as unknown as Handler)({
        context: { supabase, userId: "staff" },
        data: {
          file_name: "report.csv",
          storage_path: "shop-a/report.csv",
          mime_type: "text/csv",
          file_hash: "0123456789abcdef",
          file_size: 100,
          report_scope: "daily",
          period_start: null,
          period_end: null,
          captured_at: null,
        },
      }),
    ).rejects.toThrow("You do not have permission to do that.");
  });

  it("allows a caller granted upload_imports", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "staff",
      status: "approved",
    });
    const supabase = {
      from: (table: string) => {
        if (table === "imports") {
          return {
            insert: () => ({
              select: () => ({ single: async () => ({ data: { id: "import-1" }, error: null }) }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const result = await (registerImport as unknown as Handler)({
      context: { supabase, userId: "staff" },
      data: {
        file_name: "report.csv",
        storage_path: "shop-a/report.csv",
        mime_type: "text/csv",
        file_hash: "0123456789abcdef",
        file_size: 100,
        report_scope: "daily",
        period_start: null,
        period_end: null,
        captured_at: null,
      },
    });
    expect(result).toEqual({ duplicate: false, importId: "import-1" });
  });
});

describe("acceptImport requires approve_imports", () => {
  it("denies a caller without approve_imports", async () => {
    requireShopPermission.mockRejectedValueOnce(
      new Error("You do not have permission to do that."),
    );
    const supabase = { rpc: vi.fn() };
    await expect(
      (acceptImport as unknown as Handler)({
        context: { supabase, userId: "staff" },
        data: { importId: "11111111-1111-4111-8111-111111111111", rows: [] },
      }),
    ).rejects.toThrow("You do not have permission to do that.");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("rejectImport requires approve_imports and never reports a zero-row success", () => {
  const importId = "22222222-2222-4222-8222-222222222222";

  it("denies a caller without approve_imports", async () => {
    requireShopPermission.mockRejectedValueOnce(
      new Error("You do not have permission to do that."),
    );
    const supabase = { from: () => ({}) };
    await expect(
      (rejectImport as unknown as Handler)({
        context: { supabase, userId: "staff" },
        data: { importId },
      }),
    ).rejects.toThrow("You do not have permission to do that.");
  });

  it("throws when the update affects zero rows instead of reporting success", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "manager",
      status: "approved",
    });
    const supabase = {
      from: (table: string) => {
        if (table !== "imports") throw new Error(`unexpected table ${table}`);
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { status: "extracted" }, error: null }) }),
          }),
          update: () => ({
            eq: () => ({ select: async () => ({ data: [], error: null }) }),
          }),
        };
      },
    };
    await expect(
      (rejectImport as unknown as Handler)({
        context: { supabase, userId: "manager" },
        data: { importId },
      }),
    ).rejects.toThrow("That import could not be rejected.");
  });

  it("succeeds when granted and the update affects a row", async () => {
    requireShopPermission.mockResolvedValueOnce({
      shop_id: "shop-a",
      role: "manager",
      status: "approved",
    });
    const supabase = {
      from: (table: string) => {
        if (table !== "imports") throw new Error(`unexpected table ${table}`);
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { status: "extracted" }, error: null }) }),
          }),
          update: () => ({
            eq: () => ({ select: async () => ({ data: [{ id: importId }], error: null }) }),
          }),
        };
      },
    };
    const result = await (rejectImport as unknown as Handler)({
      context: { supabase, userId: "manager" },
      data: { importId },
    });
    expect(result).toEqual({ ok: true });
  });
});
