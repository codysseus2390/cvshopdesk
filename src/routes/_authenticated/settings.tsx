import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addStaffMember, decideMember, listInvites, listMembers, setMemberRole } from "@/lib/shop.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const fetchInvites = useServerFn(listInvites);
  const decide = useServerFn(decideMember);
  const changeRole = useServerFn(setMemberRole);
  const addStaff = useServerFn(addStaffMember);
  const queryClient = useQueryClient();
  const role = context.data?.membership?.role;
  const isAdmin = role === "owner" || role === "manager";

  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<"manager" | "staff">("staff");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const members = useQuery({ queryKey: ["members"], queryFn: () => fetchMembers(), enabled: isAdmin });
  const invites = useQuery({ queryKey: ["staff-invites"], queryFn: () => fetchInvites(), enabled: isAdmin });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["members"] });
    await queryClient.invalidateQueries({ queryKey: ["staff-invites"] });
  }

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      await refresh();
      setNote({ ok: true, text: done });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "That did not work." });
    } finally {
      setBusy(false);
    }
  }

  async function act(memberId: string, status: "approved" | "revoked", memberRole?: "manager" | "staff") {
    await run(
      () => decide({ data: { memberId, status, ...(status === "approved" ? { role: memberRole ?? "staff" } : {}) } }),
      status === "approved" ? "Approved." : "Access removed.",
    );
  }

  async function addEmployee() {
    const result = await run(
      async () => {
        const res = await addStaff({ data: { email: email.trim(), role: newRole } });
        setEmail("");
        return res;
      },
      "Employee added.",
    );
    return result;
  }

  return (
    <AppShell title="Settings" subtitle={context.data?.shop?.name}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Add an employee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAdmin && (
              <p className="text-sm text-muted-foreground">
                Only the owner and managers can add or edit employees.
              </p>
            )}
            {isAdmin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Work email address</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={email}
                    placeholder="name@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-role">Role</Label>
                  <select
                    id="staff-role"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "manager" | "staff")}
                  >
                    <option value="staff">Staff — can use the hub</option>
                    <option value="manager">Admin (manager) — can also add and edit employees</option>
                  </select>
                </div>
                <Button disabled={busy || email.trim().length < 5} onClick={addEmployee}>
                  {busy ? "Saving…" : "Add employee"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Nothing is emailed from here and no password is created. Give them this address, they create their own
                  password, and they are let in automatically the first time they sign in.
                </p>
                {note && <p className={`text-sm ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>{note.text}</p>}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Staff access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isAdmin && (
              <p className="text-sm text-muted-foreground">
                Only the owner and managers can approve or remove staff.
              </p>
            )}
            {isAdmin && members.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No staff yet.</p>
            )}
            {isAdmin &&
              members.data?.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <p className="font-semibold">{m.email ?? "Unknown email"}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.role} · added {new Date(m.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.status === "approved" ? "default" : "secondary"}>{m.status}</Badge>
                    {m.role !== "owner" && (
                      <select
                        aria-label={`Role for ${m.email ?? "employee"}`}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        value={m.role}
                        onChange={(e) =>
                          run(
                            () => changeRole({ data: { memberId: m.id, role: e.target.value as "manager" | "staff" } }),
                            "Role updated.",
                          )
                        }
                      >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                      </select>
                    )}
                    {m.status !== "approved" && (
                      <Button size="sm" disabled={busy} onClick={() => act(m.id, "approved", m.role === "manager" ? "manager" : "staff")}>
                        Approve
                      </Button>
                    )}
                    {m.status === "approved" && m.role !== "owner" && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(m.id, "revoked")}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            {isAdmin && (invites.data?.length ?? 0) > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold">Added, not signed in yet</p>
                {invites.data?.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{i.email}</span>
                    <Badge variant="secondary">{i.role}</Badge>
                  </div>
                ))}
              </div>
            )}
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
