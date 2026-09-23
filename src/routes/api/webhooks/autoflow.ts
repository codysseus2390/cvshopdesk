import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/autoflow")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { receiveAutoflowWebhook } = await import("@/lib/autoflow-webhook.server");
        return receiveAutoflowWebhook(request);
      },
    },
  },
});
