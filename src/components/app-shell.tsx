import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ClipboardPenLine,
  History,
  LayoutDashboard,
  Monitor,
  PackageSearch,
  Settings,
  Sparkles,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
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
  { to: "/hub", label: "Dashboard", icon: LayoutDashboard, needs: "view_dashboard" },
  { to: "/entry", label: "Daily entry", icon: ClipboardPenLine, needs: "edit_dashboard_numbers" },
  { to: "/history", label: "History", icon: History, needs: undefined },
  { to: "/inventory", label: "Inventory", icon: PackageSearch, needs: undefined },
  { to: "/customers", label: "Customers", icon: UsersRound, needs: undefined },
  { to: "/board", label: "Jobs & appointments", icon: CalendarClock, needs: undefined },
  { to: "/tv", label: "TV mode", icon: Monitor, needs: undefined },
  { to: "/tools", label: "Tools", icon: Wrench, needs: "access_tools" },
  { to: "/account", label: "My account", icon: UserRound, needs: undefined },
  { to: "/settings", label: "Settings", icon: Settings, needs: undefined },
] as const satisfies readonly { to: string; label: string; icon: typeof Sparkles; needs: PermissionKey | undefined }[];

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
    <div className="min-h-screen pb-28">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar px-4 py-5 shadow-elevated md:block">
          <Link to="/hub" className="block border-b border-sidebar-border px-2 pb-5" aria-label="Cedar Valley Hub dashboard">
            <CedarLogo className="h-12 w-auto max-w-full object-contain" />
          </Link>
          <nav className="mt-5 space-y-1">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex min-h-11 items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 transition-[background-color,border-color,box-shadow,color] duration-200 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{ className: "group flex min-h-11 items-center justify-between gap-2 rounded-lg border border-sidebar-primary/70 bg-sidebar-primary text-sidebar-primary-foreground shadow-md" }}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <item.icon className="h-[18px] w-[18px] shrink-0 opacity-85 transition-opacity group-hover:opacity-100" />
                  <span className="truncate">{item.label}</span>
                </span>
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
          <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-border/80 bg-card/92 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6 sm:py-4">
            <div className="min-w-0">
              {title !== "Dashboard" && (
                <Link
                  to="/hub"
                  className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground md:hidden"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
                </Link>
              )}
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-[1.75rem]">{title}</h1>
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
          <nav className="flex gap-1.5 overflow-x-auto border-b border-border/80 bg-card/90 px-3 py-2 shadow-sm backdrop-blur md:hidden">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="min-h-9 whitespace-nowrap rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                activeProps={{ className: "min-h-9 whitespace-nowrap rounded-lg border border-primary/30 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm" }}
              >
                {item.label}
                {item.to === "/settings" && pending > 0 ? ` (${pending})` : ""}
              </Link>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-7">{children}</main>
        </div>
      </div>
      <AssistantBar />
    </div>
  );
}
