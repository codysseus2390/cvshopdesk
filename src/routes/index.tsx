import { createFileRoute, Link } from "@tanstack/react-router";
import { CedarLogo } from "@/components/cedar-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cedar Valley Hub — staff sign in" },
      {
        name: "description",
        content:
          "Sign in to the Cedar Valley Tire & Auto Service staff hub for daily numbers and shop records.",
      },
      { property: "og:title", content: "Cedar Valley Hub — staff sign in" },
      {
        property: "og:description",
        content: "Staff-only hub for Cedar Valley Tire & Auto Service.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(920px 480px at 88% -12%, color-mix(in oklch, var(--color-primary) 12%, transparent), transparent 68%), radial-gradient(640px 380px at 6% 108%, color-mix(in oklch, var(--color-secondary) 10%, transparent), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative space-y-8">
        <CedarLogo className="mx-auto h-20 w-auto" />
        <div>
          <p className="eyebrow">Cedar Valley Tire &amp; Auto Service</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-foreground">
            Cedar Valley Hub
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Staff-only hub for daily numbers, report imports and shop records. Every record stays
            behind staff sign-in.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full px-8 shadow-sm">
          <Link to="/auth">Staff sign in</Link>
        </Button>
        <p className="text-xs font-medium text-muted-foreground">Same People. A Smoother Shop.</p>
      </div>
    </main>
  );
}
