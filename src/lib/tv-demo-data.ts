import type { TvBoardJob } from "./tv-board";
import type { TvAnnouncement } from "@/components/tv/tv-announcement-card";
import type { useDashboard } from "@/routes/_authenticated/hub";

/**
 * Synthetic data for the /tv-demo preview route only — never used by the real
 * /tv board. Every name is an obvious placeholder ("DEMO — ...") so nobody
 * mistakes it for a real customer, and every time is computed relative to
 * `now`/the shop's current day so the demo keeps making sense on any date.
 */

export const DEMO_TIMEZONE = "America/Chicago";

type DashboardData = NonNullable<ReturnType<typeof useDashboard>["data"]>;

const minutes = (n: number) => n * 60_000;
const hours = (n: number) => n * 60 * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** In Shop / Upcoming / Done customer cards — covers every note-label combination. */
export function buildDemoNextUp(now: number): TvBoardJob[] {
  return [
    {
      id: "demo-in-shop-1",
      customer_name: "DEMO — Waiting Wendy",
      vehicle_label: "2021 Honda CR-V",
      requested_service: "W tire install",
      appointment_at: iso(now - hours(1)),
      arrival_at: iso(now - minutes(42)),
      job_status: "Servicing",
      local_status: null,
    },
    {
      id: "demo-in-shop-2",
      customer_name: "DEMO — Dropoff Dana",
      vehicle_label: "2019 Subaru Outback",
      requested_service: "DO: dropped at 7am · wheel alignment",
      appointment_at: iso(now - hours(2)),
      arrival_at: iso(now - minutes(95)),
      job_status: "Servicing",
      local_status: null,
    },
    {
      id: "demo-in-shop-3",
      customer_name: "DEMO — Twolabel Tia",
      vehicle_label: "2023 Ford F-150",
      requested_service: "W TO tire install",
      appointment_at: iso(now - minutes(20)),
      arrival_at: iso(now - minutes(12)),
      job_status: "Servicing",
      local_status: null,
    },
    {
      id: "demo-upcoming-1",
      customer_name: "DEMO — Dropoff-Tire Dan",
      vehicle_label: "2018 Toyota Camry",
      requested_service: "DO TO customer waiting on tires · brake pads front",
      appointment_at: iso(now + hours(1)),
      arrival_at: null,
      job_status: "Scheduled",
      local_status: null,
    },
    {
      id: "demo-upcoming-2",
      customer_name: "DEMO — Unmarked Uma",
      vehicle_label: "2020 Mazda CX-5",
      requested_service: "Regular tire rotation, no notes",
      appointment_at: iso(now + hours(2)),
      arrival_at: null,
      job_status: "Scheduled",
      local_status: null,
    },
    {
      id: "demo-upcoming-3",
      customer_name: "DEMO — Falsepositive Fred",
      vehicle_label: "2017 Chevrolet Equinox",
      requested_service: "Wheel bearing noise reported · DOOR seal check · 60 point inspection",
      appointment_at: iso(now + hours(3)),
      arrival_at: null,
      job_status: "Scheduled",
      local_status: null,
    },
    {
      id: "demo-upcoming-4",
      customer_name: "DEMO — Flatty Frank",
      vehicle_label: "2016 Nissan Altima",
      requested_service: "Flat repair, punctured sidewall",
      appointment_at: iso(now + hours(4)),
      arrival_at: null,
      job_status: "Scheduled",
      local_status: null,
    },
    {
      id: "demo-done-1",
      customer_name: "DEMO — Conflict Cole",
      vehicle_label: "2015 GMC Sierra",
      requested_service: "W diagnostic complete · DO customer picked up already",
      appointment_at: iso(now - hours(4)),
      arrival_at: iso(now - hours(5)),
      job_status: "Completed",
      local_status: null,
    },
    {
      id: "demo-done-2",
      customer_name: "DEMO — Finished Fiona",
      vehicle_label: "2022 Kia Sportage",
      requested_service: "Full synthetic oil change",
      appointment_at: iso(now - hours(3)),
      arrival_at: iso(now - hours(4)),
      job_status: "Completed",
      local_status: null,
    },
    {
      id: "demo-done-3",
      customer_name: "DEMO — Rotated Rosa",
      vehicle_label: "2019 Jeep Cherokee",
      requested_service: "Tire rotation and inspection",
      appointment_at: iso(now - hours(6)),
      arrival_at: iso(now - hours(7)),
      job_status: "Closed",
      local_status: null,
    },
  ];
}

/** Done column is a separate list on the real board — same status, own array here. */
export function buildDemoDone(now: number): TvBoardJob[] {
  return buildDemoNextUp(now).filter(
    (job) => job.job_status === "Completed" || job.job_status === "Closed",
  );
}

/** Today's Schedule panel — appointment times spread across the rest of the shop day. */
export function buildDemoSchedule(now: number): TvBoardJob[] {
  return [
    {
      id: "demo-schedule-1",
      customer_name: "DEMO — Schedule Sam",
      vehicle_label: "2021 Toyota RAV4",
      requested_service: "TO no mount needed, drop and go",
      appointment_at: iso(now + minutes(45)),
      arrival_at: null,
      job_status: null,
      local_status: null,
    },
    {
      id: "demo-schedule-2",
      customer_name: "DEMO — Schedule Shay",
      vehicle_label: "2020 Chevrolet Malibu",
      requested_service: "DO: early drop, key in lockbox",
      appointment_at: iso(now + hours(2)),
      arrival_at: iso(now - minutes(10)),
      job_status: "Servicing",
      local_status: null,
    },
    {
      id: "demo-schedule-3",
      customer_name: "DEMO — Schedule Wren",
      vehicle_label: "2018 Honda Accord",
      requested_service: "DO TO please call before starting",
      appointment_at: iso(now + hours(3.5)),
      arrival_at: null,
      job_status: null,
      local_status: null,
    },
    {
      id: "demo-schedule-4",
      customer_name: "DEMO — Schedule Nadia",
      vehicle_label: "2022 Hyundai Tucson",
      requested_service: "Wheel alignment",
      appointment_at: iso(now + hours(5)),
      arrival_at: null,
      job_status: null,
      local_status: null,
    },
  ];
}

export function buildDemoAnnouncements(): TvAnnouncement[] {
  return [
    {
      id: "demo-announcement-1",
      notification: {
        title: "DEMO — Half-day Friday",
        message: "Shop closes at noon for the team lunch. (Synthetic example.)",
        priority: "normal",
      },
    },
    {
      id: "demo-announcement-2",
      notification: {
        title: "DEMO — Lift 3 offline",
        message: "Parts on order — back up tomorrow morning. (Synthetic example.)",
        priority: "high",
      },
    },
  ];
}

const coverage = (days: number) => ({ days_with_value: days, days_missing_value: 0 });
const periodMeta = (asOf: string) =>
  ({ basis: "cumulative-snapshot", as_of: asOf, stale: false, days_behind: 0 }) as const;

export function buildDemoDashboard(now: number): DashboardData {
  const today = new Date(now).toISOString().slice(0, 10);
  const weekFrom = new Date(now - 6 * 86_400_000).toISOString().slice(0, 10);
  return {
    shop: { id: "demo-shop", name: "DEMO Shop", timezone: DEMO_TIMEZONE, role: "owner" },
    today,
    todayRow: null,
    previousDay: today,
    previousDayRow: {
      business_date: today,
      scope: "daily",
      gross_profit: 2150,
      tires_sold: 14,
      car_count: 9,
      created_at: iso(now),
      source: "manual",
    },
    previousDayProductivity: 84,
    mechanics: {
      names: ["Dale", "Josh", "Teagen"],
      previous_day: { Dale: 91, Josh: 78, Teagen: 88 },
      week: { Dale: 89, Josh: 82, Teagen: 90 },
      month: { Dale: 87, Josh: 85, Teagen: 91 },
    },
    week: {
      from: weekFrom,
      through: today,
      gross_profit: 12800,
      tires_sold: 61,
      car_count: 42,
      gp_per_car: 12800 / 42,
      mechanic_productivity: 87,
      goals: { gross_profit: 15000, tires_sold: 70, car_count: 50, mechanic_productivity: 90 },
    },
    mtd: {
      gross_profit: 48000,
      tires_sold: 240,
      car_count: 165,
      gp_per_car: 48000 / 165,
      gp_per_car_note: null,
      covered_days: 18,
      missing_days: 0,
      coverage: {
        gross_profit: coverage(18),
        tires_sold: coverage(18),
        car_count: coverage(18),
      },
      ...periodMeta(today),
      mechanic_productivity: 88,
      mechanic_productivity_goal: 90,
    },
    ytd: {
      gross_profit: 410000,
      tires_sold: 2100,
      car_count: 1450,
      gp_per_car: 410000 / 1450,
      gp_per_car_note: null,
      covered_days: 178,
      missing_days: 2,
      coverage: {
        gross_profit: coverage(178),
        tires_sold: coverage(178),
        car_count: coverage(178),
      },
      ...periodMeta(today),
    },
    ytdLastYear: {
      gross_profit: 380000,
      tires_sold: 1980,
      car_count: 1390,
      gp_per_car: 380000 / 1390,
      gp_per_car_note: null,
      covered_days: 250,
      missing_days: 0,
      coverage: {
        gross_profit: coverage(250),
        tires_sold: coverage(250),
        car_count: coverage(250),
      },
      ...periodMeta(today),
    },
    monthly: [],
    lastUpdate: iso(now),
    recent: [],
  };
}
