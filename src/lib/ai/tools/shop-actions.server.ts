/**
 * Shop AI action tools: the writes Shop AI is allowed to perform.
 *
 * Each tool re-uses the same tables and database functions the app's own forms
 * use, runs on the signed-in staff member's authenticated client, validates its
 * arguments with zod, and reports before/after values for the AI action log.
 *
 * Consequential changes throw ConfirmationRequiredError until the model calls
 * the tool again with confirmed=true, which it may only do after the user has
 * agreed to the exact change.
 */
import { z } from "zod";
import { ConfirmationRequiredError, type ShopAiTool } from "../tools.server";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const money = z.number().finite().nullable().optional();

function confirmed(args: Record<string, unknown>) {
  return args["confirmed"] === true;
}

const confirmProp = {
  confirmed: {
    type: "boolean",
    description: "Set true only after the user explicitly approved this exact change.",
  },
};

export const SHOP_ACTION_TOOLS: ShopAiTool[] = [
  {
    name: "save_shop_numbers",
    sourceLabel: "Dashboard numbers",
    description:
      "Saves or corrects the shop's numbers for one business date and scope (daily, mtd or ytd): sales, gross profit, tires sold and car count. Sales and gross profit are separate values — never use one for the other. Leave a field out to keep it unknown. Use save_monthly_numbers for completed past months instead of this tool. Correcting a date that already has numbers is a consequential change.",
    permission: "edit_dashboard_numbers",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        business_date: {
          type: "string",
          description: "YYYY-MM-DD. Defaults to the shop's current business day.",
        },
        scope: { type: "string", enum: ["daily", "mtd", "ytd"], description: "Defaults to daily." },
        sales: {
          type: "number",
          description: "Total sales / order sales. Separate from gross profit.",
        },
        gross_profit: { type: "number" },
        tires_sold: { type: "integer" },
        car_count: { type: "integer" },
        note: { type: "string" },
        ...confirmProp,
      },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          business_date: dateSchema.optional(),
          scope: z.enum(["daily", "mtd", "ytd"]).default("daily"),
          sales: money,
          gross_profit: money,
          tires_sold: z.number().int().nullable().optional(),
          car_count: z.number().int().nullable().optional(),
          note: z.string().max(1000).optional(),
        })
        .parse(args);

      const businessDate = input.business_date ?? ctx.today;
      if (businessDate > ctx.today) throw new Error("Numbers cannot be saved for a future date.");

      const { data: existing } = await ctx.supabase
        .from("metric_snapshots")
        .select("id, sales, gross_profit, tires_sold, car_count")
        .eq("business_date", businessDate)
        .eq("scope", input.scope)
        .eq("is_current", true)
        .maybeSingle();

      if (existing && !confirmed(args)) {
        throw new ConfirmationRequiredError(
          `${businessDate} (${input.scope}) already has saved numbers: gross profit ${existing.gross_profit ?? "not updated"}, tires ${existing.tires_sold ?? "not updated"}, cars ${existing.car_count ?? "not updated"}. Ask the user to confirm replacing them with gross profit ${input.gross_profit ?? "unchanged/unknown"}, tires ${input.tires_sold ?? "unchanged/unknown"}, cars ${input.car_count ?? "unchanged/unknown"}.`,
        );
      }

      const gross = input.gross_profit ?? existing?.gross_profit ?? null;
      const tires = input.tires_sold ?? existing?.tires_sold ?? null;
      const cars = input.car_count ?? existing?.car_count ?? null;
      const sales = input.sales ?? existing?.sales ?? null;
      const flags: string[] = [];
      if (sales === null) flags.push("sales missing");
      if (gross === null) flags.push("gross_profit missing");
      if (tires === null) flags.push("tires_sold missing");
      if (cars === null) flags.push("car_count missing");

      const { data: id, error } = await ctx.supabase.rpc("save_shop_metrics", {
        p_shop_id: ctx.shopId,
        p_business_date: businessDate,
        p_scope: input.scope,
        p_sales: sales,
        p_gross_profit: gross,
        p_tires_sold: tires,
        p_car_count: cars,
        p_source: "manual",
        p_import_id: null,
        p_note: input.note ?? "Entered through Shop AI",
        p_flags: flags,
        p_correction_note: existing ? "Corrected through Shop AI" : null,
      });
      if (error) throw new Error(error.message);

      return {
        data: {
          saved: true,
          business_date: businessDate,
          scope: input.scope,
          sales,
          gross_profit: gross,
          tires_sold: tires,
          car_count: cars,
          flags,
        },
        targetTable: "metric_snapshots",
        targetId: String(id ?? ""),
        before: existing ?? null,
        after: {
          business_date: businessDate,
          scope: input.scope,
          gross_profit: gross,
          tires_sold: tires,
          car_count: cars,
        },
      };
    },
  },
  {
    name: "save_technician_productivity",
    sourceLabel: "Technician productivity",
    description:
      "Saves a technician's productivity for a business date: productivity percentage, hours billed, hours worked and car count. Replacing an existing entry is a consequential change.",
    permission: "edit_dashboard_numbers",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        technician: { type: "string" },
        business_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        productivity_pct: { type: "number" },
        hours_billed: { type: "number" },
        hours_worked: { type: "number" },
        cars: { type: "integer" },
        note: { type: "string" },
        ...confirmProp,
      },
      required: ["technician"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          technician: z.string().min(1).max(80),
          business_date: dateSchema.optional(),
          productivity_pct: money,
          hours_billed: money,
          hours_worked: money,
          cars: z.number().int().nullable().optional(),
          note: z.string().max(500).optional(),
        })
        .parse(args);
      const businessDate = input.business_date ?? ctx.today;

      const { data: existing } = await ctx.supabase
        .from("technician_productivity")
        .select("id, technician, business_date, productivity_pct, hours_billed, hours_worked, cars")
        .eq("business_date", businessDate)
        .ilike("technician", input.technician)
        .maybeSingle();

      if (existing && !confirmed(args)) {
        throw new ConfirmationRequiredError(
          `${existing.technician} already has an entry for ${businessDate} (${existing.productivity_pct ?? "no percentage"}%). Ask the user to confirm replacing it.`,
        );
      }

      const row = {
        shop_id: ctx.shopId,
        business_date: businessDate,
        technician: existing?.technician ?? input.technician.trim(),
        productivity_pct: input.productivity_pct ?? existing?.productivity_pct ?? null,
        hours_billed: input.hours_billed ?? existing?.hours_billed ?? null,
        hours_worked: input.hours_worked ?? existing?.hours_worked ?? null,
        cars: input.cars ?? existing?.cars ?? null,
        note: input.note ?? null,
        entered_by: ctx.userId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await ctx.supabase
        .from("technician_productivity")
        .upsert(row, { onConflict: "shop_id,business_date,technician" })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);

      return {
        data: { saved: true, ...row },
        targetTable: "technician_productivity",
        targetId: String(data?.id ?? existing?.id ?? ""),
        before: existing ?? null,
        after: row,
      };
    },
  },
  {
    name: "create_customer",
    sourceLabel: "Customers",
    description:
      "Creates a customer record in this app, optionally with one vehicle. Search first so an existing customer is updated instead of duplicated.",
    permission: "edit_records",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        vehicle: {
          type: "object",
          properties: {
            year: { type: "string" },
            make: { type: "string" },
            model: { type: "string" },
            vin: { type: "string" },
            plate: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          name: z.string().min(2).max(160),
          phone: z.string().max(40).optional(),
          email: z.string().max(160).optional(),
          vehicle: z
            .object({
              year: z.string().max(10).optional(),
              make: z.string().max(60).optional(),
              model: z.string().max(60).optional(),
              vin: z.string().max(40).optional(),
              plate: z.string().max(20).optional(),
            })
            .optional(),
        })
        .parse(args);

      const identity = `ai:${input.name.trim().toLowerCase()}:${(input.phone ?? input.email ?? Date.now().toString()).trim().toLowerCase()}`;
      const { data: customer, error } = await ctx.supabase
        .from("customers")
        .insert({
          shop_id: ctx.shopId,
          name: input.name.trim(),
          phone: input.phone ?? null,
          email: input.email ?? null,
          identity_key: identity,
          flags: ["entered through Shop AI"],
        })
        .select("id, name, phone, email")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!customer?.id) throw new Error("The customer was not saved.");

      let vehicle: unknown = null;
      if (
        input.vehicle &&
        Object.values(input.vehicle).some((v) => v && String(v).trim().length > 0)
      ) {
        const { data: created, error: vehicleError } = await ctx.supabase
          .from("vehicles")
          .insert({
            shop_id: ctx.shopId,
            customer_id: customer.id,
            identity_key:
              `${identity}:${input.vehicle.vin ?? input.vehicle.plate ?? Date.now()}`.toLowerCase(),
            year: input.vehicle.year ?? null,
            make: input.vehicle.make ?? null,
            model: input.vehicle.model ?? null,
            vin: input.vehicle.vin ?? null,
            plate: input.vehicle.plate ?? null,
          })
          .select("id, year, make, model, vin, plate")
          .maybeSingle();
        if (vehicleError)
          throw new Error(`Customer saved, but the vehicle failed: ${vehicleError.message}`);
        vehicle = created ?? null;
      }

      return {
        data: { created: true, customer, vehicle },
        targetTable: "customers",
        targetId: String(customer.id),
        before: null,
        after: { customer, vehicle },
      };
    },
  },
  {
    name: "update_customer",
    sourceLabel: "Customers",
    description:
      "Updates an existing customer's name, phone or email. Changing saved customer contact details is a consequential change.",
    permission: "edit_records",
    mutating: true,
    requiresConfirmation: true,
    parameters: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The customer id from search_customers." },
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        ...confirmProp,
      },
      required: ["customer_id"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          customer_id: z.string().uuid(),
          name: z.string().min(2).max(160).optional(),
          phone: z.string().max(40).nullable().optional(),
          email: z.string().max(160).nullable().optional(),
        })
        .parse(args);

      const { data: before, error: readError } = await ctx.supabase
        .from("customers")
        .select("id, name, phone, email")
        .eq("id", input.customer_id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!before) throw new Error("That customer is not in this shop's records.");

      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch["name"] = input.name.trim();
      if (input.phone !== undefined) patch["phone"] = input.phone;
      if (input.email !== undefined) patch["email"] = input.email;
      if (Object.keys(patch).length === 0) throw new Error("Nothing to change was provided.");

      const { data: after, error } = await ctx.supabase
        .from("customers")
        .update(patch)
        .eq("id", input.customer_id)
        .select("id, name, phone, email")
        .maybeSingle();
      if (error) throw new Error(error.message);

      return {
        data: { updated: true, before, after },
        targetTable: "customers",
        targetId: input.customer_id,
        before,
        after,
      };
    },
  },
  {
    name: "save_vehicle",
    sourceLabel: "Vehicles",
    description:
      "Adds a vehicle to an existing customer, or updates one when vehicle_id is given. Updating an existing vehicle is a consequential change.",
    permission: "edit_records",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        vehicle_id: { type: "string", description: "Provide to update an existing vehicle." },
        year: { type: "string" },
        make: { type: "string" },
        model: { type: "string" },
        vin: { type: "string" },
        plate: { type: "string" },
        ...confirmProp,
      },
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          customer_id: z.string().uuid().optional(),
          vehicle_id: z.string().uuid().optional(),
          year: z.string().max(10).optional(),
          make: z.string().max(60).optional(),
          model: z.string().max(60).optional(),
          vin: z.string().max(40).optional(),
          plate: z.string().max(20).optional(),
        })
        .parse(args);

      const fields = {
        ...(input.year !== undefined ? { year: input.year } : {}),
        ...(input.make !== undefined ? { make: input.make } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.vin !== undefined ? { vin: input.vin } : {}),
        ...(input.plate !== undefined ? { plate: input.plate } : {}),
      };

      if (input.vehicle_id) {
        const { data: before, error: readError } = await ctx.supabase
          .from("vehicles")
          .select("id, customer_id, year, make, model, vin, plate")
          .eq("id", input.vehicle_id)
          .maybeSingle();
        if (readError) throw new Error(readError.message);
        if (!before) throw new Error("That vehicle is not in this shop's records.");
        if (!confirmed(args)) {
          throw new ConfirmationRequiredError(
            `This will change vehicle ${[before.year, before.make, before.model].filter(Boolean).join(" ") || before.id} to ${JSON.stringify(fields)}. Ask the user to confirm.`,
          );
        }
        const { data: after, error } = await ctx.supabase
          .from("vehicles")
          .update(fields)
          .eq("id", input.vehicle_id)
          .select("id, year, make, model, vin, plate")
          .maybeSingle();
        if (error) throw new Error(error.message);
        return {
          data: { updated: true, before, after },
          targetTable: "vehicles",
          targetId: input.vehicle_id,
          before,
          after,
        };
      }

      if (!input.customer_id) throw new Error("A customer_id is needed to add a vehicle.");
      const { data: after, error } = await ctx.supabase
        .from("vehicles")
        .insert({
          shop_id: ctx.shopId,
          customer_id: input.customer_id,
          identity_key:
            `ai:${input.customer_id}:${input.vin ?? input.plate ?? Date.now()}`.toLowerCase(),
          year: input.year ?? null,
          make: input.make ?? null,
          model: input.model ?? null,
          vin: input.vin ?? null,
          plate: input.plate ?? null,
        })
        .select("id, year, make, model, vin, plate")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        data: { created: true, vehicle: after },
        targetTable: "vehicles",
        targetId: String(after?.id ?? ""),
        before: null,
        after,
      };
    },
  },
  {
    name: "create_tire_order",
    sourceLabel: "Tire orders",
    description:
      "Creates a tire order in this app for a customer: brand, model, size, quantity, price each, vendor and notes. Status defaults to ordered.",
    permission: "edit_records",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        customer_id: { type: "string", description: "Link to a saved customer when known." },
        phone: { type: "string" },
        vehicle_label: { type: "string", description: "e.g. 2019 Ford F-150" },
        brand: { type: "string" },
        model: { type: "string" },
        size: { type: "string", description: "e.g. 225/65R17" },
        quantity: { type: "integer" },
        price_each: { type: "number" },
        vendor: { type: "string" },
        status: { type: "string", enum: ["draft", "ordered", "received", "installed"] },
        notes: { type: "string" },
      },
      required: ["customer_name"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          customer_name: z.string().min(2).max(160),
          customer_id: z.string().uuid().optional(),
          phone: z.string().max(40).optional(),
          vehicle_label: z.string().max(120).optional(),
          brand: z.string().max(80).optional(),
          model: z.string().max(80).optional(),
          size: z.string().max(40).optional(),
          quantity: z.number().int().min(1).max(100).default(4),
          price_each: money,
          vendor: z.string().max(80).optional(),
          status: z.enum(["draft", "ordered", "received", "installed"]).default("ordered"),
          notes: z.string().max(1000).optional(),
        })
        .parse(args);

      const row = {
        shop_id: ctx.shopId,
        customer_id: input.customer_id ?? null,
        customer_name: input.customer_name.trim(),
        phone: input.phone ?? null,
        vehicle_label: input.vehicle_label ?? null,
        brand: input.brand ?? null,
        model: input.model ?? null,
        size: input.size ?? null,
        quantity: input.quantity,
        price_each: input.price_each ?? null,
        vendor: input.vendor ?? null,
        status: input.status,
        notes: input.notes ?? null,
        created_by: ctx.userId,
        updated_by: ctx.userId,
        ...(input.status === "received" ? { received_at: new Date().toISOString() } : {}),
      };

      const { data, error } = await ctx.supabase
        .from("tire_orders")
        .insert(row)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        data: { created: true, order: data },
        targetTable: "tire_orders",
        targetId: String(data?.id ?? ""),
        before: null,
        after: data,
      };
    },
  },
  {
    name: "update_tire_order",
    sourceLabel: "Tire orders",
    description:
      "Updates a tire order: status (including marking it received or installed), quantity, price, vendor, size or notes. Cancelling an order, or changing quantity or price on an existing order, is a consequential change.",
    permission: "edit_records",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The id from search_tire_orders." },
        status: {
          type: "string",
          enum: ["draft", "ordered", "received", "installed", "cancelled"],
        },
        quantity: { type: "integer" },
        price_each: { type: "number" },
        vendor: { type: "string" },
        size: { type: "string" },
        notes: { type: "string" },
        ...confirmProp,
      },
      required: ["order_id"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          order_id: z.string().uuid(),
          status: z.enum(["draft", "ordered", "received", "installed", "cancelled"]).optional(),
          quantity: z.number().int().min(1).max(100).optional(),
          price_each: money,
          vendor: z.string().max(80).optional(),
          size: z.string().max(40).optional(),
          notes: z.string().max(1000).optional(),
        })
        .parse(args);

      const { data: before, error: readError } = await ctx.supabase
        .from("tire_orders")
        .select("*")
        .eq("id", input.order_id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!before) throw new Error("That tire order is not in this shop's records.");

      const consequential =
        input.status === "cancelled" ||
        (input.quantity !== undefined && input.quantity !== before.quantity) ||
        (input.price_each !== undefined && input.price_each !== before.price_each);
      if (consequential && !confirmed(args)) {
        throw new ConfirmationRequiredError(
          `Order for ${before.customer_name} (${before.quantity} × ${before.size ?? "unspecified size"}, status ${before.status}) would change to ${JSON.stringify(
            {
              status: input.status ?? before.status,
              quantity: input.quantity ?? before.quantity,
              price_each: input.price_each ?? before.price_each,
            },
          )}. Ask the user to confirm.`,
        );
      }

      const patch: Record<string, unknown> = {
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      };
      if (input.status !== undefined) {
        patch["status"] = input.status;
        if (input.status === "received" && !before.received_at)
          patch["received_at"] = new Date().toISOString();
      }
      if (input.quantity !== undefined) patch["quantity"] = input.quantity;
      if (input.price_each !== undefined) patch["price_each"] = input.price_each;
      if (input.vendor !== undefined) patch["vendor"] = input.vendor;
      if (input.size !== undefined) patch["size"] = input.size;
      if (input.notes !== undefined) patch["notes"] = input.notes;

      const { data: after, error } = await ctx.supabase
        .from("tire_orders")
        .update(patch)
        .eq("id", input.order_id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        data: { updated: true, order: after },
        targetTable: "tire_orders",
        targetId: input.order_id,
        before,
        after,
      };
    },
  },
  {
    name: "add_job_note",
    sourceLabel: "Job board notes",
    description:
      "Adds or replaces the in-app note and local status on a job or appointment from the board. These stay in this app and are never written back to TireShop.",
    permission: "edit_records",
    mutating: true,
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The id from list_board_jobs." },
        local_status: { type: "string", description: "e.g. Waiting on parts" },
        local_note: { type: "string" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          job_id: z.string().uuid(),
          local_status: z.string().max(60).nullable().optional(),
          local_note: z.string().max(500).nullable().optional(),
        })
        .parse(args);

      const { data: before, error: readError } = await ctx.supabase
        .from("shop_jobs")
        .select("id, customer_name, local_status, local_note")
        .eq("id", input.job_id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!before) throw new Error("That job is not on the current board.");

      const patch = {
        local_status: input.local_status !== undefined ? input.local_status : before.local_status,
        local_note: input.local_note !== undefined ? input.local_note : before.local_note,
        local_updated_by: ctx.userId,
        local_updated_at: new Date().toISOString(),
      };
      const { data: after, error } = await ctx.supabase
        .from("shop_jobs")
        .update(patch)
        .eq("id", input.job_id)
        .select("id, local_status, local_note")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        data: { updated: true, job: after },
        targetTable: "shop_jobs",
        targetId: input.job_id,
        before,
        after,
      };
    },
  },
  {
    name: "send_staff_announcement",
    sourceLabel: "Announcements",
    description:
      "Publishes an in-app announcement to staff and/or the shop TV. This is seen by other people, so it always needs the user's confirmation of the exact wording.",
    permission: "manage_notifications",
    mutating: true,
    requiresConfirmation: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        message: { type: "string" },
        priority: { type: "string", enum: ["normal", "high"] },
        audience: {
          type: "string",
          enum: ["all", "display", "all_display"],
          description: "all = staff, display = TV only, all_display = both.",
        },
        ...confirmProp,
      },
      required: ["title", "message"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          title: z.string().min(2).max(120),
          message: z.string().min(2).max(2000),
          priority: z.enum(["normal", "high"]).default("normal"),
          audience: z.enum(["all", "display", "all_display"]).default("all"),
        })
        .parse(args);

      const { data: created, error } = await ctx.supabase
        .from("notifications")
        .insert({
          shop_id: ctx.shopId,
          title: input.title,
          message: input.message,
          priority: input.priority,
          audience: input.audience,
          channels: ["in_app"],
          created_by: ctx.userId,
          published_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!created?.id) throw new Error("The announcement was not saved, so nothing was sent.");

      const rows: Record<string, unknown>[] = [];
      if (input.audience === "all" || input.audience === "all_display") {
        const { data: members } = await ctx.supabase
          .from("shop_members")
          .select("user_id")
          .eq("shop_id", ctx.shopId)
          .eq("status", "approved");
        for (const member of (members ?? []) as { user_id: string }[]) {
          rows.push({
            notification_id: created.id,
            shop_id: ctx.shopId,
            target: "user",
            user_id: member.user_id,
          });
        }
      }
      if (input.audience === "display" || input.audience === "all_display") {
        rows.push({
          notification_id: created.id,
          shop_id: ctx.shopId,
          target: "display",
          user_id: null,
        });
      }
      if (rows.length > 0) {
        const { error: recipientError } = await ctx.supabase
          .from("notification_recipients")
          .insert(rows);
        if (recipientError)
          throw new Error(`Saved, but recipients failed: ${recipientError.message}`);
      }

      return {
        data: { sent: true, recipients: rows.length, ...input },
        targetTable: "notifications",
        targetId: String(created.id),
        before: null,
        after: { ...input, recipients: rows.length },
      };
    },
  },
];
