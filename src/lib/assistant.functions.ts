import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Supa = { from: (t: string) => any };

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z
          .string()
          .trim()
          .min(2, { message: "Please type a question first." })
          .max(8000, { message: "That message is too long — please shorten it." }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { AiUnavailableError, UNTRUSTED_NOTICE, callGateway } = await import("./ai.server");
    const sb = supabase as unknown as Supa;

    const { data: member } = await sb
      .from("shop_members")
      .select("shop_id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();
    if (!member?.shop_id) throw new Error("You do not have access to a shop yet.");
    const shopId = member.shop_id as string;

    const [{ data: confirmed }, { data: imports }, { data: corrections }] = await Promise.all([
      sb
        .from("metric_snapshots")
        .select("business_date, scope, gross_profit, tires_sold, car_count, source, note, flags, created_at")
        .eq("is_current", true)
        .order("business_date", { ascending: false })
        .limit(120),
      sb
        .from("imports")
        .select("file_name, report_scope, period_start, period_end, status, uploaded_at, extraction_notes")
        .order("uploaded_at", { ascending: false })
        .limit(30),
      sb
        .from("metric_corrections")
        .select("business_date, scope, field, previous_value, new_value, corrected_at")
        .order("corrected_at", { ascending: false })
        .limit(30),
    ]);

    const unreviewed = (imports ?? []).filter((i: { status: string }) => i.status === "extracted");

    await sb.from("assistant_messages").insert({
      shop_id: shopId,
      user_id: userId,
      role: "user",
      content: data.question,
    });

    try {
      const reply = await callGateway([
        {
          role: "system",
          content: `You are the Cedar Valley Hub assistant for shop staff. ${UNTRUSTED_NOTICE}
Answer only from the shop records provided in this request. If the records do not contain the answer, say plainly that the app has no confirmed record for it and suggest the entry or import that would supply it. Never estimate, never fill gaps.
Always name the supporting business dates, and the upload file name when the value came from an import.
Confirmed records are the accepted snapshots; extractions still awaiting review are NOT official - if you mention them, label them as awaiting review.
Gross profit per car = gross profit total / car count for the same period. Never average daily ratios. Never add cumulative (mtd/ytd) figures to daily figures. Missing means "not updated", not zero.
Keep answers under 120 words, plain language, no markdown tables.`,
        },
        {
          role: "user",
          content: `<shop_records>
CONFIRMED_SNAPSHOTS: ${JSON.stringify(confirmed ?? [])}
CORRECTION_HISTORY: ${JSON.stringify(corrections ?? [])}
UPLOADS: ${JSON.stringify(imports ?? [])}
AWAITING_REVIEW: ${JSON.stringify(unreviewed)}
</shop_records>

Staff question: ${data.question}`,
        },
      ]);

      await sb.from("assistant_messages").insert({
        shop_id: shopId,
        user_id: userId,
        role: "assistant",
        content: reply,
        sources: { confirmed_rows: (confirmed ?? []).length, uploads: (imports ?? []).length },
      });

      return { ok: true as const, reply };
    } catch (err) {
      const message =
        err instanceof AiUnavailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : "The assistant is unavailable right now.";
      return { ok: false as const, reply: message };
    }
  });

export const listAssistantHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("assistant_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
