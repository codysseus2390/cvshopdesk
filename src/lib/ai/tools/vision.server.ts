/**
 * Vision-to-action pipeline (server-only).
 *
 * Shop AI reads an attached or pasted image, then calls `propose_detected_changes`
 * with the structured fields it read and the app action it intends to use. Nothing
 * is written at that point: the proposal is recorded in the AI action log, shown
 * to the user as a "Detected information" card, and only applied after the user
 * confirms. The same pipeline works for any future tool — the proposal simply
 * names the tool it will call.
 */
import { z } from "zod";
import type { ShopAiTool } from "../tools.server";

const CONFIDENCE = ["clear", "uncertain", "unreadable"] as const;

const fieldSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().max(200).nullable().optional(),
  confidence: z.enum(CONFIDENCE).default("clear"),
  note: z.string().max(200).optional(),
});

const recordSchema = z.object({
  label: z.string().max(120).optional(),
  tool: z.string().min(1).max(80),
  fields: z.array(fieldSchema).min(1).max(40),
});

export interface DetectedProposal {
  id: string;
  title: string;
  source: "image" | "document" | "text";
  question: string | null;
  warnings: string[];
  records: {
    label: string | null;
    tool: string;
    fields: { label: string; value: string | null; confidence: (typeof CONFIDENCE)[number]; note: string | null }[];
  }[];
}

export const VISION_TOOLS: ShopAiTool[] = [
  {
    name: "propose_detected_changes",
    sourceLabel: "Detected from image",
    description:
      "Use this whenever information read from an attached image, screenshot or document is about to be written into the app. Pass every field you read, the app tool that will save it, and mark anything you could not read clearly. This writes nothing: it shows the user a 'Detected information' card with Confirm / Edit / Cancel. Wait for the user's answer, then call the real action tools with confirmed=true. Never write image-derived data without proposing it first, and never fill in a value you could not actually read.",
    mutating: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short heading, e.g. 'Detected from daily report screenshot'." },
        source: { type: "string", enum: ["image", "document", "text"] },
        question: {
          type: "string",
          description: "Ask here when an important value is ambiguous. Do not guess it in the fields.",
        },
        warnings: {
          type: "array",
          items: { type: "string" },
          description: "Anything cropped, cut off, unreadable or possibly a different report scope.",
        },
        records: {
          type: "array",
          description: "One entry per record that will be created or updated.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "e.g. 'Daily numbers 2026-09-16' or 'Technician: Josh'." },
              tool: { type: "string", description: "The action tool that will save this record." },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string", description: "Exactly as read. Leave empty when unreadable." },
                    confidence: { type: "string", enum: [...CONFIDENCE] },
                    note: { type: "string" },
                  },
                  required: ["label"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tool", "fields"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "records"],
      additionalProperties: false,
    },
    execute: async (ctx, args) => {
      const input = z
        .object({
          title: z.string().min(2).max(160),
          source: z.enum(["image", "document", "text"]).default(ctx.sourceType === "image" ? "image" : "text"),
          question: z.string().max(400).optional(),
          warnings: z.array(z.string().max(300)).max(10).default([]),
          records: z.array(recordSchema).min(1).max(25),
        })
        .parse(args);

      const proposal: DetectedProposal = {
        id: crypto.randomUUID(),
        title: input.title,
        source: input.source,
        question: input.question ?? null,
        warnings: input.warnings,
        records: input.records.map((record) => ({
          label: record.label ?? null,
          tool: record.tool,
          fields: record.fields.map((field) => ({
            label: field.label,
            value: field.value && field.value.trim().length > 0 ? field.value.trim() : null,
            confidence: field.value && field.value.trim().length > 0 ? field.confidence : "unreadable",
            note: field.note ?? null,
          })),
        })),
      };

      // The proposal itself is part of the audit trail, before anything is written.
      await ctx.supabase.from("ai_actions").insert({
        shop_id: ctx.shopId,
        user_id: ctx.userId,
        tool: "propose_detected_changes",
        status: "confirmation_requested",
        confirmation_required: true,
        confirmed: false,
        source_type: ctx.sourceType,
        proposal,
        args,
      });

      const unreadable = proposal.records.flatMap((record) =>
        record.fields.filter((field) => field.confidence !== "clear").map((field) => field.label),
      );

      return {
        data: {
          proposed: true,
          proposal_id: proposal.id,
          unclear_fields: unreadable,
          next_step:
            "The Detected information card is now shown to the user with Confirm / Edit / Cancel. Summarise it in one or two lines, ask about anything unclear, and wait. Only after the user confirms, call the action tools with confirmed=true using the values shown (or the user's corrections).",
        },
        proposal,
      };
    },
  },
];
