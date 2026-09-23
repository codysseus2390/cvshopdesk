/**
 * Phase 1 permission regression tests (P12-04) for voice.functions.ts. Covers
 * saveHankVoiceSettings' change_settings grant/revoke — the same permission
 * Hank Settings' identity/behaviour save uses, and that migration 0023 routes
 * ai_settings' insert/update through at the SQL level.
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

import { saveHankVoiceSettings } from "./voice.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;

const validInput = {
  enabled: true,
  autoSpeak: false,
  voiceId: "voice-1",
  voiceName: "Hank",
  speed: 1,
  stability: 0.5,
  similarity: 0.75,
  style: 0,
  speakerBoost: true,
  inputMode: "auto" as const,
  autoListen: true,
  wakeEnabled: false,
  wakePhrase: "Hey Hank",
  wakeSound: true,
  wakeResponse: false,
  wakeTimeoutSeconds: 30,
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

describe("saveHankVoiceSettings honors change_settings grant/revoke", () => {
  it("saves for a manager (default change_settings)", async () => {
    const supabase = supabaseFor("manager", []);
    const result = await (saveHankVoiceSettings as unknown as Handler)({
      context: { supabase, userId: "manager" },
      data: validInput,
    });
    expect(result).toEqual({ ok: true });
  });

  it("denies staff without an explicit change_settings grant", async () => {
    const supabase = supabaseFor("staff", []);
    await expect(
      (saveHankVoiceSettings as unknown as Handler)({
        context: { supabase, userId: "staff" },
        data: validInput,
      }),
    ).rejects.toThrow("Only the owner and admins can change Hank's voice.");
  });

  it("allows staff explicitly granted change_settings", async () => {
    const supabase = supabaseFor("staff", [
      { role: "staff", permission: "change_settings", allowed: true },
    ]);
    const result = await (saveHankVoiceSettings as unknown as Handler)({
      context: { supabase, userId: "staff" },
      data: validInput,
    });
    expect(result).toEqual({ ok: true });
  });

  it("throws when the upsert affects zero rows (not a silent success)", async () => {
    const base = supabaseFor("owner", []);
    const zeroRowSupabase = {
      ...base,
      from: (table: string) => {
        if (table === "ai_settings") {
          return { upsert: () => ({ select: async () => ({ data: [], error: null }) }) };
        }
        return base.from(table);
      },
    };
    await expect(
      (saveHankVoiceSettings as unknown as Handler)({
        context: { supabase: zeroRowSupabase, userId: "owner" },
        data: validInput,
      }),
    ).rejects.toThrow("Hank's voice settings were not saved. Nothing was changed.");
  });
});
