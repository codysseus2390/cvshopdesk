import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { receiveAutoflowWebhook } from "./autoflow-webhook.server";

const env = {
  AUTOFLOW_WEBHOOK_ENABLED: "true",
  AUTOFLOW_SHOPDESK_SHOP_ID: "00000000-0000-4000-8000-000000000001",
  AUTOFLOW_SHOP_ID: "12",
  AUTOFLOW_SUBDOMAIN: "example",
  AUTOFLOW_WEBHOOK_SECURITY_KEY: "test-key",
};
const body = {
  event: { id: "1694719152-9588", type: "status_update" },
  shop: { id: 12, domain: "example.autotext.me" },
  ticket: { id: "009486", status: "Waiting parts" },
};
const hash = createHash("sha256").update(`ATME:test-key:${body.event.id}`).digest("hex");
function request(payload: unknown = body, signature = hash) {
  return new Request("https://shopdesk.example/api/webhooks/autoflow", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-atme-hash": signature },
    body: JSON.stringify(payload),
  });
}

describe("Autoflow receiver", () => {
  it("stores a validated status event before acknowledging, with server-selected shop", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const result = await receiveAutoflowWebhook(request(), env, save);
    expect(result.status).toBe(200);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        shop_id: env.AUTOFLOW_SHOPDESK_SHOP_ID,
        autoflow_shop_id: "12",
        event_id: body.event.id,
        event_type: "status_update",
      }),
    );
    expect(save.mock.calls[0]![0].payload.ticket.id).toBe("009486");
  });

  it("fails closed when disabled or mapping is absent", async () => {
    const save = vi.fn();
    expect((await receiveAutoflowWebhook(request(), {}, save)).status).toBe(503);
    expect(
      (await receiveAutoflowWebhook(request(), { ...env, AUTOFLOW_WEBHOOK_ENABLED: "false" }, save))
        .status,
    ).toBe(503);
    expect(
      (await receiveAutoflowWebhook(request(), { ...env, AUTOFLOW_SHOPDESK_SHOP_ID: "" }, save))
        .status,
    ).toBe(503);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects wrong hashes and changed event IDs without storage", async () => {
    const save = vi.fn();
    expect((await receiveAutoflowWebhook(request(body, "0".repeat(64)), env, save)).status).toBe(
      401,
    );
    expect(
      (
        await receiveAutoflowWebhook(
          request({ ...body, event: { ...body.event, id: "other" } }),
          env,
          save,
        )
      ).status,
    ).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects another shop or domain even with a valid event hash", async () => {
    const save = vi.fn();
    for (const shop of [
      { id: 99, domain: "example.autotext.me" },
      { id: 12, domain: "other.autotext.me" },
    ]) {
      expect((await receiveAutoflowWebhook(request({ ...body, shop }), env, save)).status).toBe(
        403,
      );
    }
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON, unsupported events, and oversized streams", async () => {
    const save = vi.fn();
    const invalid = request();
    const headers = invalid.headers;
    expect(
      (
        await receiveAutoflowWebhook(
          new Request(invalid.url, { method: "POST", headers, body: "{" }),
          env,
          save,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await receiveAutoflowWebhook(
          request({ ...body, event: { ...body.event, type: "inbound_message" } }),
          env,
          save,
        )
      ).status,
    ).toBe(400);
    expect(
      (await receiveAutoflowWebhook(request({ ...body, extra: "x".repeat(128 * 1024) }), env, save))
        .status,
    ).toBe(413);
    const wrongType = request();
    wrongType.headers.set("content-type", "text/plain");
    expect((await receiveAutoflowWebhook(wrongType, env, save)).status).toBe(415);
    expect(save).not.toHaveBeenCalled();
  });

  it("returns retryable failure when durable storage fails, without exposing details", async () => {
    const result = await receiveAutoflowWebhook(
      request(),
      env,
      vi.fn().mockRejectedValue(new Error("private database details")),
    );
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("private");
  });
});
