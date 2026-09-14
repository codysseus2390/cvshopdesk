import { createFileRoute, Link } from "@tanstack/react-router";
import { CedarLogo } from "@/components/cedar-logo";
import { Button } from "@/components/ui/button";

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
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center">
      <CedarLogo className="h-20 w-auto" />
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">Cedar Valley Hub</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Staff-only hub for daily numbers, report imports and shop records. Every record stays behind staff sign-in.
        </p>
      </div>
      <Button asChild size="lg">
        <Link to="/auth">Staff sign in</Link>
      </Button>
    </main>
  );
}
