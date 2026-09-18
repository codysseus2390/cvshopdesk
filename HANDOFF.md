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

`docs/agent-rules-review` (open PR pending merge; see log entry below)

---

## Handoff Log

---

### Session: 2026-09-18 — Agent rules review and hardening

**Agent:** Claude Code (Sonnet 4.6)
**Branch:** `docs/agent-rules-review`
**Commit:** _(see latest commit SHA after push)_

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
