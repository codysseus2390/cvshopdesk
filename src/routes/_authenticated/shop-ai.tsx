import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { usePermissions } from "@/components/use-permissions";
import { HankChat } from "@/components/shop-ai/hank-chat";

export const Route = createFileRoute("/_authenticated/shop-ai")({
  head: () => ({
    meta: [
      { title: "Hank — Cedar Valley Hub" },
      {
        name: "description",
        content:
          "Ask Hank about automotive service, tires and shop operations from inside Cedar Valley Hub.",
      },
      { property: "og:title", content: "Hank — Cedar Valley Hub" },
      {
        property: "og:description",
        content: "Cedar Valley shop assistant for service advisors and technicians.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccessGate>
      <ShopAiPage />
    </AccessGate>
  ),
});

function ShopAiPage() {
  const { can, isLoading } = usePermissions();
  return (
    <AppShell title="Hank" subtitle="Your shop assistant">
      {isLoading ? (
        <p role="status">Checking assistant access…</p>
      ) : can("use_assistant") ? (
        <HankChat />
      ) : (
        <p>The AI assistant is not enabled for your role.</p>
      )}
    </AppShell>
  );
}
