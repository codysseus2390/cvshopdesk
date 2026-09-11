import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CedarLogo } from "@/components/cedar-logo";
import { AssistantBar } from "@/components/assistant-bar";
import { Button } from "@/components/ui/button";
import { useShopContext } from "@/components/access-gate";

const NAV = [
  { to: "/hub", label: "Dashboard" },
  { to: "/entry", label: "Daily entry" },
  { to: "/imports", label: "Imports" },
  { to: "/history", label: "History" },
  { to: "/inventory", label: "Inventory" },
  { to: "/customers", label: "Customers" },
  { to: "/board", label: "Jobs & appointments" },
  { to: "/tv", label: "TV mode" },
  { to: "/account", label: "My account" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: shopContext } = useShopContext();
  const pending = shopContext?.pendingCount ?? 0;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar px-4 py-6 md:block">
          <CedarLogo className="mb-8 h-10 w-auto" />
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                activeProps={{ className: "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground" }}
              >
                <span>{item.label}</span>
                {item.to === "/settings" && pending > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                    {pending}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-2">
              <CedarLogo className="h-9 w-auto md:hidden" />
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                activeProps={{ className: "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground" }}
              >
                {item.label}
                {item.to === "/settings" && pending > 0 ? ` (${pending})` : ""}
              </Link>
            ))}
          </nav>
          <main className="px-6 py-8">{children}</main>
        </div>
      </div>
      <AssistantBar />
    </div>
  );
}
