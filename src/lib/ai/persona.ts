/**
 * Hank's saved configuration shape. Client-safe: no server-only imports, so
 * both the Hank Settings screen and the server-side AI service can use it.
 *
 * The personality text is developer/system instruction text. It is stored and
 * validated separately from ordinary chat messages and has its own, much
 * larger, size limit.
 */
import { ASSISTANT_DEFAULTS, SHOP_AI_DEFAULT_MODEL_KEY } from "./model-config";

export interface AssistantSettings {
  assistantName: string;
  subtitle: string;
  avatarUrl: string | null;
  personality: string;
  casualLanguage: boolean;
  humor: boolean;
  mildProfanity: boolean;
  shopBanter: boolean;
  customerFacingProfessional: boolean;
  modelTier: string;
  disabledTools: string[];
  visionEnabled: boolean;
  updatedAt: string | null;
}

export const ASSISTANT_SETTINGS_DEFAULTS: AssistantSettings = {
  assistantName: ASSISTANT_DEFAULTS.name,
  subtitle: ASSISTANT_DEFAULTS.subtitle,
  avatarUrl: null,
  personality: "",
  casualLanguage: true,
  humor: true,
  mildProfanity: false,
  shopBanter: false,
  customerFacingProfessional: true,
  modelTier: SHOP_AI_DEFAULT_MODEL_KEY,
  disabledTools: [],
  visionEnabled: true,
  updatedAt: null,
};

/**
 * Turns the saved behaviour toggles and personality text into extra
 * developer instructions. Never shown in chat.
 */
export function personaInstructions(settings: AssistantSettings): string {
  const lines: string[] = [];
  lines.push(
    `Your name is ${settings.assistantName || ASSISTANT_DEFAULTS.name}. When you refer to yourself, use that name.`,
  );
  lines.push(
    settings.casualLanguage
      ? "Talk casually, like a person in the shop, not like a manual."
      : "Keep your wording neutral and businesslike.",
  );
  lines.push(settings.humor ? "Light humour is welcome when it fits." : "Skip jokes; stay straightforward.");
  lines.push(
    settings.shopBanter
      ? "A little playful shop banter with staff is fine, as long as the answer is still correct and useful."
      : "No banter or sarcasm.",
  );
  lines.push(
    settings.mildProfanity
      ? "Mild everyday shop language is allowed. Never slurs, never abuse, and never anything aimed at a person."
      : "Keep the language clean; no profanity.",
  );
  if (settings.customerFacingProfessional) {
    lines.push(
      "Customer-facing mode: whenever you write something a customer will see or hear — texts, emails, estimate wording, phone scripts, explanations to read out — it must be fully professional, clean and respectful, regardless of the personality settings above.",
    );
  }
  const personality = settings.personality.trim();
  const persona = personality.length > 0 ? `\n\nShop owner's standing instructions for you:\n${personality}` : "";
  return `Personality and tone:\n- ${lines.join("\n- ")}${persona}`;
}
