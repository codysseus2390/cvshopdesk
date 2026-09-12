import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CedarLogo } from "@/components/cedar-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enterShowcase, getShowcaseStatus } from "@/lib/showcase.functions";
import { markShowcase } from "@/lib/showcase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cedar Valley Hub — staff sign in" },
      {
        name: "description",
        content: "Sign in to the Cedar Valley Tire & Auto Service staff hub for daily numbers and shop records.",
      },
      { property: "og:title", content: "Cedar Valley Hub — staff sign in" },
      { property: "og:description", content: "Staff-only hub for Cedar Valley Tire & Auto Service." },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchStatus = useServerFn(getShowcaseStatus);
  const { data } = useQuery({ queryKey: ["showcase-status"], queryFn: () => fetchStatus() });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center">
      <CedarLogo className="h-20 w-auto" />
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">Cedar Valley Hub</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Staff-only hub for daily numbers, report imports and shop records. Every record stays behind staff sign-in.
        </p>
      </div>

      {data?.enabled ? (
        <ShowcaseEntry />
      ) : (
        <Button asChild size="lg">
          <Link to="/auth">Staff sign in</Link>
        </Button>
      )}
    </main>
  );
}

function ShowcaseEntry() {
  const navigate = useNavigate();
  const enter = useServerFn(enterShowcase);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { tokenHash } = await enter({ data: { passcode } });
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (verifyError) throw verifyError;
      markShowcase();
      navigate({ to: "/hub", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-sm text-left">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Showcase preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter the passcode you were given to look around. It is a read-only tour — nothing can be changed.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="passcode">Showcase passcode</Label>
            <Input
              id="passcode"
              type="password"
              autoComplete="off"
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Enter showcase"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button asChild variant="outline" className="w-full">
          <Link to="/auth">Employee sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
