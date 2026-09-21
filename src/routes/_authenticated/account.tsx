import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My account — Cedar Valley Hub" },
      {
        name: "description",
        content: "Update your Cedar Valley Hub sign-in email, password and display name.",
      },
      { property: "og:title", content: "My account — Cedar Valley Hub" },
      {
        property: "og:description",
        content: "Update your sign-in email, password and display name.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccessGate>
      <AccountPage />
    </AccessGate>
  ),
});

function AccountPage() {
  const context = useShopContext();
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNote, setNameNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNote, setPasswordNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setCurrentEmail(data.user?.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user?.id ?? "")
        .maybeSingle();
      if (active && profile?.full_name) setFullName(profile.full_name);
    })();
    return () => {
      active = false;
    };
  }, []);

  /** Re-checks the person's own password before a sensitive change. */
  async function verifyPassword(password: string) {
    if (!currentEmail)
      throw new Error("Your account email could not be read. Sign in again and retry.");
    const { error } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
    if (error) throw new Error("That current password is not right.");
  }

  async function saveName() {
    setNameBusy(true);
    setNameNote(null);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in again and retry.");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null })
        .eq("id", data.user.id);
      if (error) throw new Error(error.message);
      setNameNote({ ok: true, text: "Saved." });
    } catch (err) {
      setNameNote({ ok: false, text: err instanceof Error ? err.message : "That did not save." });
    } finally {
      setNameBusy(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailNote(null);
    try {
      const target = newEmail.trim().toLowerCase();
      if (!target || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target))
        throw new Error("Enter a valid email address.");
      if (target === (currentEmail ?? "").toLowerCase())
        throw new Error("That is already your email address.");
      await verifyPassword(emailPassword);
      const { error } = await supabase.auth.updateUser({ email: target });
      if (error) throw new Error(error.message);
      setEmailNote({
        ok: true,
        text: `A confirmation link was sent to ${target}. Your sign-in email changes once you open that link.`,
      });
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      setEmailNote({
        ok: false,
        text: err instanceof Error ? err.message : "The email change did not go through.",
      });
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordNote(null);
    try {
      if (newPassword.length < 8)
        throw new Error("Use at least 8 characters for the new password.");
      if (newPassword !== confirmPassword) throw new Error("The two new passwords do not match.");
      if (newPassword === currentPassword) throw new Error("The new password must be different.");
      await verifyPassword(currentPassword);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setPasswordNote({
        ok: true,
        text: "Your password is changed. Use it next time you sign in.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordNote({
        ok: false,
        text: err instanceof Error ? err.message : "The password change did not go through.",
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  const role = context.data?.membership?.role;

  return (
    <AppShell title="My account" subtitle={context.data?.shop?.name}>
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="eyebrow">Profile</p>
            <CardTitle className="font-display text-xl">Who you are</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Signed in as</p>
              <p className="font-semibold">{currentEmail ?? "Loading…"}</p>
              {role && (
                <Badge variant="secondary">
                  {role === "owner" ? "Owner" : role === "manager" ? "Manager" : "Staff"}
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="full-name">Display name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button onClick={saveName} disabled={nameBusy}>
              {nameBusy ? "Saving…" : "Save name"}
            </Button>
            {nameNote && (
              <p
                className={`text-sm ${nameNote.ok ? "text-muted-foreground" : "text-destructive"}`}
              >
                {nameNote.text}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Security</p>
            <CardTitle className="font-display text-xl">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={savePassword}>
              <div className="space-y-2">
                <Label htmlFor="cur-pw">Current password</Label>
                <Input
                  id="cur-pw"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw2">Repeat new password</Label>
                <Input
                  id="new-pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={passwordBusy}>
                {passwordBusy ? "Saving…" : "Change password"}
              </Button>
              {passwordNote && (
                <p
                  className={`text-sm ${passwordNote.ok ? "text-muted-foreground" : "text-destructive"}`}
                >
                  {passwordNote.text}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <p className="eyebrow">Sign-in</p>
            <CardTitle className="font-display text-xl">Change sign-in email</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={saveEmail}>
              <div className="space-y-2">
                <Label htmlFor="new-email">New email address</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-pw">Your current password</Label>
                <Input
                  id="email-pw"
                  type="password"
                  autoComplete="current-password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Button type="submit" disabled={emailBusy}>
                  {emailBusy ? "Sending…" : "Change email"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Your old email keeps working until you confirm the new one from the link sent to
                  it.
                </p>
                {emailNote && (
                  <p
                    className={`text-sm ${emailNote.ok ? "text-muted-foreground" : "text-destructive"}`}
                  >
                    {emailNote.text}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
