import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AccessGate } from "@/components/access-gate";
import { TvBackground } from "@/components/tv/tv-background";
import { TvHeader } from "@/components/tv/tv-header";
import { TvNumbersScreen } from "@/components/tv/tv-numbers-screen";
import { TvShopScreen } from "@/components/tv/tv-shop-screen";
import { TvStatusBar } from "@/components/tv/tv-status-bar";
import { TvAnnouncementCard } from "@/components/tv/tv-announcement-card";
import { TvDemoBanner } from "@/components/tv/tv-demo-banner";
import { isProductionDeploy } from "@/lib/deploy-env";
import { tvTime, workflowStatus, type TvBoardJob } from "@/lib/tv-board";
import {
  DEMO_TIMEZONE,
  buildDemoAnnouncements,
  buildDemoDashboard,
  buildDemoDone,
  buildDemoNextUp,
  buildDemoSchedule,
} from "@/lib/tv-demo-data";
import { TV_ROTATION_SECONDS_DEFAULT } from "@/lib/tv-settings";
import { screenAt } from "./tv";

export const Route = createFileRoute("/_authenticated/tv-demo")({
  head: () => ({
    meta: [
      { title: "TV mode demo — Cedar Valley Hub" },
      {
        name: "description",
        content: "Preview-only walkthrough of every TV Mode panel with synthetic example data.",
      },
    ],
  }),
  // Preview/local only — a real Production deploy 404s here, same as a route that
  // doesn't exist. See vite.config.ts (VITE_DEPLOY_ENV) / lib/deploy-env.ts.
  beforeLoad: () => {
    if (isProductionDeploy()) throw notFound();
  },
  component: () => (
    <AccessGate>
      <TvDemoMode />
    </AccessGate>
  ),
});

function nextAppointmentLabel(schedule: TvBoardJob[], now: number): string | null {
  const next = schedule
    .filter(
      (job) =>
        job.arrival_at === null && job.appointment_at && Date.parse(job.appointment_at) >= now,
    )
    .sort((a, b) => (a.appointment_at ?? "").localeCompare(b.appointment_at ?? ""))[0];
  return next ? tvTime(next.appointment_at, DEMO_TIMEZONE) : null;
}

function TvDemoMode() {
  // Generated once per visit so appointment/check-in offsets stay stable while the
  // clock and elapsed timers keep ticking, same as the real board's live data would.
  const [generatedAt] = useState(() => Date.now());
  const nextUp = useMemo(() => buildDemoNextUp(generatedAt), [generatedAt]);
  const done = useMemo(() => buildDemoDone(generatedAt), [generatedAt]);
  const schedule = useMemo(() => buildDemoSchedule(generatedAt), [generatedAt]);
  const announcements = useMemo(() => buildDemoAnnouncements(), []);
  const dashboard = useMemo(() => buildDemoDashboard(generatedAt), [generatedAt]);

  const screenSeconds = TV_ROTATION_SECONDS_DEFAULT;
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

  const screen = screenAt(elapsed, screenSeconds);
  const counts = {
    inShop: nextUp.filter((job) => workflowStatus(job) === "in_shop").length,
    upcoming: nextUp.filter((job) => workflowStatus(job) === "upcoming").length,
    done: done.length,
  };

  return (
    <div
      className="tv-display dark relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
      data-paused={paused}
    >
      <TvBackground />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <TvDemoBanner />
        <TvHeader
          title={screen === "numbers" ? "Shop numbers" : "Today's shop"}
          timezone={DEMO_TIMEZONE}
          alert={null}
        />

        <main className="tv-main flex min-h-0 flex-1 flex-col gap-4">
          <div className="tv-announcements flex shrink-0 gap-4">
            {announcements.map((item) => (
              <TvAnnouncementCard key={item.id} item={item} />
            ))}
          </div>

          <div className="tv-screen-stage">
            <div
              className="tv-screen"
              data-active={screen === "numbers"}
              aria-hidden={screen !== "numbers"}
              inert={screen !== "numbers"}
            >
              <TvNumbersScreen dashboard={dashboard} />
            </div>
            <div
              className="tv-screen"
              data-active={screen === "shop"}
              aria-hidden={screen !== "shop"}
              inert={screen !== "shop"}
            >
              <TvShopScreen
                rows={schedule}
                nextUp={nextUp}
                done={done}
                timezone={DEMO_TIMEZONE}
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
                setElapsed((value) => (Math.floor(value / screenSeconds) + 1) * screenSeconds)
              }
            >
              Next screen ›
            </button>
          </div>
        </main>

        <TvStatusBar
          inShop={counts.inShop}
          upcoming={counts.upcoming}
          done={counts.done}
          nextAppointment={nextAppointmentLabel(schedule, now)}
        />
      </div>
    </div>
  );
}
