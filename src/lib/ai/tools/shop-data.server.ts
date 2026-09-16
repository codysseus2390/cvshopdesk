/**
 * Read-only Shop AI tools. Nothing here changes data.
 */
import { z } from "zod";
import { monthToDate, yearToDate, type MetricRow } from "@/lib/metrics-math";
import { splitBoard } from "@/lib/import-records";
import type { ShopAiTool } from "../tools.server";

const searchSchema = z.object({ search: z.string().max(120).optional() });

function term(value: string) {
  return `%${value.trim()}%`;
}

export const SHOP_DATA_TOOLS: ShopAiTool[] = [
  {
    name: "get_numbers_report",
    sourceLabel: "Numbers report",
    description:
      "Reads the Numbers report for a week, month or year: sales, gross profit, gross profit %, cars, tires and technician productivity with each metric's goal, variance, the same period last year and the year-over-year change. Use this for goal progress, period comparisons and year-over-year questions.",
    permission: "view_dashboard",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["weekly", "monthly", "yearly"], description: "Reporting period. Defaults to monthly." },
        anchor: { type: "string", description: "Any date inside the period, YYYY-MM-DD. Defaults to today." },
      },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const parsed = z
        .object({
          period: z.enum(["weekly", "monthly", "yearly"]).optional(),
          anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        })
        .parse(args);
      const { buildNumbersReport } = await import("@/lib/numbers.server");
      const report = await buildNumbersReport(
        ctx.supabase,
        { shopId: ctx.shopId, role: "", timezone: ctx.timezone, name: "" },
        parsed.period ?? "monthly",
        parsed.anchor,
      );
      return { data: report };
    },
  },
  {
    name: "get_dashboard_numbers",
    sourceLabel: "Dashboard numbers",
    description:
      "Reads saved shop metrics: today's daily numbers plus month-to-date and year-to-date gross profit, tires sold, car count and gross profit per car. Use this for any question about shop performance figures.",
    permission: "view_dashboard",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async (ctx) => {
      const year = ctx.today.slice(0, 4);
      const { data, error } = await ctx.supabase
        .from("metric_snapshots")
        .select("id, business_date, scope, gross_profit, tires_sold, car_count, source, note, created_at")
        .eq("is_current", true)
        .gte("business_date", `${year}-01-01`)
        .order("business_date", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = ((data ?? []) as (MetricRow & { created_at: string })[]).filter(
        (row) => row.business_date <= ctx.today,
      );
      return {
        data: {
          shopToday: ctx.today,
          today: rows.find((row) => row.business_date === ctx.today && row.scope === "daily") ?? null,
          monthToDate: monthToDate(rows, ctx.today.slice(0, 7), ctx.today),
          yearToDate: yearToDate(rows, year, ctx.today),
          recentDaily: rows.filter((row) => row.scope === "daily").slice(-14),
        },
      };
    },
  },
  {
    name: "search_customers",
    sourceLabel: "Customers & vehicles",
    description:
      "Searches saved customer records by name, phone or email and returns their vehicles. Use before creating a customer, so duplicates are avoided.",
    permission: "view_dashboard",
    parameters: {
      type: "object",
      properties: { search: { type: "string", description: "Name, phone or email fragment." } },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const { search } = searchSchema.parse(args);
      let query = ctx.supabase
        .from("customers")
        .select("id, name, phone, email, external_id, needs_review, vehicles(id, year, make, model, vin, plate)")
        .order("name", { ascending: true })
        .limit(25);
      if (search?.trim()) query = query.or(`name.ilike.${term(search)},phone.ilike.${term(search)},email.ilike.${term(search)}`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { data: { customers: data ?? [] } };
    },
  },
  {
    name: "search_inventory",
    sourceLabel: "Inventory snapshots",
    description:
      "Searches the latest imported inventory snapshot rows by description, brand or tire size. Quantities are as of the snapshot date shown on each row.",
    permission: "view_dashboard",
    parameters: {
      type: "object",
      properties: { search: { type: "string", description: "Description, brand or size fragment." } },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const { search } = searchSchema.parse(args);
      let query = ctx.supabase
        .from("inventory_items")
        .select("id, description, brand, size, quantity, price, cost, snapshot_date, needs_review")
        .order("snapshot_date", { ascending: false })
        .limit(40);
      if (search?.trim())
        query = query.or(`description.ilike.${term(search)},brand.ilike.${term(search)},size.ilike.${term(search)}`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { data: { items: data ?? [] } };
    },
  },
  {
    name: "list_board_jobs",
    sourceLabel: "Job & appointment board",
    description:
      "Reads the current shop board: upcoming appointments and unfinished jobs from the latest accepted import, with staff notes and local statuses.",
    permission: "view_dashboard",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async (ctx) => {
      const { data, error } = await ctx.supabase
        .from("shop_jobs")
        .select(
          "id, record_kind, customer_name, vehicle_label, requested_service, technician, arrival_at, appointment_at, disposition, job_status, snapshot_at, local_status, local_note",
        )
        .eq("is_current", true)
        .limit(200);
      if (error) throw new Error(error.message);
      const split = splitBoard(data ?? [], Date.now());
      return { data: { ...split, shopToday: ctx.today } };
    },
  },
  {
    name: "search_tire_orders",
    sourceLabel: "Tire orders",
    description:
      "Searches tire orders in this app by customer name, brand, model or size, optionally filtered by status (draft, ordered, received, installed, cancelled).",
    permission: "view_dashboard",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Customer, brand, model or size fragment." },
        status: { type: "string", enum: ["draft", "ordered", "received", "installed", "cancelled"] },
      },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const parsed = z
        .object({
          search: z.string().max(120).optional(),
          status: z.enum(["draft", "ordered", "received", "installed", "cancelled"]).optional(),
        })
        .parse(args);
      let query = ctx.supabase
        .from("tire_orders")
        .select(
          "id, customer_name, phone, vehicle_label, brand, model, size, quantity, price_each, vendor, status, notes, created_at, received_at",
        )
        .order("created_at", { ascending: false })
        .limit(30);
      if (parsed.status) query = query.eq("status", parsed.status);
      if (parsed.search?.trim())
        query = query.or(
          `customer_name.ilike.${term(parsed.search)},brand.ilike.${term(parsed.search)},model.ilike.${term(parsed.search)},size.ilike.${term(parsed.search)}`,
        );
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { data: { orders: data ?? [] } };
    },
  },
  {
    name: "list_technician_productivity",
    sourceLabel: "Technician productivity",
    description: "Reads saved technician productivity entries, newest first, optionally for one technician.",
    permission: "view_productivity",
    parameters: {
      type: "object",
      properties: { technician: { type: "string" }, from: { type: "string", description: "YYYY-MM-DD" } },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const parsed = z
        .object({
          technician: z.string().max(80).optional(),
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        })
        .parse(args);
      let query = ctx.supabase
        .from("technician_productivity")
        .select("id, business_date, technician, productivity_pct, hours_billed, hours_worked, cars, note")
        .order("business_date", { ascending: false })
        .limit(60);
      if (parsed.technician?.trim()) query = query.ilike("technician", term(parsed.technician));
      if (parsed.from) query = query.gte("business_date", parsed.from);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { data: { entries: data ?? [] } };
    },
  },
  {
    name: "list_ai_action_log",
    sourceLabel: "AI action log",
    description: "Reads the log of changes Shop AI has made in this app, newest first.",
    permission: "view_dashboard",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async (ctx) => {
      const { data, error } = await ctx.supabase
        .from("ai_actions")
        .select("id, tool, status, confirmation_required, confirmed, target_table, target_id, created_at, error")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw new Error(error.message);
      return { data: { actions: data ?? [] } };
    },
  },
];
