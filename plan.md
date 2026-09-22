# ShopDesk — final implementation plan

2026-09-22 · Prepared after the fresh Astra review · **Planning only; implementation has not started**

**Active plan:** `C:\Users\ivinb\cvshopdesk\plan.md`. At the owner's request, this Astra plan replaces the previous Claude-authored plan as the sole active implementation contract. This output document is a matching delivery copy, not a separate competing plan.

It incorporates the original craft pass, all ten owner requests, the source-backed findings in [ASTRA-REVIEW.md](C:/Users/ivinb/Documents/Codex/2026-09-22/final-round-5-of-5-is/outputs/ASTRA-REVIEW.md), and the owner's two decisions during review. It supersedes conflicting recommendations in the original audit for this delivery. The previous five-round review log is retained as historical evidence; its approval does not cover this replacement. Replacing the plan does not authorize implementation.

## 1. Outcome and fixed scope

Deliver a trustworthy dashboard and readable shop TV: correct authorization and reporting, useful YoY charts, a common shop clock, safe remembered-account selection, and a restrained visual craft pass.

| Owner request | Concrete outcome | Phase |
|---|---|---|
| Remove the persistent Hank bar | Remove its render/import and reserved bottom padding; retain full Hank chat and voice page | 4 |
| Repair the blank dashboard YoY graph | Diagnose actual payload; show valid data or the correct explanatory state | 3 |
| Polish line charts | Consistent year styling, truthful scales/gaps, readable labels, calm reveal | 5–6 |
| Fit the 32-inch TV | Measured viewport layout; both screens and announcements fit | 6 |
| Remove TV's Shop productivity row | Remove that row and its now-unused presentation props; keep shared aggregate data | 4 |
| Add TV YoY graphs | **Three number cards only: gross profit, tires sold, car count** | 6 |
| Remember employee accounts | Optional, single-shop enrolled-device picker; ordinary authentication remains required | 7 |
| Improve logo/version/status | Consistent logo placement, real build identifier, honest connection/freshness state | 4 |
| Persistent header clock | Shared clock logic in desktop and TV, using validated shop timezone | 2, 4 |
| Respect weekend closure | Previous open day; open-day coverage/pacing; retain actual weekend records | 2–3 |

**Owner-confirmed decisions:** Monday's Previous open day is Friday for the normal Cedar schedule; closed days do not count as missing data or goal-pacing days; real weekend entries remain. TV comparison graphs belong in the three number cards, not the mechanic table.

**Defaults resolved by this plan:** keep the full Hank route; preserve all five badge sizes (24/32/36/40/52px); retain round and rounded-square badge shapes with an explicit prop; use a sibling initials-avatar component sharing the tokens; retain the current 18-second TV rotation for this release and correct stale documentation. Keep Lucide icons. Use a build identifier rather than inventing a semantic version. Prefer a simple chart opacity reveal over SVG path manipulation.

**Not part of this delivery:** full Hank/voice redesign, goal celebrations, new animation libraries, wholesale component/form migration, unused-package removal, a new mobile app, historical data fabrication, production backend migration, or redesigning the whole dashboard.

## 2. Preparation and preservation — Phase 0

Repository baseline inspected: `C:\Users\ivinb\cvshopdesk`, branch `feat/tv-mode-redesign`, commit `59b5e69bfa4c42101546ba8548fc080a16ea26fb`. Existing changes were `.gitignore` modified and `.claude/`, `plan.md`, and `PLAN-REVIEW-LOG.md` untracked. Preserve them.

When implementation is authorized:

1. Recheck Git state and current remote/base relationships. Establish feature branches or an isolated worktree from a base that contains the existing TV work. Do not blindly start from an older main or discard untracked planning files. Keep security, reporting, presentation, and device-picker changes reviewable as separate commits/PRs, with dependencies stated.
2. Record the exact build plan hash and baseline commit. Use the repository-pinned Node 24.19.0 and Bun 1.4.2, verifying installed versions. Use the lockfile; no opportunistic upgrades.
3. Verify a local or staging backend identity before any database test or migration. Existing provider-access notes are dated evidence, not current proof. Do not assume a Vercel Preview uses staging. Keep production credentials/data out of test fixtures.
4. Capture baseline checks and the actual dashboard payload shapes. Inspect approved Figma references and the running app before visual changes. Produce a small numbered visual change list covering craft states, logo, login, desktop clock, and the TV grid. Obtain the existing required design sign-off for changed layouts; technical fixes can proceed independently.
5. Create a source/acceptance checklist and maintain it through delivery. Do not repeat the entire audit before each phase.

**Exit:** preserved baseline, verified test target, known checks, and a concrete visual reference for the affected layouts.

## 3. Authorization and session boundaries — Phase 1

Primary sources: [permissions](C:/Users/ivinb/cvshopdesk/src/lib/permissions.ts), [server permission helper](C:/Users/ivinb/cvshopdesk/src/lib/numbers.functions.ts:22), [admin functions](C:/Users/ivinb/cvshopdesk/src/lib/admin.functions.ts), [record writes](C:/Users/ivinb/cvshopdesk/src/lib/records.functions.ts:87), [SQL customer helper](C:/Users/ivinb/cvshopdesk/drizzle/migrations/0022_enforce_edit_records_on_customers.sql), and [metric RPCs](C:/Users/ivinb/cvshopdesk/drizzle/migrations/0020_numbers_reporting_goals_and_corrections.sql).

**Implementation contract:**

- Inventory each protected operation and its UI, server function, direct table/RPC path, and Hank/import caller. Map dashboard reads to `view_dashboard`, productivity reads to `view_productivity`, metric/productivity writes to their existing edit permission, record changes to `edit_records`, and administrative functions to their existing named permission. Preserve owner-only ownership/security invariants; do not mechanically replace every role comparison.
- Build a reusable server authorization helper that resolves approved membership and overrides with explicit error handling. Missing membership, invalid roles, failed override reads, or unknown permissions deny access. A successful empty override result uses the documented defaults.
- Match SQL effective-permission semantics to TypeScript: owner always allowed; owner-only permissions never grantable to others; for other roles, an explicit override wins over defaults. Correct the manager bypass in the existing customer helper before reusing it.
- Cover INSERT/UPDATE/DELETE and SELECT where relevant, replacing permissive policies rather than adding a second restrictive-looking policy beside them. Check old/new shop ownership on updates. Inventory inventory, vehicles, jobs, customers, metric/productivity RPCs, tire orders, import acceptance, notifications/settings, and Hank paths. Verify grants and SECURITY DEFINER execute permissions/search paths. Retain atomic import/snapshot audit behavior.
- Do not send disallowed productivity data and merely hide it in JSX. For Cedar's dedicated display account, make any required `view_productivity` grant an explicit shop-specific release configuration supporting the requested TV table. Do not grant it to every shop/display role globally. Without that grant the table shows an authorized unavailable state.
- Partition protected queries by authenticated user and resolved shop. Put identity-change handling at the application root: stop rendering old identity data, cancel queries, clear caches/local protected state, invalidate routes, and disregard late results from the prior identity. Apply this to sign-out, cross-tab account change, expiry, and revocation. A token refresh for the same identity must not cause a full reset.
- Replace UI role shortcuts with effective permissions while preserving protected loading/error states. Ensure rejected/zero-row mutations do not report success.

**Proof:** test owner, manager default/denied/granted, staff default/granted/denied, display, pending, revoked, anonymous, and another shop. Exercise direct database/RPC paths as well as server functions. Include explicit manager denial, same-table shop reassignment, malicious identifiers, override-query failure, and zero-row mutation. Test account A → B with an old slow response still in flight and with a second tab open.

**Exit:** the matrix agrees across UI/server/database; denied data never appears in responses; existing authorized import/Hank/entry operations still work. Do not release broader UI work over unresolved authorization defects.

## 4. Shop calendar and time — Phase 2

Primary sources: [dashboard dates](C:/Users/ivinb/cvshopdesk/src/lib/metrics.functions.ts:120), [period/goal math](C:/Users/ivinb/cvshopdesk/src/lib/numbers-math.ts), [coverage/staleness](C:/Users/ivinb/cvshopdesk/src/lib/metrics-math.ts), [TV clock](C:/Users/ivinb/cvshopdesk/src/components/tv/tv-clock.tsx), and [TV schedule formatting](C:/Users/ivinb/cvshopdesk/src/routes/_authenticated/tv.tsx:55).

**Calendar:** add validated per-shop calendar settings with an explicit Mon–Fri schedule for Cedar, date exceptions, effective dates, and audit metadata. Other shops remain unconfigured/retain existing behavior until configured; do not hardcode Cedar's schedule globally. Do not guess holidays or infer closures from absent reports. Later schedule changes must not silently reinterpret earlier periods.

Use shared pure helpers for shop-local dates, open-date sets, previous open day, and expected reporting coverage. Apply the same rules in dashboard, TV, Numbers, entry hints, and Hank reporting.

- Monday normally selects Friday and labels it **Previous open day · [date]**. If Friday's record is absent, show missing Friday data; never silently fall back to Thursday. Apply date exceptions and the same day to mechanic values.
- Closed days with no actuals show Closed without synthetic numeric zeros. An actual Saturday/Sunday entry still contributes to the appropriate totals and remains visible, labeled as recorded on a closed day.
- Calculate missing data from the expected open-date set, per metric; a recorded Saturday must not cancel out a missing Tuesday. Treat today's not-yet-completed reporting separately from overdue open days. Use the previous completed open day for routine freshness expectations, retain current-day records, and show as-of dates.
- Keep MTD/YTD accounting windows and snapshot precedence. Closure changes expected coverage and pacing, not which genuine transactions happened. Never delete, rewrite, or drop accepted weekend data.
- Preserve existing full monthly/yearly targets. For proratable fixed targets, allocate each month's target across that month's open days. A weekly target is the sum of allocations for the open days in that week, splitting across month/year boundaries. Derive monthly targets from yearly targets using the existing equal-month convention when no monthly target exists. Zero-open-day denominators return unavailable, not infinity or zero.
- Percentage targets/productivity are not prorated by weekdays. Preserve the existing accepted productivity aggregation rules. Do not apply a blanket weekday filter to import rows or averaged percentages.
- Growth targets continue to require a real comparable prior-period value. Keep the approved growth percentage and full-period target; apply open-day allocation only to their pacing display where the metric is proratable. Never substitute zero for an absent baseline or silently compare incomplete current coverage with a full prior period.
- Show a closed-day warning on entry but permit an authorized user to record genuine activity through the existing review/confirm flow. Do not auto-change their selected date.

**Clock/time:** extract shared isolated ticking/formatting logic, with desktop and TV presentation wrappers. Validate the saved IANA timezone; missing/invalid timezone produces a neutral unavailable state, never device-local time. Use the same timezone for appointment/arrival/next-up formatting. Derive each tick from current time rather than incrementing a counter; refresh immediately after wake/visibility change. Keep the clock subtree isolated and avoid per-second screen-reader announcements. Shop-day rollover refreshes reports independently of clock rendering.

**Proof:** Friday/Saturday/Sunday/Monday; a missing Friday; actual weekend entries; a midweek missing metric; exceptions; a week crossing months/years; February/leap day; zero open days; a different device timezone; DST; invalid timezone; midnight and wake. Verify desktop, TV, Numbers, and Hank agree.

## 5. Reporting and chart data — Phase 3

Primary sources: [dashboard aggregation](C:/Users/ivinb/cvshopdesk/src/lib/metrics.functions.ts:87), [Numbers report](C:/Users/ivinb/cvshopdesk/src/lib/numbers.server.ts:98), [chart builder](C:/Users/ivinb/cvshopdesk/src/lib/dashboard-chart.ts), and [hub renderer](C:/Users/ivinb/cvshopdesk/src/routes/_authenticated/hub.tsx:284).

1. Diagnose the owner's blank graph using the real selected metric, shop, deployed build, and response payload. Trace accepted snapshots → period aggregation → chart rows → chart size/render. Do not invent a monthly report scope or assume the screenshot matches the local fixtures.
2. Propagate report query errors explicitly; `buildNumbersReport` currently discards errors. An unavailable query is not empty history. Add explicit shop/date boundaries, inspect API row caps, and implement complete stable pagination or a reviewed database aggregate where needed. Prove history larger than one response page is not silently truncated. Avoid fetching the intervening year of productivity when only two small comparison windows are needed.
3. Share chart data, year-color assignment, formatting, and availability state outside route modules. Extract `useDashboard` and `useBoard` to shared query modules, updating **all** invalidations to use the scoped key factories from Phase 1. Preserve refresh/focus behavior and eliminate TV's runtime imports from desktop routes.
4. Extend month data with per-metric basis/as-of/coverage/completeness. A month being earlier than today is not evidence of complete reporting. Use verified source-period coverage or fully accounted-for expected open days; unknown coverage remains unknown. Existing imported month totals require provenance review before being marked complete. Never manufacture missing daily history.
5. Render explicit states: failed query; no history for selected metric; current-MTD-only; one historical year; sparse/isolated observations; and usable two-year history. A YoY comparison needs comparable observations for both years in at least one aligned month. Show isolated true points when present; only connect adjacent known comparable values. An absent or incomparable series never becomes a flat line.
6. Keep current MTD outside completed-month solid lines. Show incomplete/unknown historical observations separately with their as-of qualifier, without presenting them as completed comparisons. Keep confirmed zero and negative values visible. Use shared y-axis scaling between years within each chart, stable year labels/colors, and no percentage comparison against missing/zero bases.

**Proof:** preserve existing math/snapshot tests; add regression cases for the two reproduced chart defects, current-MTD-only, one year, gaps, a single point, true zero, negative GP, corrections, future dates, source errors, field-specific completeness, and paginated datasets. For identical periods and scope, dashboard/TV/Numbers/Hank must agree; document any intentional partial-period comparison label.

**Exit:** the owner's observed issue has an evidence-backed diagnosis, chart states are truthful, and the three TV graph datasets can reuse the same query without separate per-card fetches.

## 6. Shell and small requested fixes — Phase 4

Primary sources: [application shell](C:/Users/ivinb/cvshopdesk/src/components/app-shell.tsx), [TV productivity](C:/Users/ivinb/cvshopdesk/src/components/tv/tv-productivity-card.tsx), [TV numbers](C:/Users/ivinb/cvshopdesk/src/components/tv/tv-numbers-screen.tsx), and [dashboard panels](C:/Users/ivinb/cvshopdesk/src/components/dashboard-panels.tsx).

- Remove the persistent AssistantBar import/render and its `pb-28` reservation. Remove only newly orphaned bar code/styles after checking references. Keep `/shop-ai`, its navigation, chat, and voice functioning.
- Remove the TV Shop row, obsolete `shop` presentation prop, and shop-only avatar styling/comments when unused. Preserve aggregate backend values used elsewhere.
- Add the desktop clock using Phase 2's shared logic. Check the small-screen header with logo, notifications, theme control, and sign-out; prevent overlap.
- Use the existing Cedar logo asset consistently in desktop/mobile placements according to the frozen visual change list. No replacement logo or new branding system.
- Expose a public build identifier such as `Build <short commit>` from build metadata, falling back to `Local development` when absent. Do not expose environment contents or display an invented v2.0. A commit label is not a semantic release version.
- Replace static Live with honest states: Checking, Connected, Refresh delayed, Offline hint, or Sign-in required. A successful shop-scoped response establishes connectivity; three minutes without a successful expected refresh marks delay for the current 60-second cadence. Include last successful fetch time separately from the report's data as-of date. Network hints never prove backend health. If an active page has no suitable query, use one lightweight shared check, not one per component. Keep permission errors distinct from connection loss.
- Repair the named dead controls: remove the misleading Integrations tile until a real destination exists; remove the nonfunctional Monthly scorecards toggle while preserving the existing working chart controls; change stale Imports destination copy to Tools. Use `roleLabel()` for Display/TV account labels. Add a clear unmatched-technician warning where free-text goals do not match stored names, without silently renaming historical technicians.
- Update the affected context/handoff documentation to match the verified implementation, including removed Lovable packages, direct Supabase auth, TV cadence, and retained Lucide icons. After the behavioral server changes pass, migrate deprecated `inputValidator` calls to the locally verified `validator` alias in a separate mechanical commit; make no unrelated dependency/API upgrade.

**Proof:** browser navigation at desktop/tablet/phone widths; no bottom spacer; full Hank page still works; TV loses only the Shop row; build fallback is honest; disconnect/reconnect/session-loss states behave correctly; no dead controls remain among the named items.

## 7. Craft and chart presentation — Phase 5

Primary sources: [Button](C:/Users/ivinb/cvshopdesk/src/components/ui/button.tsx), [auth CSS](C:/Users/ivinb/cvshopdesk/src/routes/auth.css:101), [Card](C:/Users/ivinb/cvshopdesk/src/components/ui/card.tsx), [MetricCard](C:/Users/ivinb/cvshopdesk/src/components/metric-card.tsx), [styles](C:/Users/ivinb/cvshopdesk/src/styles.css), and the desktop/TV badge call sites already inventoried in the original plan.

- Keep existing card/elevated shadow tokens. Give default/secondary/destructive buttons variant-tinted rest/hover/pressed shadows and an inset highlight; disabled states are flat. Preserve focus-visible rings, button semantics, and keyboard activation. Outline/ghost/link keep existing treatment.
- Resolve all original utility overrides **and** the auth submit CSS override. Keep the native chart select a select; give tiles appropriate card styles. Review computed CSS, not just class strings.
- Add `IconBadge` with the five existing sizes, explicit shape, tone, and solid/tint variants. Use a sibling initials-avatar component with the shared size tokens and explicit row colors. Migrate every listed desktop and TV site; preserve sizes and readable contrast. Do not force both KPI component trees into a single branching component as a prerequisite.
- Apply the approved limited noise/glow simplification and auth-wheel removal; preserve the brand palette, type hierarchy, TV identity, and existing functional layout. Do not add replacement decoration merely to fill space.
- KPI values reveal over 220ms only on first real population or an actual semantic value change. Missing values remain immediate placeholders. Never remount the entire card or replay on unchanged refetches.
- Charts use an approximately 700ms opacity reveal of the final geometry on first meaningful display or intentional metric filter change. Background polling and ordinary data refresh do not replay it. Keep Recharts growth animation disabled. Respect reduced motion and active preference changes.
- Use shared line/grid/year styles and readable labels. Desktop can use the shared tooltip where interaction is useful; TV cannot depend on hover. Keep content accessible through labels/summary and add table header scope/captions when touching the productivity tables. Add layout-preserving skeletons to the affected dashboard/TV surfaces, with distinct error and empty states.

**Proof:** light/dark themes; mouse/keyboard/touch; all button states; unchanged refetch vs changed value; rapid updates; reduced motion; focus retention; screen-reader/table semantics. Inspect actual rendered chart geometry and labels at target widths.

## 8. TV fit and three comparison graphs — Phase 6

Primary sources: [TV route](C:/Users/ivinb/cvshopdesk/src/routes/_authenticated/tv.tsx), [header](C:/Users/ivinb/cvshopdesk/src/components/tv/tv-header.tsx), [number card](C:/Users/ivinb/cvshopdesk/src/components/tv/tv-metric-card.tsx), [numbers grid](C:/Users/ivinb/cvshopdesk/src/components/tv/tv-numbers-screen.tsx), and [shop screen](C:/Users/ivinb/cvshopdesk/src/components/tv/tv-shop-screen.tsx).

- Measure the real browser viewport, output resolution, browser zoom, OS scaling, full-screen mode, overscan, viewing distance, and browser support. Keep a `100vh` fallback and use dynamic viewport sizing where supported/useful. Do not claim inches or 4K panel resolution define CSS layout.
- Budget height for header, status bar, up to two announcements, content padding, and the two grid rows. Make child minimum sizes/padding/type respond to both available width and height. Prevent accidental content clipping disguised by `overflow-hidden`.
- Add one compact YoY chart beneath/alongside the primary MTD number in each of the three metric cards, using Phase 3's existing dashboard payload. Keep the primary number dominant. Include small year labels and a shared scale; no tooltip-dependent information. Insufficient comparison data gets short explanatory text, never invented points.
- No YoY chart in the mechanic table, per the owner's decision. Keep its individual mechanic rows and add proper table semantics.
- Bound long announcement text to its allocated area with a deliberate readable continuation/page treatment; critical content must remain available in the notification experience. Check long mechanic/customer names and large or negative currency values. Keep all scheduled items represented through the existing bounded presentation or a clear continuation indicator.
- Retain 18-second rotation for this scope. Do not add counter tweens or new motion dependencies. Preserve clock isolation and avoid rebuilding chart data on the TV route's per-second timer; mount/rotation must not replay numeric updates as new data.

**Proof:** numbers and shop screens at 1280×720, 1366×768, 1920×1080 CSS viewports plus the actual device configuration; no announcements and two long announcements; empty/loading/error/data states; large values and all mechanic rows. Verify readability at the real viewing distance. Test at least one hour of rotation, a failed refresh/recovery, and sleep/wake. Emulation passes do not replace the real-device result.

## 9. Remembered employee picker — Phase 7

Primary sources: [auth page](C:/Users/ivinb/cvshopdesk/src/routes/auth.tsx), [shop membership](C:/Users/ivinb/cvshopdesk/src/lib/shop.functions.ts), and Phase 1's shared session boundary. Add small dedicated device/picker server functions and forward migrations rather than embedding privileged lookups in the auth page.

**Chosen architecture:** an opt-in convenience feature on an enrolled shop device, with a narrow server-backed list. This is more work than localStorage, but it makes the original revocation/privacy promise implementable.

- An authorized shop owner enrolls the device to exactly one shop. Store a random, high-entropy, revocable device-list capability in a Secure/HttpOnly/SameSite cookie; store only its hash and binding server-side. It confers access only to that device's remembered hints, never authentication or shop records. Rebinding requires authorized enrollment and clears the old list. Validate origin/CSRF protections on state-changing endpoints and never log the capability.
- Add an account only after successful authentication **and approved membership in the enrolled shop**, with explicit Remember on this device consent. Remember previously used accounts, not the entire employee roster. Use minimal label/masked-email data and a server-held identifier; never store passwords or duplicate Supabase access/refresh tokens in the picker.
- On each signed-out picker load, resolve the capability server-side and recheck approved membership. Return `Cache-Control: no-store` hints; never persist names/emails in localStorage. Wrong shop, revoked membership/device, expiry, or validation failure returns no hints. Enforce a proposed 30-day inactivity expiry and a bounded 12-account list, retaining most recent entries.
- While the picker is visible, revalidate every 60 seconds and on focus; hide hints once their last successful validation is more than 60 seconds old, and while revalidating after a hidden/suspended tab returns. Recheck before using a selected hint. On expiry/offline or failed validation, hide hints. This is bounded revocation freshness, not a claim of instantaneous remote erasure. A signed-out client cannot retract a label already seen by a person.
- Selecting a tile prefills the verified identifier for ordinary password/OAuth authentication. A hint never bypasses credentials. Recheck membership on successful sign-in before any protected content or remembering operation. Guard against mixing a currently active account with a selected tile.
- A wrong password shows an authentication error and permits correction; it does not prove revocation or automatically delete another person's hint. Remove hints on definitive membership revocation, expiration, or explicit Forget. Do not expose account-existence information through unrestricted lookup endpoints. Rate-limit the narrow endpoints.
- Provide Forget this account, Use another account, and Clear this device. Clearing invalidates the device capability/list and local picker state. Keep normal sign-out and remember-consent behavior distinct. If cookies/storage are unavailable, ordinary sign-in continues.
- Preserve normal Supabase session persistence unless a separate requirement changes it. Document that a remembered tile is different from an already authenticated persistent session. Verify OAuth callback behavior where configured; do not claim provider verification if the provider is unavailable.

**Proof:** same-shop remembered accounts; attempted other-shop registration/rebinding; tampered/missing/expired device capability; revoked member; offline/no-store behavior; wrong password vs network error; explicit clearing; cookie denial; account switching; refresh after logout; multi-tab changes; no tokens/PII in localStorage or logs attributable to the picker. Test both ordinary sign-in and enrolled-device paths.

## 10. Verification, migrations, and release — Phase 8

Run these existing repository checks from the implementation checkout:

```powershell
bun run check:env
bun run typecheck
bun run lint
bun run test:unit
bun run build
```

`check:env` is for the verified local/staging runtime configuration. CI's dummy build configuration remains separate. Establish baseline warnings, fix introduced failures, and report unrelated baseline failures accurately. Format changed files; do not run a repository-wide write formatter as incidental cleanup.

**Database proof is a separate deliverable.** The current unit configuration disables it. During Phase 1, add a dedicated integration configuration/runner and a documented `test:integration` script; until implemented, `bun run test:integration` is a planned interface, not an existing command. The runner must verify the non-production target, apply the forward Drizzle migration sequence to a disposable test database, create isolated fixtures, execute the authorization matrix with real role behavior, assert nonzero executed tests, and clean up. Include a small real-token/browser suite beyond SQL identity simulation. Do not erase a populated staging database to satisfy the old script's empty-database guard.

Use the existing Drizzle migration history/journal; add forward migrations and generated types. Do not edit previously applied migrations, use `drizzle push` from an empty schema, or invent a competing Supabase migration history. Rehearse migrations and rollback/forward-fix on the isolated environment. Rollback may disable a new UI feature, but must not reopen a corrected authorization hole or discard accepted records.

Require a fresh independent code inspection after the build, consistent with claudex roles: Codex/Astra as proposed builder, fresh Claude as inspector if that builder is retained. Record the actual CLI model if used; do not infer it from the host's selection. Inspect the final commit/diff, run affected fixes through checks, and make final evidence available for owner preview.

**Release acceptance:** all ten request rows complete; security/database tests executed; reporting fixtures pass; no false empty/zero/completed-month states; desktop/tablet/phone browser checks pass; real TV signed off; picker privacy/session tests pass; screenshots and migration evidence recorded. Report Built, Locally tested, Staging verified, Real-device verified, and Deployed as separate statuses. No production release or merge is authorized by this planning request.

## 11. Dependency order and stop conditions

Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phases 4–5 → Phase 6 → Phase 7 → Phase 8. Keep each unit small enough to review and revert; no single all-purpose rewrite. Simple presentation work may be prepared alongside data work, but its release waits for the prerequisite correctness checks.

The build can start with preservation and the authorization matrix once implementation is authorized. Missing Figma/device/backend evidence blocks only the corresponding acceptance gate. Unverified historical completeness must remain visibly unverified; it does not justify making up source data. An unavailable identity-revalidation mechanism blocks the remembered picker, not ordinary login.

The next task is **Phase 0 followed by the Phase 1 authorization/session work**, using this plan's hash as its contract. Nothing in this document starts that work automatically.
