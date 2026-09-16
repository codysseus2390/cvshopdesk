/**
 * Central Shop AI model configuration.
 * Change models or add routing here — no chat/UI code needs to change.
 */
export const SHOP_AI_MODELS = {
  /** Fast, inexpensive default for everyday shop chat. */
  fast: "gpt-5.6-luna",
} as const;

export type ShopAiModelKey = keyof typeof SHOP_AI_MODELS;

export const SHOP_AI_DEFAULT_MODEL_KEY: ShopAiModelKey = "fast";

/**
 * Resolves which model handles a turn. Future automatic routing (long context,
 * heavy analysis, tool-heavy turns) plugs in here.
 */
export function resolveShopAiModel(_input?: { question?: string }): string {
  return SHOP_AI_MODELS[SHOP_AI_DEFAULT_MODEL_KEY];
}

/** Hard cap on tool-call rounds per turn, so a bad loop cannot run away. */
export const SHOP_AI_MAX_TOOL_ROUNDS = 4;

/** How many stored messages are replayed as conversation history. */
export const SHOP_AI_HISTORY_LIMIT = 40;
