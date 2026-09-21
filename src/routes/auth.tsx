import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "./auth.css";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cedar Valley Hub" },
      {
        name: "description",
        content: "Staff sign in for the Cedar Valley Tire & Auto Service hub.",
      },
      { property: "og:title", content: "Sign in — Cedar Valley Hub" },
      { property: "og:description", content: "Staff sign in for the Cedar Valley hub." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hub", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/hub", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage("Check your email for the confirmation link, then sign in.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (googleError) throw googleError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in is unavailable.");
    }
  }

  return (
    <main className="auth-page">
      <svg className="auth-valley" viewBox="0 0 800 200" fill="none" aria-hidden="true">
        <path
          d="M0 134 C170 60 235 192 422 120 S650 34 800 108 V200 H0Z"
          fill="#7cb258"
          fillOpacity=".08"
        />
        <path
          d="M0 157 C160 93 300 201 454 136 S710 90 800 117"
          stroke="#7c9b3d"
          strokeOpacity=".2"
        />
        <path
          d="M0 170 C180 108 275 215 470 152 S720 101 800 132"
          stroke="#7c9b3d"
          strokeOpacity=".1"
        />
      </svg>
      <svg className="auth-wheel" viewBox="0 0 940 940" fill="none" aria-hidden="true">
        <g stroke="#7c9b3d">
          <circle cx="470" cy="470" r="446" strokeWidth="2" />
          <circle cx="470" cy="470" r="398" strokeWidth="2" />
          <circle cx="470" cy="470" r="352" />
          {Array.from({ length: 42 }, (_, i) => (
            <path
              key={i}
              d="M875 470 L910 481"
              strokeWidth="8"
              transform={`rotate(${(i * 360) / 42} 470 470)`}
            />
          ))}
        </g>
        <path d="M80 210 A470 470 0 0 1 515 2" stroke="#ff8020" strokeWidth="6" />
      </svg>
      <div className="auth-layout">
        <section className="auth-brand" aria-labelledby="auth-brand-heading">
          <p className="auth-eyebrow">ShopDesk / Staff portal</p>
          <img
            className="auth-logo"
            src="/cedar-valley-logo-stacked.png"
            width="520"
            height="260"
            alt="Cedar Valley Tire & Auto Service"
          />
          <h1 id="auth-brand-heading">Your shop. Connected.</h1>
          <p className="auth-description">
            Daily numbers, report imports, and shop records.
            <br />
            One place to keep the crew moving.
          </p>
          <p className="auth-tagline">Same people. A smoother shop.</p>
        </section>
        <Card className="auth-card">
          <CardHeader className="auth-card-header">
            <CardTitle className="auth-card-title">
              <h2>{mode === "signin" ? "Good to see you." : "Join the crew."}</h2>
            </CardTitle>
            <p className="auth-card-intro">
              {mode === "signin"
                ? "Sign in to pick up where you left off."
                : "Create your staff account to get started."}
            </p>
          </CardHeader>
          <CardContent className="auth-card-content space-y-4">
            <form onSubmit={submit} className="auth-form space-y-5" aria-busy={busy}>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="auth-submit w-full" disabled={busy}>
                {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
                {!busy && <ArrowRight aria-hidden="true" />}
              </Button>
            </form>
            <Button
              variant="outline"
              className="auth-google w-full"
              onClick={google}
              disabled={busy}
            >
              Continue with Google
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline"
              disabled={busy}
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "New staff member? Create an account"
                : "Already have an account? Sign in"}
            </button>
            <p className="text-xs text-muted-foreground">
              New accounts need approval from the shop owner before any records are visible.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
