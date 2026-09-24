import { z } from "zod";
import { readAutoflow } from "./autoflow.server";
import type { WorkflowRow } from "./autoflow-workflow";
import { workflowStatus } from "./tv-board";

const reference = z.union([z.string(), z.number()]).transform(String);
const responseSchema = z.object({
  success: z.literal(1),
  content: z.object({
    invoice: reference,
    remote_ticket_id: reference.nullish(),
    reason_vehicle_is_here: z.array(z.object({ details: z.string().nullish() })).nullish(),
  }),
});

/** Decode provider-escaped text, which React still renders as text, never HTML. */
function plainText(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (original, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? original;
      const code =
        entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : original;
    })
    .trim();
}

export function parseVisitDescription(payload: unknown, ro: string, remoteId?: string | null) {
  const { content } = responseSchema.parse(payload);
  if (content.invoice !== ro || (remoteId && content.remote_ticket_id !== remoteId))
    throw new Error("Autoflow visit description does not match this repair order.");
  const descriptions = (content.reason_vehicle_is_here ?? [])
    .map((item) => plainText(item.details ?? ""))
    .filter(Boolean);
  return [...new Set(descriptions)].join(" · ") || null;
}

/** Small server-only cache coalesces TV/board refreshes; no customer details are logged. */
export function createDescriptionLoader(read = readAutoflow, now = Date.now) {
  const cache = new Map<string, { expires: number; value: Promise<string | null | undefined> }>();
  return async (rows: WorkflowRow[], shopId: string, env: Record<string, string | undefined>) => {
    const result = rows.map((row) => ({ ...row }));
    let next = 0;
    const worker = async () => {
      while (next < result.length) {
        const row = result[next++]!;
        const ro = row.repair_order_number;
        if (!ro || ro === "0" || workflowStatus(row) === "done") continue;
        const key = JSON.stringify([shopId, env["AUTOFLOW_SUBDOMAIN"], ro, row.remote_ticket_id]);
        let entry = cache.get(key);
        if (!entry || entry.expires <= now()) {
          if (cache.size >= 256) cache.delete(cache.keys().next().value!);
          entry = {
            expires: now() + 60_000,
            value: read({ resource: "dvi", roNumber: ro }, env)
              .then((payload) => parseVisitDescription(payload, ro, row.remote_ticket_id))
              .catch(() => undefined),
          };
          cache.set(key, entry);
        }
        const description = await entry.value;
        // A failed details request must not erase known text or hide the live workflow.
        if (description !== undefined) row.requested_service = description;
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, result.length) }, worker));
    return result;
  };
}

export const loadAutoflowDescriptions = createDescriptionLoader();
