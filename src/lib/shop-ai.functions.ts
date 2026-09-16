import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SHOP_AI_HISTORY_LIMIT } from "@/lib/ai/model-config";

type Supa = { from: (table: string) => any };

/** Conversation key stored on each saved row's `sources` payload. */
const SHOP_AI_THREAD = "shop-ai";

async function requireShopId(sb: Supa, userId: string) {
  const { data: member } = await sb
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!member?.shop_id) throw new Error("You do not have access to a shop yet.");
  return member.shop_id as string;
}

interface StoredMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  sources: { thread?: string; tools?: { name: string; sourceLabel: string; ok: boolean }[] } | null;
}

async function loadThread(sb: Supa, userId: string) {
  const { data, error } = await sb
    .from("assistant_messages")
    .select("id, role, content, created_at, sources")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(SHOP_AI_HISTORY_LIMIT * 2);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as StoredMessage[])
    .filter((row) => row.sources?.thread === SHOP_AI_THREAD)
    .reverse();
  return rows.slice(-SHOP_AI_HISTORY_LIMIT);
}

/** Full Shop AI conversation for the signed-in staff member. */
export const listShopAiMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rows = await loadThread(context.supabase as unknown as Supa, context.userId);
    return rows.map((row) => ({
      id: row.id,
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.content,
      createdAt: row.created_at,
      tools: row.sources?.tools ?? [],
    }));
  });

/** Sends one Shop AI turn and persists both messages. */
export const sendShopAiMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ message: z.string().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const userId = context.userId;
    const shopId = await requireShopId(sb, userId);

    const { AiUnavailableError } = await import("@/lib/ai.server");
    const { runShopAiTurn } = await import("@/lib/ai/shop-ai.server");

    const history = (await loadThread(sb, userId)).map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.content,
    }));

    const { error: userInsertError } = await sb.from("assistant_messages").insert({
      shop_id: shopId,
      user_id: userId,
      role: "user",
      content: data.message,
      sources: { thread: SHOP_AI_THREAD },
    });
    if (userInsertError) throw new Error(`Your message could not be saved: ${userInsertError.message}`);

    try {
      const result = await runShopAiTurn({
        history,
        question: data.message,
        toolContext: { supabase: context.supabase, shopId, userId },
      });

      const reply =
        result.reply.length > 0 ? result.reply : "Shop AI did not return an answer for that. Try rephrasing it.";

      const { error: replyError } = await sb.from("assistant_messages").insert({
        shop_id: shopId,
        user_id: userId,
        role: "assistant",
        content: reply,
        sources: { thread: SHOP_AI_THREAD, model: result.model, tools: result.toolActivity },
      });
      if (replyError) throw new Error(`The answer could not be saved: ${replyError.message}`);

      return { ok: true as const, reply, tools: result.toolActivity };
    } catch (err) {
      return {
        ok: false as const,
        reply:
          err instanceof AiUnavailableError || err instanceof Error
            ? err.message
            : "Shop AI is unavailable right now.",
        tools: [],
      };
    }
  });

/** Starts a fresh conversation by removing this user's Shop AI thread. */
export const clearShopAiConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const rows = await loadThread(sb, context.userId);
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      const { error } = await sb.from("assistant_messages").delete().in("id", ids);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const, removed: ids.length };
  });
