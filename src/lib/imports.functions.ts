import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Supa = { from: (t: string) => any; rpc: (f: string, a?: unknown) => any; storage: any };

async function resolveShopId(supabase: Supa, userId: string) {
  const { data } = await supabase
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!data?.shop_id) throw new Error("You do not have access to a shop yet.");
  return data.shop_id as string;
}

export const registerImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        file_name: z.string().min(1),
        storage_path: z.string().min(1),
        mime_type: z.string().min(1),
        file_hash: z.string().min(16),
        file_size: z.number().int().nonnegative(),
        report_scope: z.enum(["daily", "mtd", "ytd", "invoice", "inventory", "jobs", "other"]),
        period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const shopId = await resolveShopId(supabase as unknown as Supa, userId);

    const { data: row, error } = await supabase
      .from("imports")
      .insert({
        shop_id: shopId,
        uploaded_by: userId,
        file_name: data.file_name,
        storage_path: data.storage_path,
        mime_type: data.mime_type,
        file_hash: data.file_hash,
        file_size: data.file_size,
        report_scope: data.report_scope,
        period_start: data.period_start,
        period_end: data.period_end,
        captured_at: data.period_end ? `${data.period_end}T12:00:00Z` : null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        const { data: existing } = await supabase
          .from("imports")
          .select("id, file_name, uploaded_at, status")
          .eq("shop_id", shopId)
          .eq("file_hash", data.file_hash)
          .maybeSingle();
        return { duplicate: true as const, existing: existing ?? null };
      }
      throw new Error(error.message);
    }
    return { duplicate: false as const, importId: row.id as string };
  });

export const listImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("imports")
      .select(
        "id, file_name, storage_path, mime_type, report_scope, period_start, period_end, status, extraction, extraction_notes, error_message, uploaded_at, reviewed_at, file_size",
      )
      .order("uploaded_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getImportFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ importId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: imp, error } = await supabase
      .from("imports")
      .select("storage_path")
      .eq("id", data.importId)
      .single();
    if (error) throw new Error(error.message);
    const { data: signed, error: signError } = await supabase.storage
      .from("shop-uploads")
      .createSignedUrl(imp.storage_path, 300);
    if (signError) throw new Error(signError.message);
    return { url: signed.signedUrl as string };
  });

interface ExtractionResult {
  report_scope?: string;
  period_start?: string | null;
  period_end?: string | null;
  rows?: {
    business_date?: string | null;
    scope?: string | null;
    gross_profit?: number | null;
    tires_sold?: number | null;
    car_count?: number | null;
    confidence?: string | null;
  }[];
  unreadable?: string[];
  notes?: string | null;
}

export const extractImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ importId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { AiUnavailableError, UNTRUSTED_NOTICE, callGateway, parseJsonReply } = await import("./ai.server");

    const { data: imp, error } = await supabase
      .from("imports")
      .select("id, file_name, storage_path, mime_type, report_scope, period_start, period_end")
      .eq("id", data.importId)
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("imports").update({ status: "extracting", error_message: null }).eq("id", imp.id);

    try {
      const { data: file, error: dlError } = await supabase.storage
        .from("shop-uploads")
        .download(imp.storage_path);
      if (dlError || !file) throw new Error(dlError?.message ?? "The uploaded file could not be read.");

      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const base64 = btoa(binary);
      const mime = imp.mime_type || "image/png";

      const block =
        mime === "application/pdf"
          ? { type: "file" as const, file: { filename: imp.file_name, file_data: `data:${mime};base64,${base64}` } }
          : { type: "image_url" as const, image_url: { url: `data:${mime};base64,${base64}` } };

      const reply = await callGateway([
        {
          role: "system",
          content: `You read auto-shop reports and return JSON only. ${UNTRUSTED_NOTICE}
Return exactly this shape:
{"report_scope":"daily|mtd|ytd|invoice|inventory|jobs|other","period_start":"YYYY-MM-DD|null","period_end":"YYYY-MM-DD|null","rows":[{"business_date":"YYYY-MM-DD|null","scope":"daily|mtd|ytd","gross_profit":number|null,"tires_sold":number|null,"car_count":number|null,"confidence":"high|medium|low"}],"unreadable":["short description of anything cut off, blurry or ambiguous"],"notes":"one short sentence"}
Rules: never guess a number you cannot read - use null and add an entry to unreadable. Never total hidden or cropped rows. Never assume invoice count equals car count or that sales equals gross profit; if the report only shows sales, leave gross_profit null and say so in notes. If the report is cumulative (month-to-date/year-to-date), use scope mtd or ytd and do not invent daily values.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `<document filename="${imp.file_name}" staff_declared_scope="${imp.report_scope}" staff_declared_period="${imp.period_start ?? "?"}..${imp.period_end ?? "?"}">Read this report and return the JSON.</document>`,
            },
            block,
          ],
        },
      ]);

      const parsed = parseJsonReply<ExtractionResult>(reply);
      if (!parsed) {
        await supabase
          .from("imports")
          .update({ status: "failed", error_message: "Nothing readable was returned for this file." })
          .eq("id", imp.id);
        return { ok: false as const, message: "Nothing readable was returned for this file. You can enter the numbers by hand." };
      }

      await supabase
        .from("imports")
        .update({
          status: "extracted",
          extraction: parsed as never,
          extraction_notes: parsed.notes ?? null,
        })
        .eq("id", imp.id);

      return { ok: true as const, extraction: parsed };
    } catch (err) {
      const message =
        err instanceof AiUnavailableError ? err.message : err instanceof Error ? err.message : "Extraction failed.";
      await supabase.from("imports").update({ status: "failed", error_message: message }).eq("id", imp.id);
      return { ok: false as const, message };
    }
  });

export const acceptImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        importId: z.string().uuid(),
        rows: z
          .array(
            z.object({
              business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              scope: z.enum(["daily", "mtd", "ytd"]),
              gross_profit: z.number().nullable(),
              tires_sold: z.number().int().nullable(),
              car_count: z.number().int().nullable(),
              flags: z.array(z.string()).default([]),
            }),
          )
          .min(1),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const sb = supabase as unknown as Supa;
    const { data: saved, error } = await sb.rpc("accept_import_metrics", {
      p_import_id: data.importId,
      p_rows: data.rows,
      p_note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { savedRows: saved as number };
  });

export const rejectImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ importId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("imports")
      .update({
        status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        error_message: data.reason ?? null,
      })
      .eq("id", data.importId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
