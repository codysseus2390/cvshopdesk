import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { verifyAutoflowWebhookHash } from "./autoflow.server";

const id = z
  .union([z.string().trim().min(1).max(120), z.number().int().nonnegative()])
  .transform(String);
const statusEvent = z
  .object({
    event: z
      .object({ id: z.string().trim().min(1).max(256), type: z.literal("status_update") })
      .passthrough(),
    shop: z.object({ id, domain: z.string().min(1).max(253) }).passthrough(),
    ticket: z.object({ id, status: z.string().trim().min(1).max(120) }).passthrough(),
  })
  .passthrough();

export interface AutoflowInboxRecord {
  shop_id: string;
  autoflow_shop_id: string;
  event_id: string;
  event_type: "status_update";
  payload: Record<string, unknown>;
}

async function storeEvent(record: AutoflowInboxRecord): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("autoflow_webhook_events").upsert(
    // Payload originates in JSON.parse and is validated above the storage boundary.
    { ...record, payload: record.payload as Json },
    { onConflict: "shop_id,autoflow_shop_id,event_type,event_id", ignoreDuplicates: true },
  );
  if (error) throw new Error("Autoflow inbox unavailable.");
}

const response = (status: number, message: string) =>
  Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

/** Acknowledges only durable inbox storage. Does not trust event bodies for job writes. */
export async function receiveAutoflowWebhook(
  request: Request,
  env: Record<string, string | undefined> = process.env,
  save: (record: AutoflowInboxRecord) => Promise<void> = storeEvent,
): Promise<Response> {
  if (request.method !== "POST") return response(405, "Method not allowed.");
  const shopId = z.string().uuid().safeParse(env["AUTOFLOW_SHOPDESK_SHOP_ID"]);
  const providerShopId = env["AUTOFLOW_SHOP_ID"]?.trim();
  const subdomain = env["AUTOFLOW_SUBDOMAIN"];
  const key = env["AUTOFLOW_WEBHOOK_SECURITY_KEY"];
  if (
    env["AUTOFLOW_WEBHOOK_ENABLED"] !== "true" ||
    !shopId.success ||
    !providerShopId ||
    !subdomain ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) ||
    !key?.trim()
  )
    return response(503, "Webhook receiver is not configured.");

  const signature = request.headers.get("X-atme-hash");
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return response(401, "Invalid webhook.");
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  ) {
    return response(415, "JSON required.");
  }

  // Bound the actual stream, including when Content-Length is absent or incorrect.
  const maxBytes = 128 * 1024;
  if (Number(request.headers.get("content-length")) > maxBytes)
    return response(413, "Payload too large.");
  if (!request.body) return response(400, "Invalid payload.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let payload: unknown;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return response(413, "Payload too large.");
      }
      chunks.push(value);
    }
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return response(400, "Invalid payload.");
  } finally {
    reader.releaseLock();
  }
  const parsed = statusEvent.safeParse(payload);
  if (!parsed.success) return response(400, "Unsupported or invalid status event.");
  const event = parsed.data;
  if (!verifyAutoflowWebhookHash(event.event.id, signature, key))
    return response(401, "Invalid webhook.");
  if (event.shop.id !== providerShopId || event.shop.domain !== `${subdomain}.autotext.me`) {
    return response(403, "Shop mismatch.");
  }
  try {
    await save({
      shop_id: shopId.data,
      autoflow_shop_id: providerShopId,
      event_id: event.event.id,
      event_type: event.event.type,
      payload: event,
    });
  } catch {
    return response(503, "Webhook storage unavailable. Retry later.");
  }
  return response(200, "Received.");
}
