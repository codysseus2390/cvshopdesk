/**
 * Historical monthly reporting tools for Hank.
 *
 * Completed monthly totals are stored as `mtd`-scope records in the same
 * `metric_snapshots` table the dashboard, Numbers page and reports already read,
 * one current record per month (business date = last day of the month, or the
 * shop's business day for the month in progress). There is no separate
 * AI-only monthly store: correcting a month supersedes the previous record and
 * writes the correction history through `save_shop_metrics`, exactly like the
 * Numbers page Edit Numbers workflow.
 */
import { z } from "zod";
import { ConfirmationRequiredError, type ShopAiTool } from "../tools.server";
import { aggregatePeriod, resolvePeriod, daysInMonth, type NumbersRow } from "@/lib/numbers-math";

const monthRow = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  sales: z.number().finite().nullable().optional(),
  gross_profit: z.number().finite().nullable().optional(),
  tires_sold: z.number().int().nullable().optional(),
  car_count: z.number().int().nullable().optional(),
  note: z.string().max(500).optional(),
});

type MonthRow = z.infer<typeof monthRow>;

function monthPrefix(row: MonthRow) {
  return `${row.year}-${String(row.month).padStart(2, "0")}`;
}

/** The business date a month's total is stored against. */
function monthBusinessDate(prefix: string, today: string) {
  const last = `${prefix}-${String(daysInMonth(prefix)).padStart(2, "0")}`;
  return last > today ? today : last;
}

const monthlyProps = {
  year: { type: "integer" },
  month: { type: "integer", description: "1 = January … 12 = December." },
  sales: { type: "number", description: "Total sales / order sales for the month." },
  gross_profit: { type: "number", description: "Gross profit / order profit for the month." },
  tires_sold: { type: "integer" },
  car_count: { type: "integer" },
  note: {
    type: "string",
    description: "Where the numbers came from, e.g. 'From monthly report screenshot'.",
  },
};

export const MONTHLY_NUMBER_TOOLS: ShopAiTool[] = [
  {
    name: "get_monthly_numbers",
    sourceLabel: "Monthly numbers",
    description:
      "Reads the shop's saved monthly totals for a year: sales, gross profit, gross profit %, cars, tires and gross profit per car for each month, and whether the month has an accepted monthly record or only daily records. Use this before correcting a month, and for questions about a past month or a month-to-month comparison.",
    permission: "view_dashboard",
    parameters: {
      type: "object",
      properties: { year: { type: "integer", description: "Defaults to the current year." } },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const { year } = z
        .object({ year: z.number().int().min(2000).max(2100).optional() })
        .parse(args);
      const y = year ?? Number(ctx.today.slice(0, 4));
      const { data, error } = await ctx.supabase
        .from("metric_snapshots")
        .select(
          "business_date, scope, sales, gross_profit, tires_sold, car_count, created_at, note, source",
        )
        .eq("is_current", true)
        .gte("business_date", `${y}-01-01`)
        .lte("business_date", `${y}-12-31`);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as NumbersRow[];

      const months = [];
      for (let m = 1; m <= 12; m++) {
        const prefix = `${y}-${String(m).padStart(2, "0")}`;
        const range = resolvePeriod("monthly", `${prefix}-01`);
        const values = aggregatePeriod(rows, range, ctx.today);
        months.push({
          year: y,
          month: m,
          label: range.label,
          sales: values.sales,
          gross_profit: values.gross_profit,
          gp_percent: values.gp_percent,
          tires_sold: values.tires_sold,
          car_count: values.car_count,
          gp_per_car:
            values.gross_profit === null || values.car_count === null || values.car_count === 0
              ? null
              : values.gross_profit / values.car_count,
          basis: values.basis,
          as_of: values.as_of,
        });
      }
      return { data: { year: y, shopToday: ctx.today, months } };
    },
  },
  {
    name: "save_monthly_numbers",
    sourceLabel: "Monthly numbers",
    description:
      "Saves or corrects completed monthly totals — one record per month and year — for sales, gross profit, tires sold and car count. Use this for any historical month (e.g. January 2026 through September 2026) and never use the current month-to-date record as a stand-in for a past month. Several months can be sent in one call; every row is validated before anything is written. Gross profit per car is calculated, never entered. When a month already has a saved record this is a correction and needs the user's confirmation first.",
    permission: "edit_dashboard_numbers",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        months: {
          type: "array",
          description: "One entry per month. Leave a metric out when you could not read it.",
          items: {
            type: "object",
            properties: monthlyProps,
            required: ["year", "month"],
            additionalProperties: false,
          },
        },
        note: {
          type: "string",
          description: "Note applied to every month that has no note of its own.",
        },
        ...{
          confirmed: {
            type: "boolean",
            description:
              "Set true only after the user explicitly approved these exact monthly numbers.",
          },
        },
      },
      required: ["months"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          months: z.array(monthRow).min(1).max(24),
          note: z.string().max(500).optional(),
          confirmed: z.boolean().optional(),
        })
        .parse(args);

      // Validate every row up front: nothing is written when one row is wrong.
      const problems: string[] = [];
      const seen = new Set<string>();
      for (const row of input.months) {
        const prefix = monthPrefix(row);
        if (seen.has(prefix)) problems.push(`${prefix} appears more than once in this request.`);
        seen.add(prefix);
        if (prefix > ctx.today.slice(0, 7)) problems.push(`${prefix} is in the future.`);
        const hasValue = [row.sales, row.gross_profit, row.tires_sold, row.car_count].some(
          (v) => v !== null && v !== undefined,
        );
        if (!hasValue) problems.push(`${prefix} has no numbers to save.`);
      }
      if (problems.length > 0) throw new Error(`These rows were not saved: ${problems.join(" ")}`);

      const dates = input.months.map((row) => monthBusinessDate(monthPrefix(row), ctx.today));
      const { data: existingRows, error: readError } = await ctx.supabase
        .from("metric_snapshots")
        .select("id, business_date, scope, sales, gross_profit, tires_sold, car_count")
        .eq("scope", "mtd")
        .eq("is_current", true)
        .in("business_date", dates);
      if (readError) throw new Error(readError.message);
      const existingByMonth = new Map<string, any>(
        ((existingRows ?? []) as any[]).map((r) => [String(r.business_date).slice(0, 7), r]),
      );

      const conflicts = input.months
        .map((row) => ({ row, existing: existingByMonth.get(monthPrefix(row)) }))
        .filter((entry) => entry.existing);
      if (conflicts.length > 0 && input.confirmed !== true) {
        throw new ConfirmationRequiredError(
          `These months already have saved totals and would be corrected: ${conflicts
            .map(
              ({ row, existing }) =>
                `${monthPrefix(row)} (saved sales ${existing.sales ?? "not updated"}, gross profit ${
                  existing.gross_profit ?? "not updated"
                }, tires ${existing.tires_sold ?? "not updated"}, cars ${existing.car_count ?? "not updated"} → new sales ${
                  row.sales ?? "unchanged"
                }, gross profit ${row.gross_profit ?? "unchanged"}, tires ${row.tires_sold ?? "unchanged"}, cars ${
                  row.car_count ?? "unchanged"
                })`,
            )
            .join(
              "; ",
            )}. Describe this to the user and call the tool again with confirmed=true only after they agree.`,
        );
      }

      const saved: Record<string, unknown>[] = [];
      const before: Record<string, unknown>[] = [];
      for (const row of input.months) {
        const prefix = monthPrefix(row);
        const existing = existingByMonth.get(prefix);
        const businessDate = monthBusinessDate(prefix, ctx.today);
        const values = {
          sales: row.sales ?? existing?.sales ?? null,
          gross_profit: row.gross_profit ?? existing?.gross_profit ?? null,
          tires_sold: row.tires_sold ?? existing?.tires_sold ?? null,
          car_count: row.car_count ?? existing?.car_count ?? null,
        };
        const flags = Object.entries(values)
          .filter(([, v]) => v === null)
          .map(([field]) => `${field} missing`);

        const note = row.note ?? input.note ?? "Monthly total entered through Hank";
        const { data: id, error } = await ctx.supabase.rpc("save_shop_metrics", {
          p_shop_id: ctx.shopId,
          p_business_date: businessDate,
          p_scope: "mtd",
          p_sales: values.sales,
          p_gross_profit: values.gross_profit,
          p_tires_sold: values.tires_sold,
          p_car_count: values.car_count,
          p_source: "manual",
          p_import_id: null,
          p_note: note,
          p_flags: flags,
          p_correction_note: existing ? note : null,
        });
        if (error) throw new Error(`${prefix} was not saved: ${error.message}`);

        if (existing) before.push({ month: prefix, ...existing });
        saved.push({
          month: prefix,
          business_date: businessDate,
          snapshot_id: id ?? null,
          corrected: Boolean(existing),
          ...values,
          gp_per_car:
            values.gross_profit === null || values.car_count === null || values.car_count === 0
              ? null
              : values.gross_profit / values.car_count,
          flags,
        });
      }

      return {
        data: { saved: saved.length, months: saved },
        targetTable: "metric_snapshots",
        targetId: saved.map((s) => String(s["month"])).join(","),
        before: before.length > 0 ? before : null,
        after: saved,
      };
    },
  },
];
