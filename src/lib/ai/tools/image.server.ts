/**
 * Image creation tool (server-only).
 *
 * Hank draws a brand-new picture with OpenAI's image model and stores it in the
 * shop's private uploads bucket, so it shows up in the same conversation as
 * everything else. This is deliberately separate from looking at an image the
 * user attached — that stays with the vision tools.
 */
import { AiUnavailableError } from "@/lib/ai.server";
import { SHOP_AI_IMAGE_MODEL, SHOP_AI_IMAGE_SIZE } from "../model-config";
import type { ShopAiTool } from "../tools.server";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

const CREATE_IMAGE: ShopAiTool = {
  name: "create_image",
  sourceLabel: "Creating an image",
  description:
    "Creates a brand-new picture from a written description (marketing posts, signage ideas, fun shop graphics). Use this when the user asks you to make, draw, generate or design an image. Do not use it to read or describe an image the user attached.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Full description of the picture to create, including any words that must appear in it.",
      },
    },
    required: ["prompt"],
    additionalProperties: false,
  },
  async execute(ctx, args) {
    const prompt = String(args["prompt"] ?? "").trim();
    if (prompt.length < 3) {
      return { data: { error: "Ask the user what the picture should show before calling this." } };
    }

    const key = process.env["OPENAI_API_KEY"];
    if (!key) {
      throw new AiUnavailableError("Image creation is not configured — the OpenAI key is missing.", "not_configured");
    }

    const res = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: SHOP_AI_IMAGE_MODEL, prompt, size: SHOP_AI_IMAGE_SIZE, n: 1 }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 400 && /content|safety|policy/i.test(detail)) {
        return {
          data: {
            error:
              "That picture request was refused by the image service. Tell the user and offer a different description.",
          },
        };
      }
      throw new AiUnavailableError(`The picture could not be created (${res.status}).`, "upstream");
    }

    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const base64 = json.data?.[0]?.b64_json;
    if (!base64) {
      return { data: { error: "The image service returned no picture. Try again or reword the description." } };
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const name = `hank-image-${new Date().toISOString().slice(0, 10)}.png`;
    const path = `${ctx.shopId}/shop-ai/created-${crypto.randomUUID()}.png`;
    const { error } = await ctx.supabase.storage
      .from("shop-uploads")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (error) {
      throw new Error(`The picture was created but could not be saved: ${error.message}`);
    }

    return {
      data: {
        created: true,
        note: "The picture is already shown to the user in this conversation. Describe it briefly; do not paste a link.",
      },
      image: { name, path, mimeType: "image/png" },
    };
  },
};

export const IMAGE_TOOLS: ShopAiTool[] = [CREATE_IMAGE];
