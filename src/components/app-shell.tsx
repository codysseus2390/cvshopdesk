import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bot,
  CalendarClock,
  ChevronLeft,
  ClipboardPenLine,
  History,
  LayoutDashboard,
  Monitor,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CedarLogo } from "@/components/cedar-logo";
import { HankMessenger } from "@/components/hank-messenger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShopContext } from "@/components/access-gate";
import { usePermissions } from "@/components/use-permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import type { PermissionKey } from "@/lib/permissions";

const NAV = [
  {
    to: "/hub",
    label: "Dashboard",
    icon: LayoutDashboard,
    needs: "view_dashboard",
    group: "primary",
  },
  { to: "/shop-ai", label: "Hank", icon: Bot, needs: "use_assistant", group: "primary" },
  { to: "/numbers", label: "Numbers", icon: BarChart3, needs: "view_dashboard", group: "primary" },
  {
    to: "/entry",
    label: "Daily entry",
    icon: ClipboardPenLine,
    needs: "edit_dashboard_numbers",
    group: "primary",
  },
  { to: "/history", label: "History", icon: History, needs: undefined, group: "shop" },
  {
    to: "/board",
    label: "Jobs & appointments",
    icon: CalendarClock,
    needs: undefined,
    group: "shop",
  },
  { to: "/tv", label: "TV mode", icon: Monitor, needs: undefined, group: "shop" },
  { to: "/tools", label: "Tools", icon: Wrench, needs: "access_tools", group: "system" },
  { to: "/account", label: "My account", icon: UserRound, needs: undefined, group: "system" },
  { to: "/settings", label: "Settings", icon: Settings, needs: undefined, group: "system" },
] as const satisfies readonly {
  to: string;
  label: string;
  icon: typeof Sparkles;
  needs: PermissionKey | undefined;
  group: "primary" | "shop" | "system";
}[];

const GROUP_LABELS: Record<string, string> = {
  primary: "",
  shop: "Shop",
  system: "System",
};

const NAV_INACTIVE =
  "group flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground/60 transition-[background-color,color,transform] duration-150 hover:bg-white/[0.06] hover:text-sidebar-foreground hover:translate-x-0.5";
const NAV_ACTIVE =
  "group flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold bg-primary text-primary-foreground shadow-[0_0_12px_color-mix(in_oklch,var(--color-sidebar-primary)_25%,transparent)]";

function SidebarLink({ item, pending }: { item: (typeof NAV)[number]; pending: number }) {
  return (
    <Link to={item.to} className={NAV_INACTIVE} activeProps={{ className: NAV_ACTIVE }}>
      <item.icon className="size-5 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.to === "/settings" && pending > 0 && (
        <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
          {pending}
        </span>
      )}
    </Link>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
  appearance = "default",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  appearance?: "default" | "dashboard";
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: shopContext } = useShopContext();
  const { can, isLoading } = usePermissions();
  const pending = shopContext?.pendingCount ?? 0;
  const [search, setSearch] = useState("");
  const displayName = shopContext?.email?.split("@")[0] || "Shop user";

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
    <div className="page-vignette min-h-screen overflow-x-clip">
      <div className="flex">
        <aside className="sidebar-surface relative hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
          <div className="relative z-[2] flex h-full flex-col">
            <div className="px-3 pb-4 pt-5">
              <Link to="/hub" className="block" aria-label="Cedar Valley Hub dashboard">
                <CedarLogo className="h-10 w-auto object-contain" />
              </Link>
              <div className="mt-4 flex items-center justify-between gap-2 px-1">
                <p className="font-mono text-xs tracking-[0.16em] text-sidebar-foreground/40">
                  ShopDesk v2.0
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-semibold text-secondary">
                  <span className="live-dot size-1.5 rounded-full bg-secondary" />
                  Live
                </span>
              </div>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
              {(() => {
                let lastGroup = "";
                return items
                  .filter((item) => item.to !== "/account" && item.to !== "/settings")
                  .map((item) => {
                    const showHeader = item.group !== lastGroup && GROUP_LABELS[item.group] !== "";
                    lastGroup = item.group;
                    return (
                      <span key={item.to} className="block">
                        {showHeader && (
                          <p className="mb-2 px-3 font-mono text-xs font-medium uppercase tracking-[0.16em] text-sidebar-foreground/40">
                            {GROUP_LABELS[item.group]}
                          </p>
                        )}
                        <span className="block">
                          <SidebarLink item={item} pending={pending} />
                        </span>
                      </span>
                    );
                  });
              })()}
            </nav>

            <div className="mt-auto space-y-1 border-t border-white/10 px-3 py-3">
              {items
                .filter((item) => item.to === "/account" || item.to === "/settings")
                .map((item) => (
                  <SidebarLink key={item.to} item={item} pending={pending} />
                ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/92 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6 md:flex md:items-center md:justify-between md:gap-4 md:bg-card/92">
            <div className="min-w-0">
              {title !== "Dashboard" && (
                <Link
                  to="/hub"
                  className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground md:hidden"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
                </Link>
              )}
              <h1
                className={
                  appearance === "dashboard"
                    ? "font-display text-[1.75rem] font-bold leading-tight tracking-tight text-foreground md:text-[2rem]"
                    : "font-display text-3xl font-bold leading-none text-foreground md:text-[1.75rem]"
                }
              >
                {appearance === "dashboard" ? "Cedar Valley ShopDesk" : title}
              </h1>
              {appearance === "dashboard" ? (
                <div className="mt-1 hidden text-sm text-muted-foreground md:block">
                  Same People. A Smoother Shop.
                </div>
              ) : (
                subtitle && (
                  <div className="mt-1 hidden text-sm text-muted-foreground md:block">
                    {subtitle}
                  </div>
                )
              )}
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 rounded-2xl border border-border/80 bg-card p-3 shadow-card md:mt-0 md:flex md:border-0 md:bg-transparent md:p-0 md:shadow-none">
              {appearance === "dashboard" && (
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="relative hidden min-w-0 flex-1 md:block md:max-w-[22rem] lg:max-w-[28rem]"
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search jobs..."
                    aria-label="Search jobs"
                    className="h-10 rounded-full border-border/80 bg-card pl-10 pr-4 shadow-none"
                  />
                </form>
              )}
              {appearance === "dashboard" && (
                <span className="hidden items-center gap-2 text-sm font-semibold text-foreground lg:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="max-w-24 truncate">{displayName}</span>
                </span>
              )}
              <Link
                to="/hub"
                className="flex min-w-0 items-center md:hidden"
                aria-label="Cedar Valley Hub dashboard"
              >
                <CedarLogo className="h-12 w-full max-w-[13rem] object-contain object-left" />
              </Link>
              {can("use_assistant") && <HankMessenger />}
              <NotificationBell />
              <ThemeToggle className="rounded-full" />
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="col-span-full mt-1 justify-self-start rounded-xl md:col-auto md:mt-0"
              >
                Sign out
              </Button>
            </div>
          </header>
          <nav className="mx-3 mt-3 flex gap-1.5 overflow-x-auto rounded-2xl border border-border/80 bg-card p-2 shadow-card md:hidden">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                activeProps={{
                  className:
                    "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary/30 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm",
                }}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {item.to === "/settings" && pending > 0 ? ` (${pending})` : ""}
              </Link>
            ))}
          </nav>
          <main
            className={
              appearance === "dashboard"
                ? "dashboard-canvas mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-7"
                : "page-enter mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-7"
            }
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
