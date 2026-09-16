import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SHOP_AI_HISTORY_LIMIT, SHOP_AI_MAX_MESSAGE_CHARS } from "@/lib/ai/model-config";
import { resolvePermissions, type AppRole, type PermissionKey } from "@/lib/permissions";
import { shopToday } from "@/lib/metrics-math";

type Supa = { from: (table: string) => any; storage: any; rpc: (fn: string, args?: unknown) => any };

/** Detected-information card shape, mirrored from the server-only vision tool. */
export interface DetectedProposalView {
  id: string;
  title: string;
  source: "image" | "document" | "text";
  question: string | null;
  warnings: string[];
  records: {
    label: string | null;
    tool: string;
    fields: { label: string; value: string | null; confidence: "clear" | "uncertain" | "unreadable"; note: string | null }[];
  }[];
}

/** Conversation key stored on each saved row's `sources` payload. */
const SHOP_AI_THREAD = "shop-ai";

import { SHOP_AI_ACCEPTED_TYPES, SHOP_AI_MAX_FILE_BYTES, SHOP_AI_MAX_FILES } from "@/lib/shop-ai.limits";

export { SHOP_AI_ACCEPTED_TYPES, SHOP_AI_MAX_FILE_BYTES, SHOP_AI_MAX_FILES };
/** How many past attachments are replayed so follow-up questions still see them. */
const REPLAY_ATTACHMENTS = 2;

interface StoredAttachment {
  name: string;
  mimeType: string;
  path: string;
}

async function requireMembership(sb: Supa, userId: string) {
  const { data: member } = await sb
    .from("shop_members")
    .select("shop_id, role, shops(timezone)")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!member?.shop_id) throw new Error("You do not have access to a shop yet.");
  const timezone = (member.shops?.timezone as string | undefined) ?? "America/Chicago";
  const { data: overrides } = await sb
    .from("role_permissions")
    .select("role, permission, allowed")
    .eq("shop_id", member.shop_id);
  const permissions = resolvePermissions(member.role as AppRole, (overrides ?? []) as never);
  return {
    shopId: member.shop_id as string,
    role: member.role as string,
    timezone,
    today: shopToday(timezone),
    can: (permission: PermissionKey) => permissions[permission] === true,
  };
}

interface StoredMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  user_id: string;
  sources: {
    thread?: string;
    tools?: { name: string; sourceLabel: string; ok: boolean; changed?: boolean }[];
    proposals?: unknown[];
    attachments?: StoredAttachment[];
  } | null;
}

/** The Hank thread is shared: every approved member of the shop sees it. */
async function loadThread(sb: Supa, shopId: string) {
  const { data, error } = await sb
    .from("assistant_messages")
    .select("id, role, content, created_at, sources, user_id")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(SHOP_AI_HISTORY_LIMIT * 2);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as StoredMessage[])
    .filter((row) => row.sources?.thread === SHOP_AI_THREAD)
    .reverse();
  return rows.slice(-SHOP_AI_HISTORY_LIMIT);
}

/** The shop's shared Hank conversation, visible to every approved member. */
export const listShopAiMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const membership = await requireMembership(sb, context.userId);
    const rows = await loadThread(sb, membership.shopId);

    // Label each staff message with who asked it.
    const { data: members } = await sb
      .from("shop_members")
      .select("user_id, email")
      .eq("shop_id", membership.shopId);
    const names = new Map<string, string>(
      ((members ?? []) as { user_id: string; email: string | null }[]).map((m) => [m.user_id, m.email ?? "Staff"]),
    );

    const mapped = rows.map((row) => ({
      id: row.id,
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.content,
      createdAt: row.created_at,
      authorId: row.user_id,
      authorName: names.get(row.user_id) ?? "Staff",
      isMine: row.user_id === context.userId,
      tools: row.sources?.tools ?? [],
      proposals: (row.sources?.proposals ?? []) as DetectedProposalView[],
      attachments: (row.sources?.attachments ?? []).map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        path: file.path,
        url: null as string | null,
      })),
    }));

    // Images Hank created (or the user attached) are private: hand the browser a
    // short-lived signed link so it can show them inline.
    for (const message of mapped) {
      for (const file of message.attachments) {
        if (!file.mimeType.startsWith("image/")) continue;
        const { data: signed } = await sb.storage.from("shop-uploads").createSignedUrl(file.path, 60 * 60);
        file.url = (signed?.signedUrl as string | undefined) ?? null;
      }
    }
    return mapped;
  });

const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.enum(SHOP_AI_ACCEPTED_TYPES),
  dataUrl: z
    .string()
    .startsWith("data:")
    .max(Math.ceil(SHOP_AI_MAX_FILE_BYTES * 1.4)),
});

function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = new Uint8Array(
    atob(base64)
      .split("")
      .map((char) => char.charCodeAt(0)),
  );
  return bytes;
}

/** Sends one Shop AI turn, with any attachments, and persists both messages. */
export const sendShopAiMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        message: z
          .string()
          .max(SHOP_AI_MAX_MESSAGE_CHARS, {
            message: `That message is longer than ${SHOP_AI_MAX_MESSAGE_CHARS.toLocaleString()} characters. Shorten it or send it in two parts — nothing was sent.`,
          })
          .default(""),
        attachments: z.array(attachmentSchema).max(SHOP_AI_MAX_FILES).default([]),
      })
      .refine((v) => v.message.trim().length > 0 || v.attachments.length > 0, "Add a message or an attachment.")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const userId = context.userId;
    const membership = await requireMembership(sb, userId);

    const { AiUnavailableError } = await import("@/lib/ai.server");
    const { runShopAiTurn } = await import("@/lib/ai/shop-ai.server");
    const { loadAssistantSettings } = await import("@/lib/ai-settings.functions");
    const settings = await loadAssistantSettings(context.supabase, membership.shopId);
    if (!settings.visionEnabled && data.attachments.length > 0) {
      throw new Error("Image and file analysis is turned off in Hank Settings. Turn it back on to send attachments.");
    }

    // Keep the original file in private storage so follow-up questions can see it.
    const stored: StoredAttachment[] = [];
    for (const file of data.attachments) {
      const bytes = dataUrlBytes(file.dataUrl);
      if (bytes.byteLength > SHOP_AI_MAX_FILE_BYTES) {
        throw new Error(`${file.name} is larger than 8 MB. Attach a smaller image.`);
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const path = `${membership.shopId}/shop-ai/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await sb.storage
        .from("shop-uploads")
        .upload(path, bytes, { contentType: file.mimeType, upsert: false });
      if (uploadError) throw new Error(`${file.name} could not be saved: ${uploadError.message}`);
      stored.push({ name: file.name, mimeType: file.mimeType, path });
    }

    const rows = await loadThread(sb, membership.shopId);
    const replayPaths = new Set(
      rows
        .flatMap((row) => row.sources?.attachments ?? [])
        .slice(-REPLAY_ATTACHMENTS)
        .map((file) => file.path),
    );

    const history = [];
    for (const row of rows) {
      const role = row.role === "assistant" ? ("assistant" as const) : ("user" as const);
      const replay = (row.sources?.attachments ?? []).filter((file) => replayPaths.has(file.path));
      const attachments = [];
      for (const file of replay) {
        const { data: blob } = await sb.storage.from("shop-uploads").download(file.path);
        if (!blob) continue;
        const buffer = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]!);
        attachments.push({ name: file.name, mimeType: file.mimeType, dataUrl: `data:${file.mimeType};base64,${btoa(binary)}` });
      }
      history.push({ role, content: row.content, attachments });
    }

    const attachmentNote =
      stored.length > 0 ? `\n\n(attached: ${stored.map((file) => file.name).join(", ")})` : "";
    const { error: userInsertError } = await sb.from("assistant_messages").insert({
      shop_id: membership.shopId,
      user_id: userId,
      role: "user",
      content: `${data.message}${attachmentNote}`.trim(),
      sources: { thread: SHOP_AI_THREAD, attachments: stored },
    });
    if (userInsertError) throw new Error(`Your message could not be saved: ${userInsertError.message}`);

    try {
      const result = await runShopAiTurn({
        history,
        question: data.message.trim().length > 0 ? data.message : "Look at the attachment and tell me what it shows.",
        attachments: data.attachments.map((file) => ({
          name: file.name,
          mimeType: file.mimeType,
          dataUrl: file.dataUrl,
        })),
        toolContext: {
          supabase: context.supabase,
          shopId: membership.shopId,
          userId,
          timezone: membership.timezone,
          today: membership.today,
          can: membership.can,
          sourceType: data.attachments.length > 0 ? ("image" as const) : ("text" as const),
        },
        settings,
      });

      const reply =
        result.reply.length > 0
          ? result.reply
          : `${settings.assistantName} did not return an answer for that. Try rephrasing it.`;

      const { error: replyError } = await sb.from("assistant_messages").insert({
        shop_id: membership.shopId,
        user_id: userId,
        role: "assistant",
        content: reply,
        sources: {
          thread: SHOP_AI_THREAD,
          model: result.model,
          tools: result.toolActivity,
          proposals: result.proposals,
          attachments: result.images,
        },
      });
      if (replyError) throw new Error(`The answer could not be saved: ${replyError.message}`);

      return {
        ok: true as const,
        reply,
        tools: result.toolActivity,
        dataChanged: result.dataChanged,
        proposals: result.proposals as DetectedProposalView[],
      };
    } catch (err) {
      return {
        ok: false as const,
        reply:
          err instanceof AiUnavailableError || err instanceof Error
            ? err.message
            : `${settings.assistantName} is unavailable right now.`,
        tools: [],
        dataChanged: false,
        proposals: [] as DetectedProposalView[],
      };
    }
  });

/** Recent AI-initiated changes, for the activity log. */
export const listAiActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const { data, error } = await sb
      .from("ai_actions")
      .select("id, tool, status, confirmation_required, confirmed, target_table, target_id, error, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      tool: string;
      status: string;
      confirmation_required: boolean;
      confirmed: boolean;
      target_table: string | null;
      target_id: string | null;
      error: string | null;
      created_at: string;
    }[];
  });

/** Starts a fresh conversation by clearing the shop's shared Hank thread. */
export const clearShopAiConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const membership = await requireMembership(sb, context.userId);
    const rows = await loadThread(sb, membership.shopId);
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      const { error } = await sb.from("assistant_messages").delete().in("id", ids);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const, removed: ids.length };
  });
