# Astra Phase 1–2 UI diff list — seven calendar/permission items (P12-06)

Prepared by Cedar. Compared: source at the P12-06 worktree tip (post P12-03 merge — `calendarConfigured`,
`previousDayKind`, `resolveShopTimeZone`/`isValidTimeZone` confirmed present in `src/lib/metrics.functions.ts`,
`src/lib/numbers.server.ts`, `src/lib/timezone.ts`, `src/lib/calendar.server.ts`, `src/lib/admin.functions.ts`).
Figma: page **Dashboard — Reference review**, frames **Reference — sample data** and
**Desktop / Editable dashboard / Sample data** (the two frames that exist on that page).

**Figma access result:** tools worked (`get_metadata` returned both frames' full node trees). Neither frame
contains a closed-day state, a "Previous open day" variant, a business-calendar settings screen, a TV-clock
neutral state, or a NotificationComposer/Hank-clear disabled state — the only matches for "Previous" are the
existing plain "Previous day" KPI/support-row text nodes (already catalogued in `docs/hub-figma-diff.md` #17),
and the only matches for "Calendar" are the monthly chart's grid rectangles, unrelated to the business
calendar. **None of the seven items are new screens** (no new frame needed, no gate triggered) — every one is
a copy correction, a conditional label, a badge, or a permission-gated disabled/hidden state layered on an
**existing** screen, using **existing** components and tokens per Bay's redlines and the a/b/c contract. Basing
this list on code + `bay-phase1-2.md`, not on invented Figma content.

**Tokens (law):** oil black `#0B0B0C` · warm paper `#F3EEE6` · cedar flame `#F2581A` · stone muted `#9C968C`
(= `--muted-foreground` in `src/styles.css:80`, exact hex match).

---

## 1. Numbered diff list

### Item 1 — "Previous day" → "Previous open day · [date]" (legacy label only when calendar not configured)

Gate on the dashboard payload's own fields (already returned by `getDashboard`,
`src/lib/metrics.functions.ts:245-247`): `calendarConfigured: boolean`, `previousDayKind: "open" | "calendar"`
(`"open"` = calendar configured, real previous-open-day math ran; `"calendar"` = no calendar, legacy plain
previous-calendar-day). Never invert this — `"calendar"` is the *legacy* branch despite the name.

1.1 **`src/routes/_authenticated/hub.tsx:115`** (KPI supporting-row label, inside `kpiProps`)
- Old: `label: "Previous day",`
- New:
  ```ts
  label:
    data?.previousDayKind === "open"
      ? `Previous open day · ${prevDayLabel}`
      : "Previous day",
  ```
  `prevDayLabel` already exists in scope (hub.tsx:83-89, `"September 16"` style). No format change — only the
  gated prefix.

1.2 **`src/routes/_authenticated/hub.tsx:200`** (date-row pill, next to the week range)
- Old: `<span>{prevDayLabel ? \`Previous day ${prevDayLabel}\` : "Previous day"}</span>`
- New:
  ```tsx
  <span>
    {data.previousDayKind === "open"
      ? `Previous open day · ${prevDayLabel}`
      : prevDayLabel
        ? `Previous day ${prevDayLabel}`
        : "Previous day"}
  </span>
  ```

1.3 **`src/components/dashboard-panels.tsx:218`** (`MechanicProductivityPanel` table header — no date shown
here, it's a column header, not a value)
- Old: `<th className="px-2 py-2 text-right text-xs font-medium">Prev day</th>`
- New: `<th className="px-2 py-2 text-right text-xs font-medium">{calendarConfigured ? "Prev open day" : "Prev day"}</th>`
- **Requires prop threading** (new prop, not a new visual element):
  - `DashboardMiddleRow` (`dashboard-panels.tsx:31`) gains `calendarConfigured: boolean` and passes it to
    `MechanicProductivityPanel` (`dashboard-panels.tsx:39`).
  - `MechanicProductivityPanel` (`dashboard-panels.tsx:200`) accepts and uses the new prop.
  - Call site **`hub.tsx:256`**: `<DashboardMiddleRow mechanics={data.mechanics} />` →
    `<DashboardMiddleRow mechanics={data.mechanics} calendarConfigured={data.calendarConfigured} />`.

1.4 **`src/components/tv/tv-numbers-screen.tsx:64`** (TV has no hover — date must be visible on-screen)
- Old: `previousDay: period("Previous day", metric.values[2], metric.format),`
- New:
  ```ts
  const prevDayLabel = dashboard?.previousDay
    ? new Date(`${dashboard.previousDay}T00:00:00Z`).toLocaleDateString(undefined, {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      })
    : null;
  const prevDayCellLabel =
    dashboard?.previousDayKind === "open" && prevDayLabel
      ? `Prev open day · ${prevDayLabel}`
      : "Previous day";
  // …
  previousDay: period(prevDayCellLabel, metric.values[2], metric.format),
  ```
  Label slot is `text-xs font-bold uppercase tracking-[0.18em]` inside a `grid-cols-2 gap-4` half-width cell
  (`tv-metric-card.tsx:74-76`) — no fixed height, so a longer label wraps to two lines rather than clipping.
  Abbreviated to `Prev open day` (not the full `Previous open day`) specifically for this slot to reduce wrap
  risk; TV-fit verification is Beacon's job (P12-09) per the ticket's own dependency chain — flag it to Beacon
  as a specific watch-item, don't guess the outcome here.

1.5 **`src/routes/_authenticated/entry.tsx:366, 374, 439, 444-445`** — one shared derived label, four sites.
Add near the top of `EntryPage()` (after `mechanicDate` is defined, ~line 102):
```ts
const prevDayWord =
  dashboard.data?.previousDayKind === "open" ? "Previous open day" : "Previous day";
const prevDayWordLower =
  dashboard.data?.previousDayKind === "open" ? "previous open day" : "previous day";
```
- **entry.tsx:366** — Old: `Previous day: {mechanicDate || "Loading…"} · Weekly and monthly use the current`
  New: `{prevDayWord}: {mechanicDate || "Loading…"} · Weekly and monthly use the current`
- **entry.tsx:374** — Old: `label="Previous day %"`
  New: `label={\`${prevDayWord} %\`}`
- **entry.tsx:439** — Old: `<strong>Previous day:</strong> {mechanicDate}`
  New: `<strong>{prevDayWord}:</strong> {mechanicDate}`
- **entry.tsx:444-445** — Old: `<strong>{entry.technician}:</strong> previous day{" "} {formatProductivity(entry.previous_day)} · weekly{" "}`
  New: `<strong>{entry.technician}:</strong> {prevDayWordLower}{" "} {formatProductivity(entry.previous_day)} · weekly{" "}`

No server change needed — `calendarConfigured`/`previousDayKind` already ship on `useDashboard()`'s payload,
which `hub.tsx`, `entry.tsx`, and `tv-numbers-screen.tsx` already consume.

### Item 2 — hub.tsx missing-day copy (Bay's redlines), gated the same way as Item 1

2.1 **`src/routes/_authenticated/hub.tsx:103`** (`monthlyHint`)
- Old: `` `${missing} saved day(s) have no ${field}` ``
- New (only when `data.calendarConfigured`, else keep the old string unchanged — see rationale below):
  ```ts
  const monthlyHint = (key: KpiKey): string | undefined => {
    if (!data) return undefined;
    const missing = data.mtd.coverage[key].days_missing_value;
    const field =
      key === "gross_profit" ? "gross profit" : key === "tires_sold" ? "tire count" : "car count";
    if (missing <= 0) return goalNote(key, data.mtd[key]);
    return data.calendarConfigured
      ? `${field} missing for ${missing} open day(s) this month`
      : `${missing} saved day(s) have no ${field}`;
  };
  ```

2.2 **`src/routes/_authenticated/hub.tsx:138`** (`monthlySummary`, "sum of N confirmed day(s)" branch)
- Old: `` `${data.mtd.missing_days} day(s) still missing` ``
- New: `` data.calendarConfigured ? `${data.mtd.missing_days} open day(s) still missing` : `${data.mtd.missing_days} day(s) still missing` ``

**Why gate on `calendarConfigured` at all:** `data.mtd.missing_days` / `days_missing_value` are computed by
`monthToDate(..., calendarOrUndefined)` (`metrics.functions.ts:168`) — when no calendar exists, "missing" means
every uncounted calendar day, not open days, so saying "open day(s)" for an unconfigured shop would claim
calendar knowledge the shop doesn't have. Keep the legacy string verbatim on that path; only the configured
path gets Bay's open-day wording.

2.3 **Calendar-missing-migration state** (a-case, `CalendarMigrationNotAppliedError`): `getDashboard`'s handler
throws before returning any payload, so `useDashboard()`'s `error` is set and `data` is `undefined` — the
`{data && (...)}` block at hub.tsx:192 never renders, meaning **no KPI numbers show at all**, only the
existing destructive-styled paragraph at hub.tsx:186-190 (`text-destructive`, current pattern, unchanged):
`{error instanceof Error ? error.message : "Could not load."}`. The thrown message already names the cause
explicitly ("Shop calendar unavailable: the database update 0024_business_calendar has not been applied to
this environment.") — **no code change required here**; this already satisfies Bay's concern #8 (never looks
like zeros/a slow day, since zero KPI cards render, only the explanatory text does). Confirmed, no diff item.

2.4 **Unconfigured-calendar state** (b-case, `calendar === null`): `getDashboard` returns normally with
`calendarConfigured: false`, `previousDayKind: "calendar"` — the dashboard renders exactly as it does today
(full KPI grid, legacy "Previous day" wording per Item 1's gate, legacy "day(s)" wording per Item 2.1/2.2's
gate). This is the intended fallback, not a bug — confirmed, no diff item beyond the gating already specified.

### Item 3 — closed-day entry warning in entry.tsx, before Confirm (entry still allowed, date never auto-changed)

**Data need resolved without a server change.** `usePermissions()` (`src/components/use-permissions.ts`)
already calls `getAdminConfig`, which already returns `settings.business_calendar` (the full
`{schedules, exceptions}` object, un-gated by role — only the *write* path is owner-gated) to every
authenticated screen. `src/lib/business-calendar.ts`'s `isOpenDay(date, calendar)` is pure (no server-only
imports — traced through `numbers-math.ts`, also pure) and is already safe to import into a route component.
So: import `usePermissions` and `isOpenDay` into `entry.tsx`, no `*.functions.ts` change needed.

3.1 **`src/routes/_authenticated/entry.tsx`** — add near the top of `EntryPage()`:
```ts
import { usePermissions } from "@/components/use-permissions";
import { isOpenDay } from "@/lib/business-calendar";
// …
const perms = usePermissions();
const calendar = perms.settings?.business_calendar ?? null;
const dateIsClosed = calendar ? isOpenDay(date, calendar) === false : false;
```
(`isOpenDay` returns `null` for a date before the earliest schedule — treated as "unknown", not "closed";
`calendar === null` covers both "unconfigured" and "migration 0024 not applied", both correctly suppress the
warning rather than guessing.)

3.2 Insert the warning in the **Review card**, `stage === "review"` block, immediately after the `</ul>`
summary list closes and before the `<div className="flex gap-2">` Confirm/Back row (~entry.tsx:335-336):
```tsx
{dateIsClosed && (
  <p className="rounded-md border border-border bg-muted p-3 text-sm">
    {date} is marked closed in the shop calendar. This entry will still be saved and counted — it
    just won't count toward missing-day coverage or goal pacing.
  </p>
)}
```
Exact copy per Bay's redline (`bay-phase1-2.md`), date substituted. Reuses the identical box treatment already
used for the "record already exists" notice at entry.tsx:275 (`rounded-md border border-border bg-muted p-3`)
— no new visual language, no new color. Placed inside the review gate so it is the last thing seen before
"Confirm and save"; the Confirm button itself is **not** disabled and the date field is never rewritten —
matches plan.md §4 ("still allow through review/confirm... never auto-change their selected date").

### Item 4 — closed-day entry tag in history.tsx, beside Source/State

4.1 **`src/routes/_authenticated/history.tsx`** — add the same two imports as Item 3
(`usePermissions`, `isOpenDay`; `Badge` is already imported at history.tsx:13). Near the top of
`HistoryPage()`:
```ts
const perms = usePermissions();
const calendar = perms.settings?.business_calendar ?? null;
```

4.2 **`history.tsx:108-114`** (the State `<td>`)
- Old:
  ```tsx
  <td>
    {row.is_current ? <Badge>Current</Badge> : <Badge variant="secondary">Replaced</Badge>}
  </td>
  ```
- New:
  ```tsx
  <td className="space-x-1">
    {row.is_current ? <Badge>Current</Badge> : <Badge variant="secondary">Replaced</Badge>}
    {calendar && isOpenDay(row.business_date, calendar) === false && (
      <Badge variant="secondary">Closed-day entry</Badge>
    )}
  </td>
  ```
  Uses the existing `Badge` `secondary` variant (`border-secondary/25 bg-secondary/15 text-foreground`,
  `badge.tsx:12`) — same tone already used for "Replaced," so a closed-day-tagged row never reads as an error
  or a second competing color. No calendar / unknown-open-status → no tag (never guesses).

### Item 5 — business-calendar-settings.tsx: sort desc, end-bound/"(current)", replace notice, retroactive-confirm flow

**Contract change to account for:** `saveBusinessCalendar` now takes `{ calendar: { schedules, exceptions },
confirmRetroactive? }` (`src/lib/calendar.schema.ts:39-42`), not the flat `{ schedules, exceptions }` the
current component sends (`business-calendar-settings.tsx:28-44`) — this is a breaking payload-shape change
Pixel must make regardless of the copy items below, or every save will fail schema validation.

5.1 **Sort desc + end bound + "(current)"** (`business-calendar-settings.tsx:71-78`)
- Old:
  ```tsx
  {calendar?.schedules.map((s) => (
    <p key={s.effective_from} className="text-sm">
      From {s.effective_from}:{" "}
      {s.open_weekdays.map((day) => [...][day]).join(", ") || "Closed every day"}
    </p>
  ))}
  ```
- New:
  ```tsx
  {[...(calendar?.schedules ?? [])]
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
    .map((s, i, sorted) => (
      <p key={s.effective_from} className="text-sm">
        From {s.effective_from}{" "}
        {i === 0
          ? "(current)"
          : `to ${addDays(sorted[i - 1].effective_from, -1)}`}
        : {s.open_weekdays.map((day) => [...][day]).join(", ") || "Closed every day"}
      </p>
    ))}
  ```
  `addDays` import from `@/lib/numbers-math` (already pure/client-safe, used elsewhere in the app).

5.2 **Replace-confirmation notice** — before each Save button, when the in-progress date already has a
matching stored entry:
```tsx
{calendar?.schedules.some((s) => s.effective_from === effective) && (
  <p className="text-sm text-muted-foreground">
    A schedule already exists for {effective} — saving will replace it.
  </p>
)}
```
placed directly above the "Save schedule" button (`business-calendar-settings.tsx:107`); same pattern for
exceptions, above "Save exception" (`:133`):
```tsx
{calendar?.exceptions.some((e) => e.business_date === exceptionDate) && (
  <p className="text-sm text-muted-foreground">
    An exception already exists for {exceptionDate} — saving will replace it.
  </p>
)}
```

5.3 **Retroactive-confirmation flow** — `update()` (`business-calendar-settings.tsx:22-57`) needs three
changes: (a) send the new nested payload shape, (b) surface the server's exact retroactive message with an
explicit confirm step instead of just dead-ending in the generic `catch`, (c) resend with
`confirmRetroactive: true`.
```ts
const [pendingConfirm, setPendingConfirm] = useState<"schedule" | "exception" | null>(null);
const RETROACTIVE_PREFIX = "This change would alter the recorded open/closed status of";

async function update(kind: "schedule" | "exception", confirmRetroactive = false) {
  setBusy(true);
  setMessage("");
  try {
    const schedules = /* unchanged */;
    const exceptions = /* unchanged */;
    await save({
      data: {
        calendar: { schedules, exceptions },
        confirmRetroactive,
      },
    });
    setPendingConfirm(null);
    await Promise.all(/* unchanged invalidation */);
    setMessage("Calendar saved. The change is recorded in the activity log.");
  } catch (error) {
    const text = error instanceof Error ? error.message : "Calendar could not be saved.";
    if (text.startsWith(RETROACTIVE_PREFIX)) {
      setPendingConfirm(kind);
    }
    setMessage(text);
  } finally {
    setBusy(false);
  }
}
```
Render, near the message paragraph (`:144-148`):
```tsx
{message && (
  <p role="status" className="text-sm">
    {message}
  </p>
)}
{pendingConfirm && (
  <div className="flex gap-2">
    <Button
      variant="destructive"
      disabled={busy}
      onClick={() => void update(pendingConfirm, true)}
    >
      Confirm retroactive change
    </Button>
    <Button variant="outline" disabled={busy} onClick={() => setPendingConfirm(null)}>
      Cancel
    </Button>
  </div>
)}
```
Copy shown is the **server's own message verbatim** (`role="status"` paragraph already renders it, unchanged)
— per the dispatch's instruction not to rewrite it. The `Confirm retroactive change` / `Cancel` button pair is
the only new UI in this ticket; uses existing `Button` `destructive`/`outline` variants, no new component.

**Flagged risk, not a blocker:** the client detects "this is the retroactive case" by matching the message
string prefix, because `saveBusinessCalendar` throws a plain `Error` with no structured code/flag
(`admin.functions.ts:216-219`). This works today because the string is a single literal owned in the same
repo, but it is fragile — recommend Iron add a distinguishing property (custom error subclass or a
`{retroactiveConflictDate}` field) in a later pass. Not required for this phase; noting so it isn't silently
copied as a long-term pattern.

### Item 6 — TV clock + appointment/arrival neutral-unavailable state (never device-local)

**Source-of-timezone correction, not a server change.** `tv.tsx` currently wires `TvHeader`'s `timezone` prop
from `board.data?.timezone` (`tv.tsx:178`), which comes from `listBoard`
(`src/lib/records.functions.ts:61`, `?? "America/Chicago"` — unvalidated, silently guesses). Meanwhile
`useDashboard()`'s `shop.timezone` (`metrics.functions.ts:44`) already runs through `resolveShopTimeZone` and
**throws** if invalid, so `dashboard.data` is `undefined` whenever the shop's stored timezone is bad — exactly
the trigger a neutral state needs, for free. **Switch the TV route's single source of truth for time display to
`dashboard.data?.shop.timezone`, not `board.data?.timezone`.**

6.1 **`src/components/tv/tv-clock.tsx`** — validate before formatting instead of passing a possibly-invalid
value straight to `Intl`:
```ts
import { isValidTimeZone } from "@/lib/timezone";
// …
const validTz = isValidTimeZone(timezone) ? timezone : null;
```
Use `validTz` (not the raw `timezone` prop) in both `toLocaleTimeString` and `toLocaleDateString` calls
(`tv-clock.tsx:19-23, 25-31`). When `validTz` is `null`, render the neutral state instead of formatting:
```tsx
{validTz ? (
  <>
    <p className="flex items-baseline gap-2 font-display text-[3.9rem] font-bold leading-[0.92] tracking-tight tabular-nums text-[#fffdf8]">
      {time}
      {meridiem && (
        <span className="font-display text-xl font-semibold tracking-[0.1em] text-primary">
          {meridiem}
        </span>
      )}
    </p>
    <p className="mt-1 font-display text-[1.05rem] font-semibold tracking-[0.22em] text-[oklch(0.86_0.018_75)]">
      {date}
    </p>
  </>
) : (
  <>
    <p className="font-display text-[3.9rem] font-bold leading-[0.92] tracking-tight tabular-nums text-muted-foreground/70">
      --:--
    </p>
    <p className="mt-1 font-display text-[1.05rem] font-semibold tracking-[0.22em] text-muted-foreground">
      TIME ZONE NOT SET
    </p>
  </>
)}
```
Same two-line layout, same type sizes, so the header never reflows between states. Neutral tone
(`text-muted-foreground` = stone `#9C968C`), not destructive-red — this is a known config gap, not a crash.
`--:--` reads distinctly from the schedule rows' "—" (missing timestamp) so the two "no data" cases are never
visually confused (Bay's non-confusion standard).

6.2 **`src/routes/_authenticated/tv.tsx:178`** — Old: `<TvHeader ... timezone={board.data?.timezone} ...>`
New: `<TvHeader ... timezone={dashboard.data?.shop.timezone} ...>`

6.3 **`src/routes/_authenticated/tv.tsx:55-60`** (`shortTime`) — currently has no `timeZone` at all (pure
device-local, the bug Iron flagged). Add a validated-timezone parameter and gate output:
```ts
import { isValidTimeZone } from "@/lib/timezone";

function shortTime(iso: string | null, timezone: string | undefined): string {
  if (!iso) return "—";
  if (!isValidTimeZone(timezone)) return "‑‑:‑‑"; // neutral, distinct from "—" (no timestamp)
  return new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })
    .replace(/\s?[AP]M$/i, "");
}
```
Every call site in `tv.tsx` (`buildSchedule` at 69, 79, 89, 100; `nextUp` map at 148; `nextAppointment` at
152) must pass `dashboard.data?.shop.timezone` as the second argument. `buildSchedule` already receives
`board` only — thread `timezone` through as a second parameter:
`function buildSchedule(board, timezone: string | undefined): TvScheduleRow[]`, call site
`buildSchedule(board.data, dashboard.data?.shop.timezone)` (`tv.tsx:138`).

**Flagged, out of scope for this ticket, route to Iron if wanted:** `listBoard`
(`src/lib/records.functions.ts:61`) still silently defaults an invalid/missing shop timezone to
`"America/Chicago"` rather than using `resolveShopTimeZone`/`isValidTimeZone`, the same class of bug P12-03
fixed in `metrics.functions.ts` and `metrics-math.ts` but didn't touch here (not in P12-03's FILES list). This
diff list's fix (source display formatting from `dashboard.data.shop.timezone` instead) makes the *visible* TV
clock/appointment state correct without touching that file, but `listBoard`'s own shop-day bucketing
(`splitBoard(rows, Date.now(), { date: today, timezone })`, `records.functions.ts:72-73`) could still silently
mis-sort jobs/appointments into the wrong shop day if the stored timezone is invalid — that's a data/logic gap,
not a design item. Not part of these seven UI items; flagging so it isn't lost.

### Item 7 — NotificationComposer and Hank-clear, permission-gated (matching server, not duplicating)

Per the dispatch's finalized key mapping from P12-02: NotificationComposer → `manage_notifications`;
Hank "clear conversation" → `change_settings`. Both keys already exist in `src/lib/permissions.ts:29,32`.

7.1 **`src/routes/_authenticated/tools.tsx:617-622`**
- Old:
  ```tsx
  <NotificationComposer
    canSend={
      shopContext.data?.membership?.role === "owner" ||
      shopContext.data?.membership?.role === "manager"
    }
  />
  ```
- New (add `import { usePermissions } from "@/components/use-permissions";` and `const perms =
  usePermissions();` near the top of `ToolsPage()`):
  ```tsx
  <NotificationComposer canSend={perms.can("manage_notifications")} />
  ```
  `NotificationComposer` itself is unchanged — it already renders a distinct denied-state card
  (`notification-composer.tsx:64-77`, "Announcements are sent by the owner and admins...") when `canSend` is
  false, and gates its own audience query on the same flag (`:24`). This already matches — not duplicates —
  server behavior once the prop's source is the resolved permission instead of a hardcoded role check.

7.2 **`src/routes/_authenticated/shop-ai.tsx:298-309`**
- Old:
  ```tsx
  {(config?.role === "owner" || config?.role === "manager") && (
    <Button variant="outline" size="sm" onClick={reset} disabled={mutation.isPending} className="rounded-xl">
      <RotateCcw className="mr-2 h-3.5 w-3.5" /> New conversation
    </Button>
  )}
  ```
- New (add `import { usePermissions } from "@/components/use-permissions";` and `const perms =
  usePermissions();` near the top of `ShopAiPage()`):
  ```tsx
  {perms.can("change_settings") && (
    <Button variant="outline" size="sm" onClick={reset} disabled={mutation.isPending} className="rounded-xl">
      <RotateCcw className="mr-2 h-3.5 w-3.5" /> New conversation
    </Button>
  )}
  ```
  Kept as **hidden-when-denied** (not disabled-with-tooltip) — matches the file's existing conditional-render
  pattern exactly, and matches `NotificationComposer`'s existing denied treatment (different content, not a
  greyed-out control). No new interaction pattern invented. `config?.role` is fully removed from this gate —
  the app-level check this UI mirrors is `change_settings`, resolved through `usePermissions()`, per
  AGENTS.md ("never duplicate or hand-code role checks").

---

## 2. Component state checklist

| Element | default | denied / hidden | closed / neutral | loading | error |
|---|---|---|---|---|---|
| KPI supporting-row label (hub, Item 1.1) | "Previous open day · [date]" (configured) | — | "Previous day" (unconfigured, legacy) | unchanged (existing skeleton) | unchanged |
| Date-row pill (hub, Item 1.2) | "Previous open day · [date]" | — | "Previous day [date]" / "Previous day" (no date yet) | unchanged | unchanged |
| Mechanic table header (dashboard-panels, Item 1.3) | "Prev open day" (configured) | — | "Prev day" (unconfigured) | n/a (static header) | n/a |
| TV previousDay cell (tv-numbers-screen, Item 1.4) | "Prev open day · [short date]" | — | "Previous day" | existing TV skeleton, unchanged | unchanged |
| Entry mechanic labels ×4 (entry.tsx, Item 1.5) | "Previous open day" wording | — | "Previous day" wording | "Loading…" (unchanged) | unchanged |
| Monthly hint / summary (hub, Item 2) | open-day wording (configured) | — | legacy wording (unconfigured) | unchanged | migration-not-applied message unchanged, already explicit |
| Closed-day entry warning (entry.tsx, Item 3) | hidden (open day / unknown) | n/a | shown, muted box, Confirm not blocked | hidden while `date` unset | n/a |
| Closed-day tag (history.tsx, Item 4) | hidden (open day / no calendar) | n/a | `Badge variant="secondary"` "Closed-day entry" | n/a (per-row, data-driven) | n/a |
| Schedule list row (calendar settings, Item 5.1) | sorted desc, end-bound or "(current)" | n/a (owner-only edit controls unchanged) | n/a | n/a | n/a |
| Replace notice (calendar settings, Item 5.2) | hidden (new date) | n/a | shown, muted text, non-blocking | n/a | n/a |
| Retroactive confirm (calendar settings, Item 5.3) | hidden | n/a | shown after first rejected save: server message + Confirm/Cancel | `busy` disables both buttons | server message shown verbatim |
| TvClock (Item 6.1) | formatted time/date | n/a | `--:--` / "TIME ZONE NOT SET", muted, same layout | n/a (ticks every 1s, unchanged) | n/a (never throws — validated first) |
| TV appointment/arrival cells (Item 6.3) | formatted short time | n/a | `‑‑:‑‑` (tz invalid) vs `—` (no timestamp) — visually distinct | n/a | n/a |
| NotificationComposer (Item 7.1) | full form | denied card (existing, unchanged copy) | n/a | existing skeleton unchanged | unchanged |
| Hank "New conversation" (Item 7.2) | visible button | hidden entirely | n/a | `disabled` while `mutation.isPending` (unchanged) | n/a |

---

## 3. Icon links

**No new icons.** None of the seven items require a new glyph — Item 4/7 are text badges and permission
gates; Item 6's neutral state is typographic, not iconographic. Plan.md §1 ("Defaults resolved by this plan")
explicitly says **"Keep Lucide icons"**, and the dispatch reiterates "the repo uses Lucide — plan retains
Lucide; do not switch icon sets." This is a deliberate, already-approved deviation from CEDAR.md's default
Tabler-outline-only mandate — flagging it here rather than silently following either rule, per Cedar's
"confirm the icon set" responsibility: **the approved icon set for this phase is Lucide, not Tabler.** No
Tabler links are being dropped because no icon is being introduced or swapped.

---

## 4. Motion note

**No motion needed.** Every change is a conditional text swap, a badge mount, a permission-gated
show/hide, or a two-state typographic swap (TvClock) — none involve a transition, reveal, or timed animation.
Matches plan.md §2's own scoping note ("Flick — not needed. No motion is in scope this phase").

---

## 5. Bay check

Bay already approved the underlying copy redlines this list implements verbatim
(`outputs/reviews/bay-phase1-2.md`, concerns #1–#9 and the copy-redline table). **Needs Bay review** of the
parts synthesized beyond her literal table before this ticket closes (per P12-06's own "CODY CAN CLOSE IF" —
Bay sanity-checks the diff list, not just the redlines):
- the `calendarConfigured` gating added to Items 1 and 2 (legacy vs. open-day wording split),
- Item 3's exact warning copy with date substitution,
- Item 5.3's retroactive-confirm button copy ("Confirm retroactive change" / "Cancel" — not in her original
  table, added to satisfy the ticket's confirm-flow requirement),
- Item 6's "TIME ZONE NOT SET" / `--:--` neutral copy (not in her original table).

This does not block Pixel from starting — P12-06 is documentation-only and can merge fast per the ticket's own
Wave 2 note; Bay's sanity pass can run in parallel with P12-08.

---

## 6. Ready verdict

**Ready for Pixel**, with three explicit non-blocking flags carried forward from this review (not gaps in the
diff list, just items Pixel/the lead should not silently miss):

1. Item 5.3's retroactive-confirmation detection relies on matching the server's exact error-message prefix —
   works today (single literal, same repo), flagged as a fragility risk for Iron to consider hardening later.
2. Item 6 is fixed by switching the TV route's timezone source to `dashboard.data?.shop.timezone`; a related
   but out-of-scope bug remains in `src/lib/records.functions.ts:61` (`listBoard`'s own `?? "America/Chicago"`
   default), which affects shop-day *bucketing* logic, not just display — flagged to route to Iron, not part of
   these seven UI items, not fixed here.
3. Item 5's breaking payload-shape change (`{schedules, exceptions}` → `{calendar: {schedules, exceptions}}`)
   must land together with the rest of Item 5 or every calendar save will fail schema validation — call this
   out in the PR description so it isn't mistaken for optional polish.

No item introduces a UI element outside the seven named areas. No new screen, no new Figma frame required.

---

## Lead note (integrator)

Open item 1 above is resolved server-side in P12-02: `saveBusinessCalendar` returns a structured
`{ ok: false, requiresRetroactiveConfirmation: true, conflictDate, today }` result instead of throwing
when confirmation is needed, and `{ ok: true, retroactive }` on success. Item 5.3 must use that result,
not error-message matching. Item 6's related `listBoard` timezone fallback is also fixed in P12-02.
