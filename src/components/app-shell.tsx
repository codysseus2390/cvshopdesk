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
  PackageSearch,
  Search,
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
import { Input } from "@/components/ui/input";
import { useShopContext } from "@/components/access-gate";
import { usePermissions } from "@/components/use-permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import type { PermissionKey } from "@/lib/permissions";


const NAV = [
  { to: "/hub", label: "Dashboard", icon: LayoutDashboard, needs: "view_dashboard" },
  { to: "/shop-ai", label: "Hank", icon: Bot, needs: undefined },
  { to: "/numbers", label: "Numbers", icon: BarChart3, needs: "view_dashboard" },
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
    <div className="min-h-screen pb-28">
      <div className="flex">
        <aside className="relative sticky top-0 hidden h-screen w-[212px] shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar px-3 py-5 shadow-elevated md:block">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[47%] bg-cover bg-center opacity-95" style={{ backgroundImage: "url(/sidebar-brand-art.jpg)" }} aria-hidden="true" />
          <Link to="/hub" className="relative z-10 block border-b border-sidebar-border px-2 pb-5" aria-label="Cedar Valley Hub dashboard">
            <CedarLogo className="h-12 w-auto max-w-full object-contain" />
          </Link>
          <nav className="relative z-10 mt-5 space-y-1">
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
          <p className="absolute bottom-2 left-0 right-0 z-10 text-center text-[10px] font-semibold leading-tight text-sidebar-foreground/80">Cedar Valley ShopDesk<br />v2.0</p>
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
              <h1 className={appearance === "dashboard" ? "text-2xl font-bold leading-tight tracking-tight text-foreground md:text-[1.75rem]" : "font-display text-3xl font-bold leading-none text-foreground md:text-[1.75rem]"}>{appearance === "dashboard" ? "Cedar Valley ShopDesk" : title}</h1>
              {appearance === "dashboard" ? <div className="mt-1 hidden text-sm text-muted-foreground md:block">Same People. A Smoother Shop.</div> : subtitle && <div className="mt-1 hidden text-sm text-muted-foreground md:block">{subtitle}</div>}
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl border border-border/80 bg-card p-3 shadow-card md:mt-0 md:flex md:border-0 md:bg-transparent md:p-0 md:shadow-none">
              {appearance === "dashboard" && <form onSubmit={(e) => e.preventDefault()} className="relative hidden min-w-0 flex-1 md:block md:max-w-[22rem] lg:max-w-[28rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers, inventory, or jobs..." aria-label="Search customers, inventory, or jobs" className="h-10 rounded-full border-border/80 bg-card pl-9 pr-4 shadow-none" />
              </form>}
              {appearance === "dashboard" && <span className="hidden items-center gap-2 text-sm font-semibold text-foreground lg:flex"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">{displayName.slice(0, 1).toUpperCase()}</span><span className="max-w-24 truncate">{displayName}</span></span>}
              <Link to="/hub" className="flex min-w-0 items-center md:hidden" aria-label="Cedar Valley Hub dashboard">
                <CedarLogo className="h-12 w-full max-w-[13rem] object-contain object-left" />
              </Link>
              <NotificationBell />
              <ThemeToggle className="rounded-full" />
              <Button variant="outline" size="sm" onClick={signOut} className="col-span-3 mt-1 justify-self-start rounded-xl md:col-auto md:mt-0">
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
                activeProps={{ className: "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary/30 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm" }}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {item.to === "/settings" && pending > 0 ? ` (${pending})` : ""}
              </Link>
            ))}
          </nav>
          <main className={appearance === "dashboard" ? "mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-7" : "mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-7"}>{children}</main>
        </div>
      </div>
      <AssistantBar />
    </div>
  );
}

