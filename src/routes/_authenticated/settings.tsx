import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  addStaffMember,
  decideMember,
  listInvites,
  listMembers,
  setMemberCredentials,
  setMemberRole,
} from "@/lib/shop.functions";
import { listAuditEvents, saveShopSettings, setRolePermission } from "@/lib/admin.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { usePermissions } from "@/components/use-permissions";
import { NotificationComposer } from "@/components/notification-composer";
import { HankSettings } from "@/components/hank-settings";
import { useTheme } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  resolvePermissions,
  roleLabel,
  type AssignableRole,
  type PermissionKey,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Cedar Valley Hub" },
      {
        name: "description",
        content: "Manage Cedar Valley staff, roles, permissions, dashboard goals, security and appearance.",
      },
      { property: "og:title", content: "Settings — Cedar Valley Hub" },
      { property: "og:description", content: "Staff, roles, permissions and app settings." },
    ],
  }),
  component: () => (
    <AccessGate>
      <SettingsPage />
    </AccessGate>
  ),
});

const DASHBOARD_WIDGETS = [
  { key: "today", label: "Today's numbers" },
  { key: "mtd", label: "Month to date" },
  { key: "monthly_chart", label: "Monthly gross profit chart" },
  { key: "ytd", label: "Year to date and last year" },
  { key: "scorecards", label: "Monthly scorecards" },
] as const;

const TARGET_FIELDS = [
  { key: "gross_profit", label: "Monthly gross profit goal ($)" },
  { key: "tires_sold", label: "Monthly tires sold goal" },
  { key: "car_count", label: "Monthly car count goal" },
  { key: "gp_per_car", label: "Gross profit per car goal ($)" },
] as const;

function SettingsPage() {
  const context = useShopContext();
  const perms = usePermissions();
  const queryClient = useQueryClient();

  const isOwner = perms.isOwner;
  const isAdmin = perms.isAdmin;

  return (
    <AppShell title="Settings" subtitle={context.data?.shop?.name}>
      <Tabs defaultValue="staff" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="staff">Staff &amp; Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="hank">Hank Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <StaffAndRoles isAdmin={isAdmin} isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="permissions">
          <PermissionMatrix isOwner={isOwner} overrides={perms.overrides} onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-config"] })} />
        </TabsContent>
        <TabsContent value="dashboard">
          <DashboardSettings isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationComposer canSend={isAdmin} />
        </TabsContent>
        <TabsContent value="hank">
          <HankSettings canEdit={isAdmin} />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySection isOwner={isOwner} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSection />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StaffAndRoles({ isAdmin, isOwner }: { isAdmin: boolean; isOwner: boolean }) {
  const fetchMembers = useServerFn(listMembers);
  const fetchInvites = useServerFn(listInvites);
  const decide = useServerFn(decideMember);
  const changeRole = useServerFn(setMemberRole);
  const addStaff = useServerFn(addStaffMember);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<AssignableRole>("staff");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const members = useQuery({ queryKey: ["members"], queryFn: () => fetchMembers(), enabled: isAdmin });
  const invites = useQuery({ queryKey: ["staff-invites"], queryFn: () => fetchInvites(), enabled: isAdmin });

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      await queryClient.invalidateQueries({ queryKey: ["staff-invites"] });
      await queryClient.invalidateQueries({ queryKey: ["shop-context"] });
      setNote({ ok: true, text: done });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "That did not work." });
    } finally {
      setBusy(false);
    }
  }

  const pendingMembers = (members.data ?? []).filter((m) => m.status === "pending");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Add an employee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">Only the owner and admins can add or edit employees.</p>
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
                  onChange={(e) => setNewRole(e.target.value as AssignableRole)}
                >
                  <option value="staff">Staff — can use the hub</option>
                  <option value="manager">Admin — can also manage staff and settings</option>
                  <option value="display">TV / Display — shared screen, view only</option>
                </select>
              </div>
              <Button
                disabled={busy || email.trim().length < 5}
                onClick={() =>
                  run(async () => {
                    await addStaff({ data: { email: email.trim(), role: newRole } });
                    setEmail("");
                  }, "Employee added.")
                }
              >
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
          <CardTitle className="font-display">
            Waiting for approval {pendingMembers.length > 0 && <Badge className="ml-2">{pendingMembers.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isAdmin && <p className="text-sm text-muted-foreground">Only the owner and admins can approve people.</p>}
          {isAdmin && pendingMembers.length === 0 && (
            <p className="text-sm text-muted-foreground">Nobody is waiting right now.</p>
          )}
          {isAdmin &&
            pendingMembers.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <span className="font-semibold">{m.email ?? "Unknown email"}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => decide({ data: { memberId: m.id, status: "approved", role: "staff" } }), "Approved as staff.")}
                  >
                    Approve as staff
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => decide({ data: { memberId: m.id, status: "revoked" } }), "Request declined.")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          {isAdmin && (invites.data?.length ?? 0) > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-semibold">Added, not signed in yet</p>
              {invites.data?.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{i.email}</span>
                  <Badge variant="secondary">{roleLabel(i.role)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-display">Staff and roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isAdmin && <p className="text-sm text-muted-foreground">Only the owner and admins can manage staff.</p>}
          {isAdmin && members.data?.length === 0 && <p className="text-sm text-muted-foreground">No staff yet.</p>}
          {isAdmin &&
            members.data?.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <div>
                  <p className="font-semibold">{m.email ?? "Unknown email"}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel(m.role)} · added {new Date(m.requested_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.status === "approved" ? "default" : "secondary"}>{m.status}</Badge>
                  {m.role === "owner" ? (
                    <Badge variant="secondary">Owner — cannot be changed</Badge>
                  ) : (
                    <>
                      <select
                        aria-label={`Role for ${m.email ?? "employee"}`}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        value={m.role}
                        onChange={(e) =>
                          run(
                            () => changeRole({ data: { memberId: m.id, role: e.target.value as AssignableRole } }),
                            "Role updated.",
                          )
                        }
                      >
                        {ASSIGNABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </select>
                      {m.status !== "approved" && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                decide({
                                  data: {
                                    memberId: m.id,
                                    status: "approved",
                                    role: (m.role === "owner" ? "staff" : m.role) as AssignableRole,
                                  },
                                }),
                              "Approved.",
                            )
                          }
                        >
                          Approve
                        </Button>
                      )}
                      {m.status === "approved" && (
                        <ConfirmButton
                          label="Remove"
                          title={`Remove ${m.email ?? "this employee"}?`}
                          description="They lose access to every shop record straight away. Their saved entries stay in the history."
                          disabled={busy}
                          onConfirm={() => run(() => decide({ data: { memberId: m.id, status: "revoked" } }), "Access removed.")}
                        />
                      )}
                    </>
                   )}
                 </div>
                 <div className="w-full">
                   <SignInDetails memberId={m.id} email={m.email} isOwnerRow={m.role === "owner"} isOwner={isOwner} />
                 </div>
               </div>
             ))}
          {isAdmin && !isOwner && (
            <p className="text-xs text-muted-foreground">
              Admins manage staff and TV screens. The owner account cannot be changed, removed or transferred here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Owner/admin editor for one employee's sign-in email and password. */
function SignInDetails({
  memberId,
  email,
  isOwnerRow,
  isOwner,
}: {
  memberId: string;
  email: string | null;
  isOwnerRow: boolean;
  isOwner: boolean;
}) {
  const saveCredentials = useServerFn(setMemberCredentials);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (isOwnerRow && !isOwner) return null;

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await saveCredentials({
        data: {
          memberId,
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
          ...(newPassword ? { password: newPassword } : {}),
        },
      });
      setNewEmail("");
      setNewPassword("");
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      setNote({ ok: true, text: "Sign-in details updated." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "That did not work." });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change email or password
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`email-${memberId}`}>New sign-in email</Label>
          <Input
            id={`email-${memberId}`}
            type="email"
            placeholder={email ?? "name@example.com"}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`password-${memberId}`}>New password</Label>
          <Input
            id={`password-${memberId}`}
            type="password"
            placeholder="At least 10 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy || (!newEmail.trim() && newPassword.length < 10)}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save sign-in details"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNewEmail("");
            setNewPassword("");
            setNote(null);
          }}
        >
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          Tell the employee their new password in person — nothing is emailed from here.
        </span>
      </div>
      {note && <p className={`text-sm ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>{note.text}</p>}
    </div>
  );
}

function PermissionMatrix({
  isOwner,
  overrides,
  onSaved,
}: {
  isOwner: boolean;
  overrides: { role: string; permission: string; allowed: boolean }[];
  onSaved: () => void;
}) {
  const savePermission = useServerFn(setRolePermission);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function toggle(role: AssignableRole, permission: PermissionKey, allowed: boolean) {
    setBusy(`${role}:${permission}`);
    setNote(null);
    try {
      await savePermission({ data: { role, permission, allowed } });
      onSaved();
      setNote({ ok: true, text: "Permission saved." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Nothing was changed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">What each role can do</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The Owner always has full access. Ownership and security controls stay with the owner and cannot be handed to
          another role.
        </p>
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-semibold">Action</th>
                <th className="py-2 pr-4 font-semibold">Owner</th>
                {ASSIGNABLE_ROLES.map((role) => (
                  <th key={role} className="py-2 pr-4 font-semibold">
                    {roleLabel(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permission) => (
                <tr key={permission.key} className="border-b border-border/60">
                  <td className="py-2 pr-4">
                    {permission.label}
                    {"ownerOnly" in permission && permission.ownerOnly && (
                      <Badge variant="secondary" className="ml-2">
                        Owner only
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">Always</td>
                  {ASSIGNABLE_ROLES.map((role) => {
                    const effective = resolvePermissions(role, overrides)[permission.key];
                    const locked = "ownerOnly" in permission && permission.ownerOnly;
                    return (
                      <td key={role} className="py-2 pr-4">
                        <Switch
                          checked={effective}
                          disabled={!isOwner || locked || busy === `${role}:${permission.key}`}
                          onCheckedChange={(checked) => toggle(role, permission.key, checked)}
                          aria-label={`${permission.label} for ${roleLabel(role)}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isOwner && <p className="text-sm text-muted-foreground">Only the owner can change these switches.</p>}
        {note && <p className={`text-sm ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>{note.text}</p>}
      </CardContent>
    </Card>
  );
}

function DashboardSettings({ isAdmin }: { isAdmin: boolean }) {
  const perms = usePermissions();
  const save = useServerFn(saveShopSettings);
  const queryClient = useQueryClient();

  const [hidden, setHidden] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<{ technician: string; cars_per_month: string; gp_per_month: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!perms.settings) return;
    setHidden(perms.settings.hidden_widgets ?? []);
    setTargets(
      Object.fromEntries(
        Object.entries(perms.settings.targets ?? {}).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]),
      ),
    );
    setGoals(
      (perms.settings.technician_goals ?? []).map((g) => ({
        technician: g.technician,
        cars_per_month: g.cars_per_month === null || g.cars_per_month === undefined ? "" : String(g.cars_per_month),
        gp_per_month: g.gp_per_month === null || g.gp_per_month === undefined ? "" : String(g.gp_per_month),
      })),
    );
  }, [perms.settings]);

  const number = (value: string) => (value.trim() === "" ? null : Number(value));

  async function submit() {
    setBusy(true);
    setNote(null);
    try {
      await save({
        data: {
          hidden_widgets: hidden,
          targets: Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, number(targets[f.key] ?? "")])),
          technician_goals: goals
            .filter((g) => g.technician.trim().length > 0)
            .map((g) => ({
              technician: g.technician.trim(),
              cars_per_month: number(g.cars_per_month),
              gp_per_month: number(g.gp_per_month),
            })),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-config"] });
      setNote({ ok: true, text: "Dashboard settings saved." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Dashboard settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Only the owner and admins can change the dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Cards shown on the dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DASHBOARD_WIDGETS.map((widget) => (
            <div key={widget.key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{widget.label}</span>
              <Switch
                checked={!hidden.includes(widget.key)}
                aria-label={widget.label}
                onCheckedChange={(checked) =>
                  setHidden((prev) => (checked ? prev.filter((k) => k !== widget.key) : [...prev, widget.key]))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Monthly goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TARGET_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`target-${field.key}`}>{field.label}</Label>
              <Input
                id={`target-${field.key}`}
                inputMode="decimal"
                value={targets[field.key] ?? ""}
                placeholder="Leave blank for no goal"
                onChange={(e) => setTargets((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-display">Technician productivity goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.map((goal, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Input
                aria-label="Technician name"
                value={goal.technician}
                placeholder="Technician name as it appears on jobs"
                onChange={(e) =>
                  setGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, technician: e.target.value } : g)))
                }
              />
              <Input
                aria-label="Cars per month goal"
                value={goal.cars_per_month}
                placeholder="Cars / month"
                onChange={(e) =>
                  setGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, cars_per_month: e.target.value } : g)))
                }
              />
              <Input
                aria-label="Gross profit per month goal"
                value={goal.gp_per_month}
                placeholder="GP / month"
                onChange={(e) =>
                  setGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, gp_per_month: e.target.value } : g)))
                }
              />
              <Button variant="outline" onClick={() => setGoals((prev) => prev.filter((_, idx) => idx !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => setGoals((prev) => [...prev, { technician: "", cars_per_month: "", gp_per_month: "" }])}
          >
            Add a technician goal
          </Button>
          <p className="text-xs text-muted-foreground">
            Goals are compared against the technician names that arrive on imported jobs. Nothing is invented for a
            technician the records have not seen.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save dashboard settings"}
            </Button>
            {note && <p className={`text-sm ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>{note.text}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecuritySection({ isOwner, isAdmin }: { isOwner: boolean; isAdmin: boolean }) {
  const perms = usePermissions();
  const fetchEvents = useServerFn(listAuditEvents);
  const context = useShopContext();
  const events = useQuery({ queryKey: ["audit-events"], queryFn: () => fetchEvents(), enabled: isAdmin });
  const [session, setSession] = useState<{ email: string | null; lastSignIn: string | null }>({
    email: null,
    lastSignIn: null,
  });
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSession({
        email: data.user?.email ?? null,
        lastSignIn: data.user?.last_sign_in_at ?? null,
      });
    });
  }, []);

  async function signOutEverywhere() {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setNote(error ? error.message : "Signed out of every device. Sign in again to continue.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Your sign-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Signed in as <span className="font-semibold">{session.email ?? context.data?.email ?? "—"}</span>
          </p>
          <p className="text-muted-foreground">
            Last sign-in: {session.lastSignIn ? new Date(session.lastSignIn).toLocaleString() : "not recorded"}
          </p>
          <p className="text-muted-foreground">
            Your role: {roleLabel(perms.role)} · every record, upload and TV screen stays behind staff sign-in.
          </p>
          {isOwner ? (
            <ConfirmButton
              label="Sign out of all devices"
              title="Sign out everywhere?"
              description="Every device signed in with your account is signed out, including any TV screen using it."
              onConfirm={signOutEverywhere}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Signing every device out is an owner action. Change your password on My account instead.
            </p>
          )}
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Who can do what</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Owner — full control, the only account that can change permissions or ownership.</p>
          <p>Admin — manages staff, imports, settings and announcements.</p>
          <p>Staff — daily numbers, records and the assistant.</p>
          <p>TV / Display — view only, for the shared screen.</p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-display">Activity log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!isAdmin && <p className="text-muted-foreground">Only the owner and admins can see the activity log.</p>}
          {isAdmin && (events.data?.length ?? 0) === 0 && (
            <p className="text-muted-foreground">Nothing recorded yet. Permission, goal and announcement changes appear here.</p>
          )}
          {isAdmin &&
            events.data?.map((event) => (
              <div key={event.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2">
                <span>
                  <span className="font-semibold">{event.action.replace(/_/g, " ")}</span>
                  {event.target ? ` · ${event.target}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {event.actor_email ?? "unknown"} · {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Appearance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Dark mode</p>
            <p className="text-sm text-muted-foreground">
              Switches the whole app to the dark Cedar Valley palette and remembers your choice on this device.
            </p>
          </div>
          <Switch
            checked={theme === "dark"}
            aria-label="Dark mode"
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
        <Button variant="outline" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ConfirmButton({
  label,
  title,
  description,
  onConfirm,
  disabled,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
