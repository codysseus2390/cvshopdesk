import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { readAutoflow, readAutoflowConfig, verifyAutoflowWebhookHash } from "./autoflow.server";

const env = {
  AUTOFLOW_SUBDOMAIN: "example-shop",
  AUTOFLOW_API_KEY: "test-key",
  AUTOFLOW_API_PASSWORD: "test-password",
};

describe("Autoflow server transport", () => {
  it("rejects missing credentials and destinations outside a shop subdomain", () => {
    expect(() => readAutoflowConfig({})).toThrow(/missing or invalid/);
    for (const subdomain of ["https://evil.example", "shop.autotext.me", "shop/else", "-shop"]) {
      expect(() => readAutoflowConfig({ ...env, AUTOFLOW_SUBDOMAIN: subdomain })).toThrow();
    }
    expect(() => readAutoflowConfig({ ...env, AUTOFLOW_API_KEY: "key:password" })).toThrow();
  });

  it("uses Basic auth, a shop-specific HTTPS URL, and refuses redirects", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ appointments: [] }));
    await expect(
      readAutoflow(
        { resource: "appointments", start: "2026-09-23T00:00:00", end: "2026-09-23T23:59:59" },
        env,
        fetcher,
      ),
    ).resolves.toEqual({ appointments: [] });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://example-shop.autotext.me/api/v1/appointments?start=2026-09-23T00%3A00%3A00&end=2026-09-23T23%3A59%3A59",
    );
    expect(options).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      `Basic ${Buffer.from("test-key:test-password").toString("base64")}`,
    );
  });

  it("preserves repair order leading zeroes and encodes URL metacharacters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}));
    await readAutoflow({ resource: "dvi", roNumber: "00123?#" }, env, fetcher);
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      "https://example-shop.autotext.me/api/v1/dvi/00123%3F%23",
    );
  });

  it("rejects unsafe RO paths and reversed dates before calling Autoflow", async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const roNumber of ["", ".", "..", "../customers", "a\\b"]) {
      await expect(
        readAutoflow({ resource: "work_order", roNumber }, env, fetcher),
      ).rejects.toThrow();
    }
    await expect(
      readAutoflow(
        { resource: "appointments", start: "2026-09-24T00:00:00", end: "2026-09-23T00:00:00" },
        env,
        fetcher,
      ),
    ).rejects.toThrow();
    await expect(
      readAutoflow(
        { resource: "appointments", start: "2026-02-30T00:00:00", end: "2026-03-01T00:00:00" },
        env,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not expose upstream bodies or transport errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private data", { status: 401 }));
    await expect(readAutoflow({ resource: "dvi", roNumber: "123" }, env, fetcher)).rejects.toThrow(
      "Autoflow request failed (HTTP 401).",
    );
    fetcher.mockRejectedValue(new Error("test-password private data"));
    await expect(readAutoflow({ resource: "dvi", roNumber: "123" }, env, fetcher)).rejects.toThrow(
      "Autoflow could not be reached. Please try again.",
    );
    fetcher.mockResolvedValue(new Response("private data"));
    await expect(readAutoflow({ resource: "dvi", roNumber: "123" }, env, fetcher)).rejects.toThrow(
      "Autoflow returned an invalid JSON response.",
    );
  });
});

describe("Autoflow webhook hash", () => {
  const eventId = "1694719152-9588";
  const key = "test-webhook-key";
  const hash = createHash("sha256").update(`ATME:${key}:${eventId}`).digest("hex");

  it("accepts the documented scheme and rejects another event or key", () => {
    expect(verifyAutoflowWebhookHash(eventId, hash, key)).toBe(true);
    expect(verifyAutoflowWebhookHash("other-event", hash, key)).toBe(false);
    expect(verifyAutoflowWebhookHash(eventId, hash, "other-key")).toBe(false);
  });

  it("fails closed for absent configuration, malformed headers and event IDs", () => {
    for (const header of [null, "", "abc", "z".repeat(64), "0".repeat(64), hash + "00"]) {
      expect(verifyAutoflowWebhookHash(eventId, header, key)).toBe(false);
    }
    for (const id of [null, undefined, {}, 123, "", " ", "x".repeat(257)]) {
      expect(verifyAutoflowWebhookHash(id, hash, key)).toBe(false);
    }
    expect(verifyAutoflowWebhookHash(eventId, hash, undefined)).toBe(false);
    expect(verifyAutoflowWebhookHash(eventId, hash, "")).toBe(false);
  });
});
