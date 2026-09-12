import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CedarLogo } from "@/components/cedar-logo";
import { AssistantBar } from "@/components/assistant-bar";
import { Button } from "@/components/ui/button";
import { useShopContext } from "@/components/access-gate";
import { usePermissions } from "@/components/use-permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import type { PermissionKey } from "@/lib/permissions";

const NAV = [
  { to: "/hub", label: "Dashboard", needs: "view_dashboard" },
  { to: "/entry", label: "Daily entry", needs: "edit_dashboard_numbers" },
  { to: "/history", label: "History", needs: undefined },
  { to: "/inventory", label: "Inventory", needs: undefined },
  { to: "/customers", label: "Customers", needs: undefined },
  { to: "/board", label: "Jobs & appointments", needs: undefined },
  { to: "/tv", label: "TV mode", needs: undefined },
  { to: "/tools", label: "Tools", needs: "access_tools" },
  { to: "/account", label: "My account", needs: undefined },
  { to: "/settings", label: "Settings", needs: undefined },
] as const satisfies readonly { to: string; label: string; needs: PermissionKey | undefined }[];

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
  const { can, isLoading } = usePermissions();
  const pending = shopContext?.pendingCount ?? 0;

  // Until permissions load, show the full list rather than flashing an empty menu.
  const items = NAV.filter((item) => isLoading || !item.needs || can(item.needs));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar px-4 py-6 md:block">
          <Link to="/hub" aria-label="Cedar Valley Hub dashboard">
            <CedarLogo className="mb-8 h-10 w-auto" />
          </Link>
          <nav className="space-y-1">
            {items.map((item) => (
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
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              {title !== "Dashboard" && (
                <Link
                  to="/hub"
                  className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground md:hidden"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
                </Link>
              )}
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
              {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/hub" className="md:hidden" aria-label="Cedar Valley Hub dashboard">
                <CedarLogo className="h-9 w-auto" />
              </Link>
              <NotificationBell />
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
            {items.map((item) => (
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
          <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
      <AssistantBar />
    </div>
  );
}
