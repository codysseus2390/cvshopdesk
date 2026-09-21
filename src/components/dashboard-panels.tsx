import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  ChevronRight,
  CircleUserRound,
  FileText,
  Link2,
  Monitor,
  Settings,
  Upload,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listImports } from "@/lib/imports.functions";
import { useMyNotifications } from "@/components/notification-bell";
import { formatProductivity } from "@/lib/productivity-math";

type MechanicValue = number | null | undefined;
export type DashboardMechanics = {
  names: string[];
  previous_day: Record<string, MechanicValue>;
  week: Record<string, MechanicValue>;
  month: Record<string, MechanicValue>;
};

export function DashboardMiddleRow({ mechanics }: { mechanics: DashboardMechanics }) {
  return (
    <section
      className="stagger-in grid gap-3 xl:grid-cols-[1fr_1.19fr_1.08fr]"
      aria-label="Shop activity"
    >
      <RecentImportsPanel />
      <NotificationsTvPanel />
      <MechanicProductivityPanel mechanics={mechanics} />
    </section>
  );
}

function RecentImportsPanel() {
  const fetchImports = useServerFn(listImports);
  const imports = useQuery({
    queryKey: ["dashboard-imports"],
    queryFn: () => fetchImports(),
    staleTime: 60_000,
  });
  const rows = (imports.data ?? []).slice(0, 3);

  return (
    <Card className="min-w-0 rounded-2xl border-border/90 bg-card shadow-card panel-glow-steel">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <CardTitle className="flex items-center gap-2 font-body text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground">
            <FileText className="h-4 w-4" />
          </span>
          Recent imports & tools
        </CardTitle>
        <Link to="/imports" className="text-xs font-semibold text-primary hover:underline">
          See all
        </Link>
      </CardHeader>
      <CardContent className="space-y-0 px-4 py-1">
        {rows.length === 0 && (
          <div className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
            <FileText className="h-5 w-5 shrink-0" />
            <p>No import history has been recorded yet.</p>
          </div>
        )}
        {rows.map((item) => (
          <Link
            key={item.id}
            to="/imports"
            className="group flex items-center gap-3 border-b border-border/70 py-3 last:border-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{item.file_name}</span>
              <span className="block text-xs text-muted-foreground">
                {item.uploaded_at
                  ? new Date(item.uploaded_at).toLocaleString()
                  : "Date not recorded"}
              </span>
            </span>
            <Badge
              variant="secondary"
              className="shrink-0 bg-secondary/15 text-secondary-foreground"
            >
              {item.status ?? "Recorded"}
            </Badge>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
        <div className="grid gap-2 py-3 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link to="/imports">
              <Upload className="mr-2 h-4 w-4" />
              Import report
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link to="/numbers">
              <BarChart3 className="mr-2 h-4 w-4" />
              View numbers
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsTvPanel() {
  const { data } = useMyNotifications();
  const items = (data ?? []).slice(0, 3);
  const unread = (data ?? []).filter((item) => !item.read_at).length;

  return (
    <Card className="min-w-0 rounded-2xl border-border/90 bg-card shadow-card panel-glow-ember">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <CardTitle className="flex items-center gap-2 font-body text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground">
            <Bell className="h-4 w-4" />
          </span>
          Notifications & TV display
          {unread > 0 && (
            <Badge className="rounded-full bg-primary px-2 text-primary-foreground">
              {unread} new
            </Badge>
          )}
        </CardTitle>
        <Link to="/settings" className="text-xs font-semibold text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="grid min-h-[252px] grid-cols-[minmax(0,1fr)_132px] gap-3 px-4 py-3">
        <div className="min-w-0">
          {items.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">
              No notifications have been sent to this shop yet.
            </p>
          )}
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-2.5 border-b border-border/70 py-3 last:border-0"
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${index % 2 ? "bg-primary/15 text-primary" : "bg-secondary/15 text-secondary"}`}
              >
                <Bell className="h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {item.notification?.title ?? "Announcement"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.notification?.message ?? "No message"}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {item.notification?.created_at
                    ? new Date(item.notification.created_at).toLocaleString()
                    : ""}
                </span>
              </span>
              {!item.read_at && (
                <span
                  className="live-dot mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                  aria-label="Unread"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-muted">
            <img
              src="/tv-promo.jpg"
              alt="Good tires, brighter tomorrows"
              className="h-full w-full object-cover"
            />
          </div>
          <Button asChild variant="outline" className="mt-2 h-9 rounded-xl text-xs">
            <Link to="/tv">
              <Monitor className="mr-1.5 h-3.5 w-3.5" />
              Open TV mode
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MechanicProductivityPanel({ mechanics }: { mechanics: DashboardMechanics }) {
  return (
    <Card className="min-w-0 rounded-2xl border-border/90 bg-card shadow-card panel-glow-profit">
      <CardHeader className="flex-row items-center justify-between gap-2 px-4 py-3">
        <CardTitle className="flex items-center gap-2 font-body text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground">
            <Wrench className="h-4 w-4" />
          </span>
          Mechanic productivity
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">Production % by reporting period</span>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="overflow-hidden rounded-xl border border-border/70">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/55 text-muted-foreground">
              <tr className="h-11">
                <th className="px-3 py-2 text-left text-xs font-medium">Mechanic</th>
                <th className="px-2 py-2 text-right text-xs font-medium">Prev day</th>
                <th className="px-2 py-2 text-right text-xs font-medium">This wk</th>
                <th className="px-3 py-2 text-right text-xs font-medium">Month</th>
              </tr>
            </thead>
            <tbody>
              {mechanics.names.map((name, index) => {
                const value = mechanics.month[name];
                const numeric =
                  typeof value === "number" && Number.isFinite(value)
                    ? Math.max(0, Math.min(100, value))
                    : null;
                return (
                  <tr key={name} className="border-t border-border/70">
                    <th className="px-3 py-3.5 text-left font-semibold">
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index % 2 ? "bg-primary/15 text-primary" : "bg-secondary/15 text-secondary"}`}
                        >
                          {name.slice(0, 1)}
                        </span>
                        <span className="truncate text-sm">{name}</span>
                      </span>
                    </th>
                    <td className="px-2 py-3.5 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {formatProductivity(mechanics.previous_day[name] ?? null)}
                    </td>
                    <td className="px-2 py-3.5 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {formatProductivity(mechanics.week[name] ?? null)}
                    </td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                      <span className="block text-sm">{formatProductivity(value ?? null)}</span>
                      {numeric !== null && (
                        <span className="gauge-fill mt-1.5 ml-auto block h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <span
                            className={`block h-full rounded-full ${index % 2 ? "bg-primary" : "bg-secondary"}`}
                            style={{ width: `${numeric}%` }}
                          />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemSettingsPanel() {
  const tiles = [
    {
      label: "Shop info",
      description: "Hours, address and contacts",
      icon: CircleUserRound,
      to: "/settings",
    },
    {
      label: "Integrations",
      description: "TireShop, accounting and more",
      icon: Link2,
      to: "/settings",
    },
    { label: "Display & devices", description: "TV mode and computers", icon: Monitor, to: "/tv" },
    {
      label: "Hank settings",
      description: "AI preferences and shortcuts",
      icon: Settings,
      to: "/settings",
    },
  ] as const;
  return (
    <Card className="min-w-0 rounded-2xl border-border/90 bg-card shadow-card panel-glow-steel">
      <CardHeader className="flex-row items-center justify-between gap-2 px-4 py-3">
        <CardTitle className="flex items-center gap-2 font-body text-base font-semibold">
          <Settings className="h-5 w-5 text-foreground" />
          System settings
        </CardTitle>
        <Link to="/settings" className="text-xs font-semibold text-primary hover:underline">
          Open settings
        </Link>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.label}
              to={tile.to}
              className="rounded-xl border border-border/70 bg-muted/35 p-3 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
            >
              <Icon className="mb-2 h-5 w-5 text-foreground" />
              <span className="block text-sm font-semibold">{tile.label}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                {tile.description}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
