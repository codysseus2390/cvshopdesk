# HANDOFF.md — Living Handoff Document

## Latest checkpoint — second owner-requested pause, 2026-09-22

The owner resumed the build, explicitly authorized pushing to `codysseus2390/cvshopdesk` on `feat/shopdesk-astra-implementation`, then asked for another stopping point. **Stop here until asked to resume.** The implementation remains incomplete and is not release-ready. The earlier section below records the baseline, worktree, plan hash, project IDs, tooling, and original outstanding scope.

### Changes since `e2c25c9`

- Extended draft migration 0023 to align permissive settings, notification/recipient, staff-invite, membership, and upload policies with effective permissions; notification recipients must belong to the notification's shop and approved audience. The `add_staff_member` definer function now checks `manage_staff` rather than a role name.
- Added `requireShopPermission` and corresponding server/UI checks for staff management, settings, and announcements. Membership-role/approval and notification-read writes check that a row actually changed. Staff credential updates now validate effective staff-management permission and same-shop scope before using the privileged auth client.
- Added draft migration 0024 and its Drizzle journal entry. It adds an owner-controlled `business_calendar` to shop settings and an audit trigger. The initial Monday-Friday schedule is scoped to the two verified Cedar shop UUIDs; other shops receive no guessed schedule. Initial coverage begins at the earlier of the oldest stored report's calendar year and the previous calendar year. No holidays are inferred.
- Added validated calendar loading/saving and a Settings editor for effective weekday schedules and dated open/closed exceptions. Dashboard settings, Numbers goals, announcements, and staff-management UI now use the corresponding effective permission.
- Wired previous-open-day selection, weekly goal allocation, and month/year daily coverage/freshness to the calendar. Daily totals still retain real weekend entries; expected coverage uses actual date sets. Calendar windows with unknown schedules fail visibly. Removed the dead Monthly scorecards setting.
- Updated Supabase TypeScript shape for the new JSON field. The permission-loading test mock now supports `.validator()` for the new endpoint.

### Remaining work and exact next action

**First review this calendar integration before broadening scope.** Add focused regression tests for the wired `monthToDate`/`yearToDate` functions, calendar owner-only writes/audit, effective-date boundaries, and schedule changes. Existing pure calendar tests are present, but the new integration is not fully covered. Verify the initial schedule effective-date choice against the actual historical report windows.

Known unfinished calendar/data details: yearly monthly-snapshot rollup still uses legacy coverage accounting; per-field historical month completeness, provenance, partial historical chart treatment, and current-day versus completed-day labels need implementation. The UI still has old Previous day wording in some places. Closed-day entry warning, common validated clock, and timezone cleanup are not built. Calendar save invalidates known dashboard/numbers/admin query prefixes; audit the actual Numbers query key and all dependent hooks before claiming cache consistency.

Phase 1 also still needs a full operation matrix and expanded deny/grant tests, including new staff/notification policies, all direct/Hank write paths, productivity-related config exposure, zero-row writes not yet covered, and browser tests for the session/membership boundary. No browser auth/token test or independent Claude implementation inspection has run.

All later plan phases remain: chart/UI/craft changes, three TV YoY cards/layout, enrolled-device remembered-account picker, Figma/browser/real-TV verification, full build, and independent inspection. Preserve the unchanged plan rather than treating this checkpoint as completion.

No migrations were applied remotely. No deployment, merge, or PR was made. The previous build failed at Nitro filesystem tracing due to sandbox `EPERM`; it has not been reclassified as a successful build. Final checkpoint hashes and latest check results are in the task's `outputs/BUILD-HANDOFF.md`.

---

## 2026-09-22 — Astra implementation paused at owner's request

**Status: IN PROGRESS. Not release-ready.** The owner asked to stop because the five-hour usage window is nearly exhausted. Do not restart planning or the old five-round review loop. Resume this implementation only when requested.

- Branch: `feat/shopdesk-astra-implementation`.
- Worktree: `C:\Users\ivinb\Documents\Codex\2026-09-22\final-round-5-of-5-is\work\shopdesk`.
- Original checkout: `C:\Users\ivinb\cvshopdesk`, preserved on `feat/tv-mode-redesign` with its existing `.gitignore`, `.claude/`, plan, and review-log changes.
- Implementation baseline: `59b5e69bfa4c42101546ba8548fc080a16ea26fb`.
- First tested/pushed checkpoint: `fa13638` (failed permission reads now fail closed). Latest implementation checkpoint: `5aecab6fd9d7921de2bfe8945157365120251ac1`. This handoff is a following documentation-only commit.
- Contract: this branch's `plan.md`, an unchanged copy of the active original plan. SHA256 `dc554beae33fa724ac85fe345f977fcb297026f0a1b7f764dd81dec9bf1b55b7`. The owner authorized implementation after replacing the older plan. Its old APPROVED verdict does not apply to this replacement or to code.
- User decisions: Monday uses Friday as **Previous open day**; exclude closed dates from expected coverage and goal pacing while retaining real weekend entries. TV YoY graphs belong in the **three number cards only**, not mechanic productivity.

### Completed code and draft work

1. Server permission/config reads in numbers, admin, and Hank now throw on query failures; the permission hook denies access following a failed refresh. Regression tests cover failed reads and a protected fetch not occurring.
2. Added `permissions.server.ts` for checked effective permission reads. Dashboard writes and reads enforce their relevant permission. Dashboard/report productivity queries are conditional on `view_productivity`, and Numbers filters productivity rows, goals, technician names, and correction payloads when denied.
3. Added `read-all-rows.ts` with 500-row pagination and whole-report failure on an incomplete/error page. Dashboard queries have explicit shop/date bounds and stable ordering. Numbers requests the current and comparison windows with an OR filter rather than all dates between them.
4. **Draft, unapplied** migration `0023_effective_permissions.sql`: shared effective-permission SQL; manager-denial fix; restrictive record/productivity/settings/notification/import policies; explicit definer RPC save/import guards; private import metric helper revoked from authenticated callers. Existing migration 0022 is newly registered in the Drizzle journal (its file was already present, and its function exists on staging despite only 22 journal entries). No existing SQL migration was edited.
5. Added `test:integration` using dev-only PGlite (disposable PostgreSQL, no connection-string option). Replays all 24 migrations against minimal Supabase auth/storage schema shims and checks seven identities, explicit denial/grant, real affected-row counts, RPC denial, identity spoofing, and preservation of metric history. **This is not a real Supabase token/browser test.** Existing 17 live-DB unit checks remain skipped.
6. Added root `SessionBoundary`, global RPC epoch middleware, and membership polling/reset logic in `AccessGate`. User changes clear/cancel cache and remount children; token refresh does not. Late RPC responses from earlier identities are rejected. Membership scope changes reset protected queries and mutations. **Browser verification is still outstanding**, especially initial loading, cross-tab auth, A-B-A switching, errors, revoked membership, active queries, and late mutations.
7. Added **unwired** pure business-calendar functions and tests (previous open date, explicit exceptions, effective schedules, date-set coverage, split-month goal allocation). No calendar schema, UI, reporting integration, or production behavior has been changed yet.

### Verification and release boundaries

- Dependency install used the frozen lockfile; PGlite was subsequently added intentionally as a dev dependency.
- Final pause checks: typecheck passed; 92 unit tests passed / 17 existing DB checks skipped; all 6 development-environment tests passed. Integration passed with all 24 migrations (migration and integration runner unchanged since that run).
- Final lint: 0 errors and 17 existing warnings. `git diff --check` passed.
- Build transformed the client and server, then failed in Nitro's file tracing with sandbox `EPERM: readlink C:\Users\ivinb`. Retry the build with justified filesystem permission; do not call this a passed build. The latest session-boundary edits were not part of that completed build attempt.
- No migrations applied to staging or production. Supabase tool calls were read-only. No merge, PR, or deployment performed. No Figma/browser/real-TV verification yet. No independent Claude implementation inspection yet.
- The initial push was rejected because destination ownership was unverified. GitHub subsequently confirmed connected-account admin/push access to `codysseus2390/cvshopdesk`; the same ordinary feature-branch push succeeded. Do not work around approval blocks.

### Exact next step

**Review and finish Phase 1's permission matrix before starting more calendar/UI work.** Compare every operation across server handlers, UI, direct RLS, definer RPCs, imports, and Hank; extend real affected-row tests. Current restrictive policies preserve older hard-coded manager policies, so explicit grants can still fail for settings/notifications. Staff-management policies/RPCs, notification recipients, storage, all writes' zero-row handling, query identity/shop key factories, and end-to-end productivity leakage checks remain unfinished. Recheck `getAdminConfig` and direct settings reads for productivity-related fields. Do not apply the draft migration until those paths and grants are consistent.

Then follow the unchanged plan: integrate the owner-confirmed calendar/timezone rules; finish trustworthy chart completeness and shared data hooks; implement the small UI and craft changes; TV graphs/layout; secure enrolled-device account picker; complete browser/token/integration checks and fresh Claude inspection (codex-build workflow, at most 2 fix and 2 inspection rounds). Do not claim any of those later phases have been completed.

### Environment/reference details for continuation

- Node 24.19.0 / Bun 1.4.2. Commands: `bun run typecheck`, `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run build`, `bun run check:env`.
- Worktree tracked `.env` is legacy public configuration, **not verified staging config**. Do not run browser/API mutations from it. Original `.env.local` only listed `VERCEL_OIDC_TOKEN`; do not copy secrets or print values.
- Verified staging project: `fsmyugwrfuvqrrhufryf`; production: `cblabtksphjsnkkyfnmo`. Staging has 22 recorded Drizzle migrations and one shop. There is no Supabase migrations history; preserve the existing Drizzle deployment path.
- Read-only verified Cedar shop IDs: staging `7abf0d1f-1faf-488a-b356-ce635e278bc2`, production `8d1b6141-6f8a-441e-9725-f2d8358e62c5`; both named Cedar Valley Tire & Auto Service, America/Chicago. Do not apply their weekday calendar or display productivity grant globally to other shops.
- Skills read: `C:\Users\ivinb\.agents\skills\codex-build\SKILL.md`, sibling claudex-loop build/runtime references, Supabase skill. Host builds; a fresh safe/read-only Claude inspector is required later. Recommended inspector from the reviewed handoff was Fable 5.1 High; never silently substitute a model.
- Runner: `C:\Users\ivinb\.agents\skills\claudex-loop\scripts\runner.py`; Python: `C:\Users\ivinb\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`; Claude: `C:\Users\ivinb\.local\bin\claude.exe`. Keep inspection artifacts outside this checkout.
- Approved Figma reference: `https://www.figma.com/design/1GarIodYxJ1rBaTeuFYSVp`; craft exploration: `https://www.figma.com/design/tnwstlDvU6Pfkd43SLvCOc`. Read the applicable Figma skill before tool use.
- Prior review and final-plan delivery copies are in the task's `outputs/`; superseded original-plan backup and the one-time migration-generation script are in the task's `work/`. **Do not rerun `append-permission-rpcs.mjs`**: it appends definitions and intentionally refuses duplicate journal entries.

---

This file is updated by an agent at the end of every session or whenever a task is
handed off. The next agent should read this before starting any work.

---

## How to Use This File

- **Reading:** Before starting work, read the most recent entry below to understand
  what state the repo is in and what needs to happen next.
- **Writing:** When ending a session or handing off, prepend a new entry at the top
  of the "Handoff Log" section. Do not delete previous entries — keep the last 3–5.

---

## Current Branch

`main` (includes PR #12 — bot roster + `GROK.md`). **Grok = lead. Cody = overseer.**

Live hub on `main` **is** the merged PR #5 work (dashboard panels / hub layout). Do not treat `feat/dashboard-panels-integration` as unmerged product work.

Open / special PRs:

- **PR #7** — **CLOSED**. Do not merge. Do not reopen.
- **PR #10** — **OPEN**, dirty, **wrong base** (`audit/lovable-dependency-audit`). Do not merge. Do not resolve on that branch this session.
- **PR #1** — stays **draft** (`codex/github-development-safeguards`).

**Grok** is usage-capped until the week reset — **dispatch-only**.

---

## Handoff Log

---

### Session: 2026-09-19 — Night Shift: rewrite HANDOFF to current truth

**Agent:** Night Shift
**Branch:** `docs/handoff-2026-09-19` (from `main`)
**Issue:** #13
**Files:** `HANDOFF.md` only (docs)

Replaced the stale Current Branch section so it matches live GitHub: PR #12 on main, #7 closed, #5 merged (= live hub), #10 open/dirty/wrong base, #1 draft, Grok dispatch-only until week reset. Kept prior log entries.

**Lint/tests:** N/A (docs only)

**Blockers:** None for this docs PR. Human (Cody or Grok) needed to merge this PR to `main` after a glance. Gauge not required for a short docs PR; Grok can close #13 after review if preferred.

**Exact next step:** Open / land the docs PR from `docs/handoff-2026-09-19` → `main` (closes #13). Do not touch #7 or #10. Do not start app work from the old handoff story.

---

### Session: 2026-09-18 — Lovable dependency audit landed on main

**Agent:** Grok (owner asked Grok to finish the #6 merge)
**Files:** `docs/lovable-dependency-audit.md`, this log

GitHub would not merge PR #6 (HANDOFF.md conflict vs dashboard session). Both notes kept. No application code changed. #7 not merged.

**Next:** Confirm audit file on main. Leave #7 open. Owner may close #6 after verifying files exist on main.

---

### Session: 2026-09-18 — Lovable dependency audit

**Agent:** Claude Code (Sonnet 4.6)
**Branch:** `audit/lovable-dependency-audit`

See `docs/lovable-dependency-audit.md` (16 findings). KEEP `.lovable/project.json` while Lovable hosting may still be production. Do not remove `@lovable.dev/*` without a plan.

---

### Session: 2026-09-18 — Dashboard panels wired into hub layout

**Agent:** Claude Code (Sonnet 4.6)
**Branch:** `feat/dashboard-panels-integration`
**Commit:** `48af86b0712287ab1c33330aec87dfac6946b139`

Dashboard panels wired into hub. Figma audit still remaining. Data integrity rules intact.

---
