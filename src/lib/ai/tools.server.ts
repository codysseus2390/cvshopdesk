/**
 * Shop AI tool registry (server-only).
 *
 * Every future shop data source — AutoFlow, TireShop, the tire-order database,
 * technician productivity, Google Workspace — is added here as a READ-ONLY tool.
 * The model never touches the database directly; it can only call functions
 * registered in this file, which run under the signed-in staff member's own
 * authenticated client (so RLS still applies).
 *
 * Rules for anything added here:
 *  - read-only: no insert, update, delete or external write calls
 *  - scoped to ctx.shopId and the caller's membership
 *  - returns plain JSON-serialisable data, never raw credentials
 */

export interface ShopAiToolContext {
  /** Authenticated Supabase client for the signed-in staff member (RLS applies). */
  supabase: unknown;
  shopId: string;
  userId: string;
}

export interface ShopAiTool {
  /** Function name exposed to the model. */
  name: string;
  /** Short label shown in the UI while the tool runs, e.g. "AutoFlow appointments". */
  sourceLabel: string;
  description: string;
  /** JSON Schema for the arguments. Keep every property required and strict-compatible. */
  parameters: Record<string, unknown>;
  /** Read-only execution. Throw to report an unavailable source. */
  execute: (ctx: ShopAiToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * No shop data tools are connected yet. Shop AI answers general automotive and
 * shop-operations questions and says plainly when it cannot reach shop data.
 */
export const SHOP_AI_TOOLS: ShopAiTool[] = [];

export function findShopAiTool(name: string): ShopAiTool | undefined {
  return SHOP_AI_TOOLS.find((tool) => tool.name === name);
}

export function toolSourceLabel(name: string): string {
  return findShopAiTool(name)?.sourceLabel ?? name;
}

/** Serialises the registry into OpenAI Responses API tool definitions. */
export function shopAiToolDefinitions() {
  return SHOP_AI_TOOLS.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false,
  }));
}
