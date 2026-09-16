/**
 * Shop AI tool registry (server-only).
 *
 * The model never touches the database directly and never writes SQL. It can
 * only call the functions registered here. Every tool:
 *  - runs on the authenticated Supabase client of the signed-in staff member,
 *    so row level security and shop membership still apply,
 *  - validates its arguments with a schema before touching data,
 *  - declares the app permission it needs, checked server-side,
 *  - declares whether it changes data and whether a change is consequential
 *    enough to need the user's explicit confirmation first.
 *
 * Future sources (AutoFlow, TireShop, Google Workspace) are added the same way.
 */
import type { PermissionKey } from "@/lib/permissions";
import { SHOP_DATA_TOOLS } from "./tools/shop-data.server";
import { SHOP_ACTION_TOOLS } from "./tools/shop-actions.server";
import { VISION_TOOLS, type DetectedProposal } from "./tools/vision.server";

/**
 * Thrown by an action tool when the change turned out to be consequential
 * (an overwrite, a cancellation, a bulk edit). Nothing is written; the model is
 * told to describe the change and ask the user to confirm it first.
 */
export class ConfirmationRequiredError extends Error {}

export interface ShopAiToolContext {
  /** Authenticated Supabase client for the signed-in staff member (RLS applies). */
  supabase: any;
  shopId: string;
  userId: string;
  timezone: string;
  /** The shop's current business date (America/Chicago by default). */
  today: string;
  /** Effective permissions of the signed-in staff member. */
  can: (permission: PermissionKey) => boolean;
  /** Where this turn's information came from, recorded on every AI action. */
  sourceType: "image" | "document" | "text";
}

export interface ShopAiToolOutcome {
  /** JSON-serialisable payload handed back to the model. */
  data: unknown;
  /** Record the action touched, for the AI action log. */
  targetTable?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  /** Detected-information card the UI should show before anything is written. */
  proposal?: DetectedProposal;
}

export type { DetectedProposal };

export interface ShopAiTool {
  name: string;
  /** Short label shown in the UI while the tool runs. */
  sourceLabel: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
  /** True when the tool writes data. Read tools are the default. */
  mutating?: boolean;
  /** True when the tool must be confirmed by the user before it runs. */
  requiresConfirmation?: boolean;
  /** App permission the signed-in user must hold. */
  permission?: PermissionKey;
  execute: (ctx: ShopAiToolContext, args: Record<string, unknown>) => Promise<ShopAiToolOutcome>;
}

export const SHOP_AI_TOOLS: ShopAiTool[] = [...VISION_TOOLS, ...SHOP_DATA_TOOLS, ...SHOP_ACTION_TOOLS];

export function findShopAiTool(name: string): ShopAiTool | undefined {
  return SHOP_AI_TOOLS.find((tool) => tool.name === name);
}

export function toolSourceLabel(name: string): string {
  return findShopAiTool(name)?.sourceLabel ?? name;
}

/** Plain metadata for the Hank Settings screen. */
export function shopAiToolCatalogue() {
  return SHOP_AI_TOOLS.map((tool) => ({
    name: tool.name,
    label: tool.sourceLabel,
    description: tool.description.split(". ")[0] ?? tool.description,
    mutating: Boolean(tool.mutating),
    requiresConfirmation: Boolean(tool.requiresConfirmation),
    permission: tool.permission ?? null,
    /** Vision proposals and read tools stay on; they cannot change data. */
    canDisable: Boolean(tool.mutating),
  }));
}

/** Serialises the registry into OpenAI Responses API tool definitions. */
export function shopAiToolDefinitions(disabled: string[] = []) {
  return SHOP_AI_TOOLS.filter((tool) => !(tool.mutating && disabled.includes(tool.name))).map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.requiresConfirmation
      ? `${tool.description} Consequential: call it with confirmed=true only after the user has agreed to the exact change you described.`
      : tool.description,
    parameters: tool.parameters,
    strict: false,
  }));
}
