# HANDOFF.md — Living Handoff Document

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

`audit/lovable-dependency-audit` (open PR pending review; see log entry below)

**Also note:** Codex has a separate draft PR on `codex/github-development-safeguards`
(staging/safety infrastructure work) that has not yet been merged into `main`.

---

## Handoff Log

---

### Session: 2026-09-18 — Lovable dependency audit

**Agent:** Claude Code (Sonnet 4.6)
**Branch:** `audit/lovable-dependency-audit`
**Commit:** _(see below — commit pending push)_

**What was audited:**
Performed a complete Lovable dependency audit across all source files, configuration,
package manifests, deployment assumptions, and backend integrations. Every Lovable-related
item was found, classified, and documented.

**Files created/modified:**
- `docs/lovable-dependency-audit.md` — new; full audit report (16 findings)
- `HANDOFF.md` — this entry

**Risky findings (act on these before removing anything):**

1. **Cedar Valley logo may be broken on Vercel** (`src/assets/cedar-valley-logo.jpg.asset.json`).
   The logo is served from `/__l5e/assets-v1/...`, a Lovable CDN path. This URL likely
   returns 404 outside of `cvshopdesk.lovable.app`. **Check the logo on the Vercel deployment
   before anything else.**

2. **Supabase OAuth redirect URIs may be Lovable-only.**
   If the Supabase project's allowed redirect URLs were configured only for `*.lovable.app`
   domains, Google OAuth will fail on the Vercel deployment. **Inspect Supabase Auth →
   URL Configuration → Redirect URLs for project `xbpkvbjmclokmbumhymg`.**

3. **`cvshopdesk.lovable.app` may be the primary production URL.**
   It is unclear whether a Vercel URL or custom domain is in active use. Confirm this
   before any step that would sever the Lovable integration.

**Classification summary:**
- NEEDS MIGRATION: `@lovable.dev/vite-tanstack-config`, `@lovable.dev/cloud-auth-js`,
  `src/integrations/lovable/index.ts`, `src/routes/auth.tsx` (Google OAuth call)
- KEEP FOR NOW: `.lovable/project.json`, Lovable hosting, `LOVABLE_NOTES.md`
- SAFE TO REMOVE LATER: `previewAuthStorage.ts`, `lovable-error-reporting.ts`,
  `__root.tsx` partial, three Lovable-Cloud error strings, `.lovable/plan/*.md`,
  `bunfig.toml` exclusions, `README.md` Lovable references
- UNCERTAIN / NEEDS VERIFICATION: `cedar-valley-logo.jpg.asset.json` (CDN URL),
  `mcp-js`/`email-js`/`webhooks-js` in bunfig.toml, Supabase OAuth redirect URIs

**No application code was modified.**

**Validation status:**
Documentation-only changes; no lint/test run required.

**Next recommended step:**
Open `docs/lovable-dependency-audit.md` and immediately action the two risky findings:
(1) verify whether the Cedar Valley logo loads on the Vercel deployment, and
(2) check Supabase Auth → URL Configuration to confirm the Vercel domain is in the
redirect URI allowlist. Both are read-only checks that can be done without any code
changes, but they determine whether production is already broken and shape the
migration priority order.

---

### Session: 2026-09-18 — Project context update from owner briefing

**Agent:** Claude Code (Sonnet 4.6)
**Branch:** `docs/context-update`
**Commit:** `e5b8068`

**Completed this session:**
- Received comprehensive project briefing from the owner
- Rewrote `PROJECT_CONTEXT.md` to reflect accurate migration direction, multi-agent
  system, Figma URL, Codex dashboard commits, TV mode direction, Hank future vision,
  Codex staging branch, and the broader long-term vision
- Rewrote `ROADMAP.md` with correct priority ordering (finish dashboard first), specific
  Codex commit SHAs, accurate TV mode rotating-screen design, Hank provider-independence
  goal, Lovable audit as an explicit priority, and Codex staging PR as Priority 2
- Updated `HANDOFF.md` current branch and added this entry
- No application code modified

**Files modified:**
- `PROJECT_CONTEXT.md` — major rewrite with accurate project context
- `ROADMAP.md` — reordered and expanded with correct priorities and specifics
- `HANDOFF.md` — current branch updated, this entry added

**Key facts for next agent:**
- Figma file: `https://www.figma.com/design/1GarIodYxJ1rBaTeuFYSVp` (page: "Dashboard — Reference review")
- Dashboard redesign is ~75% complete — verify actual state from Figma + running app before assuming what remains
- Latest dashboard commits: `37da12bc` (major redesign) and `cca7923b` (Figma alignment) — these are on a Codex branch, may not be in a shallow clone
- Codex staging work is on `codex/github-development-safeguards` — draft PR open, not yet merged
- Do not touch production backend config, DNS, Supabase permissions without explicit instruction

**Remaining work:**
- Merge this PR
- Verify exact dashboard state against Figma before continuing any UI work
- Then proceed per ROADMAP.md Priority 1

**Known issues / blockers:**
- None introduced by this session.
- The Codex branch and its commits may not be present in shallow clones of this repo.

**Validation status:**
- Documentation-only changes; no lint/test run required.

**Next recommended step:**
Merge this PR. Then open the Figma file and the running app side by side, audit the
dashboard against the "Dashboard — Reference review" page, and create a specific diff
list of what still needs to change before writing any code.

---

### Session: 2026-09-18 — Agent rules review and hardening

**Agent:** Claude Code (Sonnet 4.6)
**Branch:** `docs/agent-rules-review`
**Commit:** `3208961`

**Completed this session:**
- Audited `AGENTS.md` against the full standing rules list — all 13 core rules confirmed present
- Identified and fixed two gaps in the Low-Usage Handoff Protocol:
  1. 15% threshold section was missing "commit and push progress" — added
  2. No rule existed for agents that cannot see their usage counter — added note requiring
     frequent checkpointing and immediate handoff mode whenever the user says usage is low
     or requests a handoff
- Updated `HANDOFF.md` current branch to reflect merged state and added this entry
- No application code modified

**Files modified:**
- `AGENTS.md` — two additions to the Low-Usage Handoff Protocol section
- `HANDOFF.md` — current branch updated, this entry added

**Remaining work:**
- PR for this branch needs owner review and merge
- After merge: next work is Roadmap Priority 1 — Dashboard / Figma alignment

**Known issues / blockers:**
- None.

**Validation status:**
- Documentation-only changes; no lint/test run required.

**Next recommended step:**
Merge this PR, then start Roadmap Priority 1. Obtain the Figma design link from the
project owner and audit the `/hub` dashboard route against it.

---

### Session: 2026-09-18 — Documentation setup

**Agent:** Claude Code (Sonnet 4.6)
**Branch:** `claude/elegant-curie-ix5vn8`
**Commit:** `9b5cfb2`

**Completed this session:**
- Read and preserved the existing Lovable `AGENTS.md` warning (moved to `LOVABLE_NOTES.md`)
- Replaced `AGENTS.md` with a comprehensive shared rulebook for all coding agents
- Created `PROJECT_CONTEXT.md` — full stack/architecture/data documentation based on actual repo inspection
- Created `ROADMAP.md` — current priorities and backlog derived from the repo state
- Created `HANDOFF.md` (this file) — living handoff structure
- Created `LOVABLE_NOTES.md` — preserves Lovable-specific restrictions and integration notes
- No application code was modified

**Files created/modified:**
- `AGENTS.md` — replaced (old content preserved in `LOVABLE_NOTES.md`)
- `PROJECT_CONTEXT.md` — new
- `ROADMAP.md` — new (also note lowercase `roadmap.md` still exists with 3 checked items)
- `HANDOFF.md` — new
- `LOVABLE_NOTES.md` — new

**Remaining work:**
- The existing lowercase `roadmap.md` contains 3 legacy checked items. It can be removed
  or merged into the new `ROADMAP.md`'s shipped section — that is a minor housekeeping task.
- No application code tasks were started. Refer to `ROADMAP.md` for the current priority list.

**Known issues / blockers:**
- None introduced by this session.
- Existing lowercase `roadmap.md` and uppercase `ROADMAP.md` both exist — minor duplication.

**Validation status:**
- No code was changed, so no lint/test run was needed.

**Next recommended step:**
Start on Roadmap Priority 1 — Dashboard / Figma alignment. Obtain the Figma design link
from the project owner, read the Figma file via the Figma MCP, and audit the `/hub` route
against the designs. Begin with layout and spacing before tackling color or animation.

---

_(Previous entries will appear below as sessions are added)_
