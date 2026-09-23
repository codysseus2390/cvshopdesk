/**
 * Phase 1 permission regression tests (P12-04) for ai-settings.functions.ts.
 * Covers saveAiSettings' change_settings grant/revoke (Hank Settings identity
 * and behaviour toggles), matching the app-level check used by ai_settings'
 * insert/update, which migration 0023 also routes through change_settings.
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

import { saveAiSettings } from "./ai-settings.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;

const validInput = {
  assistantName: "Hank",
  subtitle: "Shop Assistant",
  avatarUrl: null,
  personality: "",
  casualLanguage: true,
  humor: true,
  mildProfanity: false,
  shopBanter: false,
  customerFacingProfessional: true,
  modelTier: "fast" as const,
  disabledTools: [],
  visionEnabled: true,
};

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
              maybeSingle: async () => ({
                data: { shop_id: "shop-a", role, status: "approved" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "role_permissions") {
        return { select: () => ({ eq: async () => ({ data: overrides, error: null }) }) };
      }
      if (table === "ai_settings") {
        return {
          upsert: () => ({ select: async () => ({ data: [{ shop_id: "shop-a" }], error: null }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  };
}

describe("saveAiSettings honors change_settings grant/revoke", () => {
  it("saves Hank's settings for the owner (default change_settings)", async () => {
    const supabase = supabaseFor("owner", []);
    const result = await (saveAiSettings as unknown as Handler)({
      context: { supabase, userId: "owner" },
      data: validInput,
    });
    expect(result).toEqual({ ok: true });
  });

  it("denies staff without an explicit change_settings grant", async () => {
    const supabase = supabaseFor("staff", []);
    await expect(
      (saveAiSettings as unknown as Handler)({
        context: { supabase, userId: "staff" },
        data: validInput,
      }),
    ).rejects.toThrow("Only the owner and admins can change Hank's settings.");
  });

  it("allows staff explicitly granted change_settings", async () => {
    const supabase = supabaseFor("staff", [
      { role: "staff", permission: "change_settings", allowed: true },
    ]);
    const result = await (saveAiSettings as unknown as Handler)({
      context: { supabase, userId: "staff" },
      data: validInput,
    });
    expect(result).toEqual({ ok: true });
  });

  it("denies a manager with change_settings explicitly revoked", async () => {
    const supabase = supabaseFor("manager", [
      { role: "manager", permission: "change_settings", allowed: false },
    ]);
    await expect(
      (saveAiSettings as unknown as Handler)({
        context: { supabase, userId: "manager" },
        data: validInput,
      }),
    ).rejects.toThrow("Only the owner and admins can change Hank's settings.");
  });
});
