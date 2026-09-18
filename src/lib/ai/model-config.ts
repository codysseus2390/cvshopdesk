/**
 * Central Hank (Shop AI) model and limit configuration.
 * Change models, tiers or limits here — no chat/UI code needs to change.
 */

/** Model tiers. Only `fast` is wired up today; the rest are ready for routing. */
export const SHOP_AI_MODELS = {
  /** Fast, inexpensive default for everyday shop chat. */
  fast: "gpt-5.6-luna",
  /** Reserved for heavier reasoning once routing is configured. */
  standard: "gpt-5.6-luna",
  /** Reserved for deep analysis once routing is configured. */
  deep: "gpt-5.6-luna",
} as const;

export type ShopAiModelKey = keyof typeof SHOP_AI_MODELS;

export const SHOP_AI_MODEL_TIERS: { key: ShopAiModelKey; label: string; description: string }[] = [
  { key: "fast", label: "Fast", description: "Everyday shop chat. Lowest cost, quickest answers." },
  {
    key: "standard",
    label: "Standard",
    description: "Reserved for heavier questions. Not routed separately yet.",
  },
  {
    key: "deep",
    label: "Deep",
    description: "Reserved for long analysis. Not routed separately yet.",
  },
];

export const SHOP_AI_DEFAULT_MODEL_KEY: ShopAiModelKey = "fast";

/**
 * Resolves which model handles a turn. Future automatic routing (long context,
 * heavy analysis, tool-heavy turns) plugs in here.
 */
export function resolveShopAiModel(input?: { question?: string; tier?: string | null }): string {
  const tier = input?.tier;
  if (tier && tier in SHOP_AI_MODELS) return SHOP_AI_MODELS[tier as ShopAiModelKey];
  return SHOP_AI_MODELS[SHOP_AI_DEFAULT_MODEL_KEY];
}

/** Image creation model and size. Change here only. */
export const SHOP_AI_IMAGE_MODEL = "gpt-image-1";
export const SHOP_AI_IMAGE_SIZE = "1024x1024";

/** Hard cap on tool-call rounds per turn, so a bad loop cannot run away. */
export const SHOP_AI_MAX_TOOL_ROUNDS = 4;

/** How many stored messages are replayed as conversation history. */
export const SHOP_AI_HISTORY_LIMIT = 40;

/** Longest ordinary chat message a person can send. */
export const SHOP_AI_MAX_MESSAGE_CHARS = 25_000;
/** Where the subtle character counter starts showing. */
export const SHOP_AI_COUNTER_THRESHOLD = 20_000;
/**
 * Personality instructions are developer/system text, stored separately from
 * chat messages and deliberately given far more room.
 */
export const SHOP_AI_MAX_PERSONALITY_CHARS = 100_000;

/** Interface defaults for the assistant's identity. */
export const ASSISTANT_DEFAULTS = {
  name: "Hank",
  subtitle: "Shop Assistant",
} as const;
