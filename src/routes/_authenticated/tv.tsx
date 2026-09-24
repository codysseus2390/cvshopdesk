import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccessGate } from "@/components/access-gate";
import { TvBackground } from "@/components/tv/tv-background";
import "@/components/tv/tv-numbers.css";
import { TvNumbersHeader } from "@/components/tv/tv-numbers-header";
import { TvNumbersFooter } from "@/components/tv/tv-numbers-footer";
import { TvHeader } from "@/components/tv/tv-header";
import { TvNumbersScreen } from "@/components/tv/tv-numbers-screen";
import { TvShopScreen } from "@/components/tv/tv-shop-screen";
import { TvStatusBar } from "@/components/tv/tv-status-bar";
import { cn } from "@/lib/utils";
import { useDashboard } from "./hub";
import { useBoard } from "./board";
import { buildTvBoard } from "@/lib/tv-board";
import { listDisplayNotifications } from "@/lib/notifications.functions";

/** Each screen's time on air before rotating to the next. */
export const SCREEN_SECONDS = 18;

/** Which screen is showing after `elapsed` seconds: numbers, then shop, repeating. */
export function screenAt(elapsedSeconds: number): "numbers" | "shop" {
  return Math.floor(elapsedSeconds / SCREEN_SECONDS) % 2 === 0 ? "numbers" : "shop";
}

export const Route = createFileRoute("/_authenticated/tv")({
  head: () => ({
    meta: [
      { title: "TV mode — Cedar Valley Hub" },
      {
        name: "description",
        content: "Staff-only shop command board: rotating shop numbers and today's job board.",
      },
      { property: "og:title", content: "TV mode — Cedar Valley Hub" },
      { property: "og:description", content: "Full screen staff display." },
    ],
  }),
  component: () => (
    <AccessGate>
      <TvMode />
    </AccessGate>
  ),
});

function TvMode() {
  const dashboard = useDashboard();
  const board = useBoard();
  const fetchAnnouncements = useServerFn(listDisplayNotifications);
  const announcements = useQuery({
    queryKey: ["display-notifications"],
    queryFn: () => fetchAnnouncements(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
  });
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!paused) setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  const screen = screenAt(elapsed);
  const Header = screen === "numbers" ? TvNumbersHeader : TvHeader;
  const Footer = screen === "numbers" ? TvNumbersFooter : TvStatusBar;

  const tvBoard = board.data ? buildTvBoard(board.data, now) : null;
  const counts = tvBoard?.counts ?? { inShop: 0, upcoming: 0, done: 0 };
  const problem =
    dashboard.error instanceof Error
      ? dashboard.error.message
      : board.error instanceof Error
        ? board.error.message
        : (board.data?.workflowError ?? board.data?.appointmentError ?? null);
  const staleMinutes = Math.round(
    (Date.now() - Math.min(dashboard.dataUpdatedAt, board.dataUpdatedAt)) / 60_000,
  );
  const stale = Boolean(dashboard.dataUpdatedAt && board.dataUpdatedAt && staleMinutes >= 5);
  const alert = problem
    ? `Screen not updating: ${problem}`
    : stale
      ? `Numbers may be behind — no refresh for ${staleMinutes} min`
      : null;

  return (
    <div
      className={cn(
        "dark relative flex h-screen flex-col overflow-hidden bg-background text-foreground",
        screen === "numbers" ? "tv-numbers-mode" : "tv-display",
      )}
      data-paused={paused}
    >
      {screen === "shop" && <TvBackground />}

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <Header
          title={screen === "numbers" ? "Shop numbers" : "Today's shop"}
          timezone={board.data?.timezone}
          alert={alert}
        />

        <main className="tv-main flex min-h-0 flex-1 flex-col gap-4">
          {(announcements.data?.length ?? 0) > 0 && (
            <div className="tv-announcements flex shrink-0 gap-4">
              {(announcements.data ?? []).slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "tv-announcement tv-slab flex-1 rounded-2xl border border-border border-l-[6px] px-5 py-3.5",
                    item.notification?.priority === "high"
                      ? "border-l-destructive"
                      : "border-l-primary",
                  )}
                >
                  <p className="font-display text-xl font-bold text-[#fffdf8]">
                    {item.notification?.title}
                  </p>
                  <p className="mt-0.5 text-base text-muted-foreground">
                    {item.notification?.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="tv-screen-stage">
            <div
              className="tv-screen"
              data-active={screen === "numbers"}
              aria-hidden={screen !== "numbers"}
              inert={screen !== "numbers"}
            >
              <TvNumbersScreen dashboard={dashboard.data} />
            </div>
            <div
              className="tv-screen"
              data-active={screen === "shop"}
              aria-hidden={screen !== "shop"}
              inert={screen !== "shop"}
            >
              <TvShopScreen
                rows={tvBoard?.schedule ?? []}
                nextUp={tvBoard?.nextUp ?? []}
                done={board.data?.done ?? []}
                timezone={board.data?.timezone ?? "America/Chicago"}
                now={now}
                paused={paused || screen !== "shop"}
              />
            </div>
            <div key={screen} className="tv-transition-sweep" aria-hidden="true" />
          </div>
          <div className="tv-controls flex gap-1 rounded-md bg-background/90 p-1 text-xs text-muted-foreground">
            <button
              type="button"
              className="rounded px-2 py-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={
                paused ? "Resume TV rotation and scrolling" : "Pause TV rotation and scrolling"
              }
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Next TV screen"
              onClick={() =>
                setElapsed((value) => (Math.floor(value / SCREEN_SECONDS) + 1) * SCREEN_SECONDS)
              }
            >
              Next screen ›
            </button>
          </div>
        </main>

        <Footer
          inShop={counts.inShop}
          upcoming={counts.upcoming}
          done={counts.done}
          nextAppointment={tvBoard?.nextAppointment ?? null}
        />
      </div>
    </div>
  );
}
