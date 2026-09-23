# HANDOFF.md — Living Handoff Document

## 2026-09-23 — Autoflow-only production release preparation

Branch codex/autoflow-release starts from deployed production commit 54a5d33.
Only Autoflow receiver/transport changes were carried over. Do not deploy main:
production is intentionally rolled back because migrations 0023/0024 are absent.
The separate codex/autoflow-integration branch and draft PR #30 remain on main.

Staging migration 0025 is applied and verified, including private permissions and
transactional duplicate tests. Its Drizzle history was recorded. Production is
unchanged. Owner saved separate production and staging server keys in Vercel;
server URLs were verified against the matching projects. The verified Autoflow
shop ID and hosted webhook secret are still required. Do not deploy main or
promote a preview build with staging environment values to production.
The receiver remains disabled pending configuration and delivery testing.
Credentials belong only in ignored local files and Vercel secrets. Never print them.

Release validation: typecheck and production build passed. 92 unit tests passed,
17 existing database-dependent tests skipped. The disposable PGlite inbox test
could not allocate WebAssembly memory on this machine (including single-worker
retry); its equivalent staging permission/deduplication transaction passed earlier.
Next: obtain the Autoflow shop ID, configure a staging-only webhook secret, rebuild
preview, and verify HTTP delivery before applying the additive production migration.

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
