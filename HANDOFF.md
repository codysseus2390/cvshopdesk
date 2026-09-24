# HANDOFF.md — Living Handoff Document

## 2026-09-23 — Textured dimensional TV typography

Branch: codex/tv-texture-depth. Source commit: ce32167c31e433e88204b4b4895a755d3e4c89d0.
Changed only src/styles.css: brushed metallic grain and beveled gradients on large
headings, clock, metric values and footer counts; softer raised shadows for names,
percentages, date, timers and smaller labels. Static finish preserves readability.
Solid-text fallback and forced-colors reset included. No layout or data changes.
Updated existing Figma frames 2:2 and 4:34 in P7whBvxGPIv9NXz4aj3UDC.

Validation: build and TV ESLint pass; 111 tests passed, 17 skipped. CI 35939170664
passed. Actual components verified in browser at 1280x720, 1280x600 and 1920x1080,
including large values, names, percentages, header/clock and fitting behavior.
Temporary local sample fixture removed and dev server stopped.

Ready feature Preview: 4d4NAEjVAkDQQmEyUeXRQWwGbbb6
https://cvshopdesk-7opfzyatb-codysseus90.vercel.app/tv
Owner approved production rollout on 2026-09-23. Release branch is ce32167.
Configured Preview: DQKcSRA4Sa2RCEBH5Aaa5EJG8F3e
https://cvshopdesk-d32yra9rx-codysseus90.vercel.app/tv
Production: 8z8nUdn2menzPqDn5AGLmkgVJk5U
https://cvshopdesk-ghotnugxz-codysseus90.vercel.app/tv
Rebuilt using Production settings, then promoted. Vercel confirms Ready /
Production / Current Domains: app.cedarvalleytire.com, source ce32167.
Release CI 35939575018 passed. Branch alias switches to production on rebuild;
old staging browser token consequently showed Invalid token. Unique Preview
requires sign-in. No auth/config changes made. Do not deploy main.
Next step: optional signed-in production visual check; local component visual
checks already passed on both screens.

---

## 2026-09-23 — TV metric fit and clock cleanup

Branch: codex/tv-fit-and-clock. Source commit: 5606a5344f338bb89f3e829fa08858b58c69119f.
Published source also on codex/autoflow-release; no main changes.
Updated Figma numbers frame 4:34 in P7whBvxGPIv9NXz4aj3UDC: removed both
header taglines and productivity subtitle, expanded clock with transparent background.
Implemented adaptive TvFitContent for metric values and the full mechanics table.
Mechanics only, no Shop total, no scrollbars; missing values remain missing.
Clock is larger, orange-accented, with no opaque backing. Taglines retained on shop screen.

Validation: typecheck, TV ESLint, build passed; 111 tests passed, 17 skipped.
GitHub Actions 35937218661 and 35937209619 passed. Browser verified at 1280x720,
1280x600, 1920x1080, including large metric values and six long mechanic names in
an isolated local fixture (removed after testing). Live preview verified with actual
metrics and Dale/Josh/Teagen, no subtitle/taglines, no clock box, no clipped content.

Ready configured Preview: Cw8Ry1dnpvHqH1N5oeiUVy7Qv2bz
https://cvshopdesk-a9fks6cjg-codysseus90.vercel.app/tv
Production: RDpTLnnAKoXNq3ctfXy38yJv56BX, rebuilt with Production settings.
https://cvshopdesk-f1fgelhs5-codysseus90.vercel.app/tv
Source 5606a53. Owner renewed production authorization after automatic review
failed to recognize prior permission. Production build was promoted to app.cedarvalleytire.com.
Vercel verified Ready / Production / Current Domains with the live domain.
Next step: optional signed-in production visual check; preview visual checks passed.
Relevant files: src/components/tv/tv-{fit-content,metric-card,productivity-card,header,clock}.tsx,
src/styles.css. Local workspace is aligned to the published source commit.

---
## 2026-09-23 — Animated TV redesign from the owner's two references

Branch: codex/tv-animated-redesign. Released source commit:
e2489aee0877be767a482eb56a27a9775bfb52ec (also codex/autoflow-release).
Do not deploy main: this still builds on the existing safe release line.

Figma: https://www.figma.com/design/P7whBvxGPIv9NXz4aj3UDC
Shop frame 2:2; numbers frame 4:34. Figma uses reference samples only;
production uses existing live queries. Existing repository brand asset retained.

TV now has a carbon-style background with drifting orange light trails,
status-colored breathing borders/rails, separate In Shop / Upcoming / Done
scrolling columns, and a right-hand 12-hour schedule. Numbers uses separate
illuminated KPI cards and large MTD values. User explicitly requested mechanics
only: the Shop total row and its prop are removed from TV productivity.

Both screens remain mounted for an 850ms slide/crossfade and light sweep.
Inactive screen is inert and hidden from assistive technology. Pause freezes
ambient effects, rails, auto rotation and scrolling; live timers still tick.
Reduced motion disables CSS motion and list auto scrolling. No new dependencies,
backend/schema changes, workflow writes, or changes to missing metric handling.

Validation: 111 unit tests passed, 17 DB tests skipped. Typecheck and build pass;
ESLint has no errors (one existing route export warning locally). Final Actions
35934684594 passed tests, lint, typecheck, build and secret scan.
Browser checked live workflow/descriptions, status columns, scrolling, timer
progress while paused, decorative animation, manual/automatic screen rotation,
720p and full-HD layouts. Final 720p table has only Dale/Josh/Teagen and fits
without overflow. Viewport override reset after checks.

Final Preview: 6rYjTJ3AS5QMBG2Rc4J1GYsJxCYF
https://cvshopdesk-5wn1h9gol-codysseus90.vercel.app/tv
Production build: CLzVzfAgqyfh3d2HmiMu3QJpzUfM (rebuilt with Production settings).
Source e2489ae; Vercel confirms Ready / Production / Current with domain app.cedarvalleytire.com.
The production browser still needs an owner sign-in for a live-data visual check.
The release branch alias can point to the production rebuild; use the unique
Preview URL above for staging. No PR/main merge.

Relevant files: src/components/tv/*.tsx, src/routes/_authenticated/tv.tsx,
src/styles.css. Next step: optional signed-in production visual check once the owner signs in.

---

## 2026-09-23 — TV job-description correction

Branch `codex/tv-job-descriptions` continues the production release, not main.
Root cause: workflow seeds and status webhooks did not populate requested_service.
Autoflow's work_orders API returns 404 for these visits, but documented GET
dvi/{RoNumber} returns content.reason_vehicle_is_here[].details. The new server
loader reads only those descriptions, validates invoice and remote ticket IDs,
decodes escaped text for React text rendering, coalesces reads for 60 seconds,
and limits concurrent calls to four. A failed details read preserves known text
and leaves the workflow visible. Status events now retain invoice/remote IDs.

Existing active visits' RO mappings were verified in Autoflow. Both databases
have 13 corrected snapshots with autoflow_ro: flags and 10 known descriptions;
all 13 prior snapshots are retained and linked via superseded_by. One active
visit has RO 0 and no reason text in Autoflow; missing text remains missing.
No workflow statuses, customer messages, or source data were changed.

Released commit: `8df9df0b67f3b77233eaafe303dc38dc897fd101` on feature and
configured release branches. All 111 unit tests pass (17 DB tests skipped),
typecheck/lint/build/secret scan pass in Actions run 35931903986.
Preview Ec1UaisUrAPjDLuRKPrhYW6nPDPH:
https://cvshopdesk-dfz63iuya-codysseus90.vercel.app
Browser verification showed real descriptions below the corresponding vehicles,
including tire install, check engine light, and oil change / air filter.
Production DxYyn9xazVbFCYPdfA1nhqxtBR1F was rebuilt with Production settings
and promoted to app.cedarvalleytire.com. No main merge or schema change.
Next: optional signed-in production visual check; the live-domain tab still
requires the owner's login. Description changes refresh within about a minute
plus the 15-second board polling interval.

---

## 2026-09-23 — Live workflow and TV layout release

Feature branch: `codex/tv-workflow-live`, based on release `95ad16a`.
TV now places Next up & in shop at left and the rolling 12-hour appointment
schedule at lower right, uses explicit shop-time AM/PM, scrolls both lists,
and has small pause/next controls. Check-in timers remain live while paused.
Inspecting through Servicing map to in shop; Ready maps to done. Board refresh
is 15 seconds. Workflow is projected from the private authenticated webhook
inbox, preserving earliest check-in and applying events in provider-time order.
No snapshot histories are overwritten and no customer actions are sent.

Autoflow's documented visits endpoint only returns closed history. An initial
18-visit baseline was read from the signed-in active workflow and original
status histories; staging is seeded in shop_jobs with autoflow: visit identities.
Future visits/status changes come from the existing Status Update subscription.
Production receives the webhook; staging has an independent database.
Migration 0025 is now present in BOTH environments. Earlier notes saying
production/appointments are unconfigured are stale: production 95ad16a has
working appointments and a verified webhook inbox. Do not deploy main because
0023/0024 remain outside this release.

Released code: `4b084a12c65ddb7044d4b5b25187722d4db0d81c` on feature and
release branches. Git credential manager had no usable local sign-in; the
connected GitHub API published the exact tested tree (87f3f5e), then local Git
was aligned with that identical commit. Main was not touched.

Validation: 106 unit tests pass, 17 database tests skipped; typecheck and build
pass; full ESLint passes with 17 pre-existing warnings. GitHub Actions run
35924546940 passed all five jobs, including the secret scan.
Preview 8Q4idpcDq2XQgCRZ4GRQozga8vuK is ready at
https://cvshopdesk-5rvzg5q5t-codysseus90.vercel.app . Browser verified the
15-row unfinished queue, 5 in shop / 10 upcoming / 3 done, timers, scrolling,
pause and next-screen controls. No appointment falls within the current
12-hour window; the full Schedule page correctly shows later appointments.

Production H4fv3QK9zdoqcsEKTfvBkMEQ7tf9 was built afresh with Production
environment values, then assigned to app.cedarvalleytire.com. Vercel confirms
Production / Current / Ready. Both databases now contain the 18 verified
baseline visits. New production webhooks arrived for Servicing and Close
during release. Staging has its own independent inbox; it is not a mirror of
production. The branch alias may point at the production rebuild; use the
unique preview URL above when testing staging.

Next: complete the signed-in live-domain browser check once the owner signs
in to the production tab. The deployed app currently presents its login page.

---

## 2026-09-23 — Appointment feed implementation (not yet deployed)

On codex/autoflow-release, added a read-only appointment feed to listBoard for
the authenticated approved member's configured shop. Reads active appointments
from today through 30 days ahead. Replaces the displayed imported appointments
only when enabled; imported jobs and stored local notes remain unchanged.
Board refreshes every minute; TV shows today's appointments in the shop timezone.
Invalid/missing times stay missing; provider errors show an explicit warning.
Only display fields are returned (no phone, VIN, questionnaire, or API credentials).

Five appointment tests passed locally. Local typecheck repeatedly exhausted
memory. Remote build, unit tests, lint, and secret scan passed on 8f61fad; CI found
strict index-signature access errors, corrected in remote 7bd815e and local a3f618d.
CI run 35914834015 is validating the correction. Vercel built the feature preview,
but appointment credentials/enable setting are still absent: do not claim live data.
New server settings: AUTOFLOW_APPOINTMENTS_ENABLED=true plus AUTOFLOW_API_KEY and
AUTOFLOW_API_PASSWORD, scoped to release Preview first. Existing subdomain and
ShopDesk shop mapping are reused. These new settings are NOT yet saved to Vercel.

Owner approved a preview share link and explicitly said NOT to revoke it. The
Vercel UI stalled during creation, so verify whether sharing was saved. Browser
crashed/timed out; browser control still times out after resets. Asked owner to
restart Codex and reopen this task. No production rollout.
Next: publish checkpoint, verify CI, save the three appointment settings in
release Preview, and verify real appointments on /board and /tv before production.

---

## 2026-09-23 — Autoflow-only production release preparation

Branch codex/autoflow-release starts from deployed production commit 54a5d33.
Only Autoflow receiver/transport changes were carried over. Do not deploy main:
production is intentionally rolled back because migrations 0023/0024 are absent.
The separate codex/autoflow-integration branch and draft PR #30 remain on main.

Staging migration 0025 is applied and verified, including private permissions and
transactional duplicate tests. Its Drizzle history was recorded. Production is
unchanged. Owner saved separate production and staging server keys in Vercel;
server URLs were verified against the matching projects. Autoflow shop ID 2966
was verified through a read-only API request and the signed-in shop URL. Five
Autoflow variables (including the existing webhook secret and enabled=true) are
saved only for Preview branch codex/autoflow-release, using the staging shop UUID.
Do not deploy main or
promote a preview build with staging environment values to production.
Production remains unconfigured. The existing Autoflow subscription points at
production and is enabled with Status Update only. No customer actions were sent.
Preview HTTP tests were intercepted by Vercel Deployment Protection (401), not
the receiver; neither signature validation nor HTTP storage is verified yet.
The Vercel connector also denied access to this project. Temporary preview share
access was requested from the owner; do not create it without their response.
Preview rebuild DvP4WhgXMAubMkDjtJycSP43hbh2 uses remote commit 9e24d81.
Local release commit 9853b34 and remote 9e24d81 have the same source tree.
Credentials belong only in ignored local files and Vercel secrets. Never print them.

Release validation: typecheck and production build passed. 92 unit tests passed,
17 existing database-dependent tests skipped. The disposable PGlite inbox test
could not allocate WebAssembly memory on this machine (including single-worker
retry); its equivalent staging permission/deduplication transaction passed earlier.
Next: verify the preview rebuild, obtain authorized temporary testing access, and
verify signed HTTP delivery plus duplicate handling before applying production migration.

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
