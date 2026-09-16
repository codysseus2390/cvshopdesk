import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { can, type PermissionKey } from "@/lib/permissions";
import { resolvePeriod } from "@/lib/numbers-math";

const periodInput = z.object({
  kind: z.enum(["weekly", "monthly", "yearly"]),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type Supa = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

async function requirePermission(supabase: unknown, userId: string, permission: PermissionKey) {
  const { resolveShop } = await import("./numbers.server");
  const shop = await resolveShop(supabase, userId);
  const { data: overrides } = await (supabase as Supa)
    .from("role_permissions")
    .select("role, permission, allowed")
    .eq("shop_id", shop.shopId);
  if (!can(shop.role, permission, (overrides ?? []) as { role: string; permission: string; allowed: boolean }[])) {
    throw new Error("You do not have permission to do that.");
  }
  return shop;
}

/** The full report for one period: actual, goal, variance, previous year, year-over-year. */
export const getNumbersReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodInput.parse(input))
  .handler(async ({ data, context }) => {
    const { buildNumbersReport, resolveShop } = await import("./numbers.server");
    const shop = await resolveShop(context.supabase, context.userId);
    const report = await buildNumbersReport(context.supabase, shop, data.kind, data.anchor);
    return { ...report, shop: { name: shop.name, timezone: shop.timezone, role: shop.role } };
  });

const nullableNumber = z
  .union([z.number(), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : Number(v)));

/**
 * Correction of a period's stored numbers. The previous snapshot is kept and
 * superseded, and every changed field is written to the correction history.
 */
export const saveNumbersCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["monthly", "yearly"]),
        anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sales: nullableNumber,
        gross_profit: nullableNumber,
        tires_sold: nullableNumber,
        car_count: nullableNumber,
        productivity: z
          .array(z.object({ technician: z.string().min(1).max(120), value: nullableNumber }))
          .max(40)
          .optional(),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const shop = await requirePermission(context.supabase, context.userId, "edit_dashboard_numbers");
    const sb = context.supabase as unknown as Supa;
    const range = resolvePeriod(data.kind, data.anchor);
    const { shopToday } = await import("./metrics-math");
    const today = shopToday(shop.timezone);
    // Never date a correction in the future: current periods are stamped with the shop day.
    const businessDate = range.to > today && range.from <= today ? today : range.to;
    const scope = data.kind === "monthly" ? "mtd" : "ytd";

    const flags: string[] = [];
    for (const [field, value] of Object.entries({
      sales: data.sales,
      gross_profit: data.gross_profit,
      tires_sold: data.tires_sold,
      car_count: data.car_count,
    })) {
      if (value === null) flags.push(`${field} missing`);
    }

    const { data: snapshotId, error } = await sb.rpc("save_shop_metrics", {
      p_shop_id: shop.shopId,
      p_business_date: businessDate,
      p_scope: scope,
      p_sales: data.sales,
      p_gross_profit: data.gross_profit,
      p_tires_sold: data.tires_sold,
      p_car_count: data.car_count,
      p_source: "manual",
      p_import_id: null,
      p_note: data.note ?? "Manual correction from the Numbers page",
      p_flags: flags,
      p_correction_note: data.note ?? null,
    });
    if (error) throw new Error(error.message);

    for (const entry of data.productivity ?? []) {
      const { error: prodError } = await sb.rpc("save_period_productivity", {
        p_shop_id: shop.shopId,
        p_business_date: businessDate,
        p_technician: entry.technician,
        p_productivity_pct: entry.value,
        p_period_scope: data.kind,
        p_correction_scope: scope,
        p_note: data.note ?? null,
      });
      if (prodError) throw new Error(prodError.message);
    }

    await sb.rpc("log_audit_event", {
      p_action: "numbers_corrected",
      p_target: `${data.kind}:${range.label}`,
      p_detail: { business_date: businessDate, scope, note: data.note ?? null },
    });

    return { snapshotId: snapshotId as string, businessDate, scope, flags };
  });

/** Goal rules per metric: a fixed target or growth over the same period last year. */
export const saveNumbersGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        goal_rules: z.record(
          z.string().max(140),
          z.object({
            method: z.enum(["fixed", "growth"]),
            monthly: z.number().nullable().optional(),
            yearly: z.number().nullable().optional(),
            growth_pct: z.number().nullable().optional(),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const shop = await requirePermission(context.supabase, context.userId, "change_settings");
    if (shop.role !== "owner" && shop.role !== "manager") {
      throw new Error("Only the owner and admins can change goals.");
    }
    const sb = context.supabase as unknown as Supa;
    const { error } = await sb.from("shop_settings").upsert(
      {
        shop_id: shop.shopId,
        goal_rules: data.goal_rules,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id" },
    );
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit_event", {
      p_action: "numbers_goals_saved",
      p_target: "shop_settings.goal_rules",
      p_detail: { metrics: Object.keys(data.goal_rules).length },
    });
    return { ok: true };
  });
