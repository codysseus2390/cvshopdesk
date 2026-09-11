import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decideMember, listMembers } from "@/lib/shop.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Cedar Valley Hub" },
      { name: "description", content: "Manage Cedar Valley staff access and see the TireShop connection status." },
      { property: "og:title", content: "Settings — Cedar Valley Hub" },
      { property: "og:description", content: "Staff access and integration status." },
    ],
  }),
  component: () => (
    <AccessGate>
      <SettingsPage />
    </AccessGate>
  ),
});

function SettingsPage() {
  const context = useShopContext();
  const fetchMembers = useServerFn(listMembers);
  const decide = useServerFn(decideMember);
  const queryClient = useQueryClient();
  const isOwner = context.data?.membership?.role === "owner";

  const members = useQuery({ queryKey: ["members"], queryFn: () => fetchMembers(), enabled: isOwner });

  async function act(memberId: string, status: "approved" | "revoked") {
    await decide({ data: { memberId, status, ...(status === "approved" ? { role: "staff" as const } : {}) } });
    await queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  return (
    <AppShell title="Settings" subtitle={context.data?.shop?.name}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Staff access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isOwner && (
              <p className="text-sm text-muted-foreground">Only the shop owner can approve or remove staff.</p>
            )}
            {isOwner && members.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No staff requests yet.</p>
            )}
            {isOwner &&
              members.data?.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <p className="font-semibold">{m.email ?? "Unknown email"}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.role} · requested {new Date(m.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.status === "approved" ? "default" : "secondary"}>{m.status}</Badge>
                    {m.status !== "approved" && (
                      <Button size="sm" onClick={() => act(m.id, "approved")}>
                        Approve
                      </Button>
                    )}
                    {m.status === "approved" && m.role !== "owner" && (
                      <Button size="sm" variant="outline" onClick={() => act(m.id, "revoked")}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">TireShop connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge variant="secondary">Awaiting TireShop access</Badge>
            <p className="text-muted-foreground">
              No TireShop endpoint is contacted by this app. Everything here comes from staff entries and uploaded
              reports. Once TireShop supplies the shop's credentials and connection instructions, live reads of store
              and inventory information can be added on top of the same saved records.
            </p>
            <p className="text-muted-foreground">
              Creating work orders or appointments stays out of scope, before and after that connection.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Assistant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The assistant answers only from saved shop records and names the dates and uploads behind each answer.
              Values still awaiting review are labelled as such.
            </p>
            <p>Uploaded files are treated as data only; nothing inside a file can instruct the assistant.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
