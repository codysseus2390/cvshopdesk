/**
 * Regression checks for reviewed record acceptance and the shop-floor board.
 *
 * Two layers, as elsewhere in this app:
 *  - unit tests for the pure row/board rules;
 *  - checks against the live database that the acceptance function itself still
 *    says what it must (the sandbox database role cannot create signed-in users,
 *    so transactional guards are asserted by definition, not by replay).
 */
import { describe, expect, it, afterAll } from "vitest";
import postgres from "postgres";
import {
  isFinishedJob,
  normalizeCustomerRows,
  normalizeInventoryRows,
  normalizeJobRows,
  parseNumericField,
  splitBoard,
} from "./import-records";
import { SCREEN_SECONDS, screenAt } from "@/routes/_authenticated/tv";

describe("unreadable numeric data", () => {
  it("keeps N/A and dashes null and flags them, never zero", () => {
    for (const raw of ["N/A", "n/a", "-", "—", "?", "unknown"]) {
      expect(parseNumericField(raw)).toEqual({ value: null, unreadable: true });
    }
  });

  it("keeps a blank cell null without calling it unreadable", () => {
    expect(parseNumericField("")).toEqual({ value: null, unreadable: false });
    expect(parseNumericField(null)).toEqual({ value: null, unreadable: false });
  });

  it("reads real numbers, including currency and bracketed negatives", () => {
    expect(parseNumericField("$1,234.50").value).toBe(1234.5);
    expect(parseNumericField("(50)").value).toBe(-50);
    expect(parseNumericField(0).value).toBe(0);
  });

  it("refuses text that is not a number", () => {
    expect(parseNumericField("about 40").unreadable).toBe(true);
  });

  it("carries the null through to a saved inventory row", () => {
    const [row] = normalizeInventoryRows(
      [{ external_id: "T-1", description: "Tire", quantity: "N/A" }],
      "imp",
    );
    expect(row!.quantity).toBeNull();
    expect(row!.flags).toContain("quantity unreadable");
    expect(row!.needs_review).toBe(true);
  });
});

describe("durable row identity", () => {
  it("uses the TireShop identifier when the file prints one", () => {
    const [row] = normalizeInventoryRows([{ sku: "P225", description: "Tire" }], "imp-1");
    expect(row!.identity_key).toBe("ext:P225");
    expect(row!.needs_review).toBe(false);
  });

  it("gives rows without an identifier a durable import-row key and flags them", () => {
    const [row] = normalizeJobRows([{ customer: "Jane Doe" }], "imp-1");
    expect(row!.identity_key).toBe("import:imp-1:row:0");
    expect(row!.needs_review).toBe(true);
    expect(row!.flags.join(" ")).toContain("no TireShop record id");
  });

  it("never matches on the customer name, so a retry updates instead of duplicating", () => {
    const items = [{ customer: "Jane Doe" }, { customer: "Jane Doe" }];
    const first = normalizeJobRows(items, "imp-1").map((r) => r.identity_key);
    const retry = normalizeJobRows(items, "imp-1").map((r) => r.identity_key);
    expect(first).toEqual(retry);
    expect(new Set(first).size).toBe(2);
  });

  it("keys customer vehicles without inventing a shared identity", () => {
    const [row] = normalizeCustomerRows(
      [{ name: "Jane Doe", make: "Ford", model: "F-150" }],
      "imp-1",
    );
    expect(row!.identity_key).toBe("import:imp-1:row:0");
    expect(row!.vehicle_identity_key).toBe("import:imp-1:vehicle:0");
  });
});

describe("arrival times", () => {
  it("leaves arrival unknown when the file does not print one", () => {
    const [row] = normalizeJobRows(
      [{ external_id: "RO1", appointment_at: "2026-09-11T14:00:00Z" }],
      "imp",
    );
    expect(row!.arrival_at).toBeNull();
    expect(row!.appointment_at).not.toBeNull();
  });

  it("flags an arrival value it cannot read instead of guessing", () => {
    const [row] = normalizeJobRows(
      [{ external_id: "RO1", arrival_at: "sometime this morning" }],
      "imp",
    );
    expect(row!.arrival_at).toBeNull();
    expect(row!.flags).toContain("arrival time unreadable");
  });
});

const now = new Date("2026-09-11T15:00:00Z").getTime();
const job = (over: Record<string, unknown>) => ({
  id: String(over["id"] ?? Math.random()),
  record_kind: "job",
  arrival_at: null,
  appointment_at: null,
  snapshot_at: "2026-09-11T14:55:00Z",
  job_status: null,
  local_status: null,
  ...over,
});

describe("board filtering", () => {
  it("drops finished jobs and keeps ones with no status at all", () => {
    expect(isFinishedJob({ job_status: "Completed" })).toBe(true);
    expect(isFinishedJob({ job_status: "Picked up" })).toBe(true);
    expect(isFinishedJob({ local_status: "closed" })).toBe(true);
    expect(isFinishedJob({ job_status: null })).toBe(false);
    expect(isFinishedJob({ job_status: "Waiting on parts" })).toBe(false);
  });

  it("shows unfinished jobs oldest arrival first, unknown arrivals kept separate", () => {
    const split = splitBoard(
      [
        job({ id: "late", arrival_at: "2026-09-11T13:00:00Z" }),
        job({ id: "early", arrival_at: "2026-09-11T08:00:00Z" }),
        job({ id: "unknown" }),
        job({ id: "done", arrival_at: "2026-09-11T07:00:00Z", job_status: "Completed" }),
      ],
      now,
    );
    expect(split.jobs.map((j) => j.id)).toEqual(["early", "late"]);
    expect(split.jobsWithoutArrival.map((j) => j.id)).toEqual(["unknown"]);
    // The snapshot time is never used as a stand-in arrival.
    expect(split.jobsWithoutArrival[0]!.arrival_at).toBeNull();
  });

  it("keeps only upcoming appointments and separates ones with no time", () => {
    const split = splitBoard(
      [
        job({ id: "past", record_kind: "appointment", appointment_at: "2026-09-11T09:00:00Z" }),
        job({ id: "soon", record_kind: "appointment", appointment_at: "2026-09-11T16:00:00Z" }),
        job({ id: "later", record_kind: "appointment", appointment_at: "2026-09-11T17:30:00Z" }),
        job({ id: "notime", record_kind: "appointment" }),
      ],
      now,
    );
    expect(split.appointments.map((a) => a.id)).toEqual(["soon", "later"]);
    expect(split.appointmentsWithoutTime.map((a) => a.id)).toEqual(["notime"]);
  });

  it("leaves 'done' empty when no shop day is given, for backward compatibility", () => {
    const split = splitBoard(
      [job({ id: "done", arrival_at: "2026-09-11T07:00:00Z", job_status: "Completed" })],
      now,
    );
    expect(split.done).toEqual([]);
  });

  it("anchors 'done' to today's shop day by arrival time, falling back to appointment time", () => {
    const split = splitBoard(
      [
        job({ id: "done-today", arrival_at: "2026-09-11T15:00:00Z", job_status: "Completed" }),
        job({ id: "done-yesterday", arrival_at: "2026-09-10T15:00:00Z", job_status: "Completed" }),
        job({
          id: "done-appt-only",
          record_kind: "appointment",
          appointment_at: "2026-09-11T09:00:00Z",
          job_status: "Cancelled",
        }),
        job({ id: "still-open", arrival_at: "2026-09-11T15:00:00Z" }),
      ],
      now,
      { date: "2026-09-11", timezone: "UTC" },
    );
    expect(split.done.map((d) => d.id).sort()).toEqual(["done-appt-only", "done-today"]);
  });
});

describe("TV rotation", () => {
  it("alternates the two screens every SCREEN_SECONDS", () => {
    expect(SCREEN_SECONDS).toBeGreaterThan(0);
    expect(screenAt(0)).toBe("numbers");
    expect(screenAt(SCREEN_SECONDS - 1)).toBe("numbers");
    expect(screenAt(SCREEN_SECONDS)).toBe("shop");
    expect(screenAt(SCREEN_SECONDS * 2 - 1)).toBe("shop");
    expect(screenAt(SCREEN_SECONDS * 2)).toBe("numbers");
  });
});

const url = process.env["SUPABASE_DB_URL"];
const sql = url ? postgres(url, { max: 1, prepare: false }) : null;
const dbTest = url ? describe : describe.skip;

afterAll(async () => {
  await sql?.end();
});

dbTest("live acceptance rules", () => {
  async function definition(name: string) {
    const rows = await sql!<{ def: string }[]>`
      select pg_get_functiondef(p.oid) as def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = ${name}`;
    return rows[0]?.def ?? "";
  }

  it("runs record acceptance in one guarded transaction", async () => {
    const def = await definition("accept_import_records");
    expect(def).toBeTruthy();
    expect(def.toLowerCase()).toContain("security definer");
    // The import row is locked, so two devices cannot accept the same file at once.
    expect(def.toLowerCase()).toContain("for update");
    expect(def.toLowerCase()).toContain("has_shop_access");
    expect(def.toLowerCase()).toContain("auth.uid()");
  });

  it("refuses an import that was already accepted or rejected", async () => {
    const def = (await definition("accept_import_records")).toLowerCase();
    expect(def).toContain("has already been accepted");
    expect(def).toContain("cannot be accepted");
  });

  it("never deletes records, so a partial import cannot close or drop jobs", async () => {
    const def = (await definition("accept_import_records")).toLowerCase();
    expect(def).not.toContain("delete from");
    expect(def).not.toContain("truncate");
  });

  it("keeps the previous job snapshot and carries staff notes forward", async () => {
    const def = (await definition("accept_import_records")).toLowerCase();
    expect(def).toContain("superseded_by");
    expect(def).toContain("v_prev.local_note");
    expect(def).toContain("v_prev.local_status");
  });

  it("locks an accepted import against reopening", async () => {
    const def = (await definition("guard_import_status")).toLowerCase();
    expect(def).toContain("cannot be reopened");
    const triggers = await sql!<{ tgname: string }[]>`
      select tgname from pg_trigger
      where tgrelid = 'public.imports'::regclass and not tgisinternal`;
    expect(triggers.map((t) => t.tgname)).toContain("imports_status_guard");
  });

  it("only lets signed-in staff run acceptance", async () => {
    const [grants] = await sql!<{ acl: string | null }[]>`
      select array_to_string(p.proacl, ' ') as acl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'accept_import_records'`;
    expect(grants?.acl ?? "").toContain("authenticated=X");
    expect(grants?.acl ?? "").not.toContain("anon=X");
  });

  it("keeps one current snapshot per record identity", async () => {
    const rows = await sql!<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where schemaname = 'public' and indexname = 'shop_jobs_current_identity'`;
    expect(rows[0]?.indexdef ?? "").toContain("identity_key");
    expect(rows[0]?.indexdef ?? "").toContain("is_current");
  });
});
