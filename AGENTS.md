# AGENTS.md — Shared Rulebook for AI Coding Agents

This file is the authoritative operating guide for every AI coding agent working on the
Cedar Valley ShopDesk repository: Codex, Claude Code, Wrench, Lovable, and any others.
Read this file before making substantial changes. Supplement with `PROJECT_CONTEXT.md`,
`ROADMAP.md`, and `HANDOFF.md` for full situational awareness.

---

## Git Workflow

- **Never push directly to `main`.** All work goes on a feature branch.
- Use one branch per task or feature. Name branches clearly (e.g., `feat/tv-mode-polish`).
- Commit after every meaningful, self-contained unit of completed work.
- Push regularly — do not accumulate large local-only histories.
- **Do not rewrite published Git history.** No force-push, no rebase, no amend, no squash of commits that are already pushed.
- Do not merge to `main` unless explicitly instructed by the project owner.
- Before picking up a task, check `HANDOFF.md` for in-progress work and known issues.

---

## Before Starting Substantial Work

1. Read `AGENTS.md` (this file).
2. Read `PROJECT_CONTEXT.md` — stack, architecture, data rules, key files.
3. Read `ROADMAP.md` — current priorities and what has shipped.
4. Read `HANDOFF.md` — any in-progress state from a previous agent or session.
5. Inspect the relevant source files before editing. Never assume file contents from memory.

---

## Code Standards

- Prefer editing existing files over creating new ones unless a new file is clearly warranted.
- Prefer existing patterns and components over unnecessary rewrites.
  - UI: build on existing shadcn/ui components in `src/components/ui/`.
  - Data fetching: use TanStack Query + TanStack Start server functions (`*.functions.ts`).
  - Auth checks: use the `/_authenticated` route guard and `usePermissions` hook.
  - Supabase calls: go through `src/integrations/supabase/client.ts` (browser) or
    `client.server.ts` (server functions only).
- Do not hard-code or expose secrets. Secrets belong in environment variables and are
  accessed server-side only (never returned to the browser).
- Do not introduce security vulnerabilities (XSS, SQL injection, command injection, etc.).
- TypeScript: keep the codebase strictly typed. Do not use `any` to bypass type errors.
- Formatting: use Prettier (`npm run format` / `bun run format`). ESLint must pass.
- Tests live in `*.test.ts` files alongside their subjects. Run `vitest` to verify.

---

## Data Integrity Rules

These are business-critical invariants. Do not violate them.

- **Missing daily dashboard values must stay missing.** A metric field that has no data
  for a given day must display as absent/empty, not as zero. Silently coercing `null` to
  `0` misrepresents performance.
- **Partial current-month data must not visually imply a full-month downturn.** When MTD
  figures exist for only part of a month, charts and comparisons must make the partial
  nature clear rather than suggesting the month closed at a lower number.
- **Do not replace real or missing data with fake/placeholder values.** If data is absent,
  show it as absent.
- Metric snapshots use `is_current`, `superseded_at`, and `superseded_by` to track history.
  When writing or correcting snapshots, preserve the full audit chain — never delete old
  snapshots.
- `report_scope` distinguishes daily / mtd / ytd / invoice / inventory / jobs / other.
  Never mix scopes in aggregations.

---

## UI / Design

- Follow approved Figma designs when provided. Do not deviate from Figma specs
  without explicit owner approval.
- Do not add features or UI elements that are not in the current task scope.
- Keep production and staging concerns separate.
- Test the golden path and edge cases in a real browser before declaring UI work done.
- Preserve existing working functionality unless you are explicitly asked to change it.

---

## Role and Permission Model

The app has four roles: `owner`, `manager`, `staff`, `display`.
Permission logic lives in `src/lib/permissions.ts`. Check there before adding any
gated UI — never duplicate or hand-code role checks.

---

## AI / Hank

- Hank is the shop assistant (OpenAI, `gpt-5.6-luna` by default). His configuration is in
  `src/lib/ai/model-config.ts` and `src/lib/ai/persona.ts`.
- Voice is handled by ElevenLabs (`src/lib/ai/elevenlabs.server.ts`). The API key must
  never appear in browser code or logs.
- Hank's tools are in `src/lib/ai/tools/`. Adding a tool requires registering it in
  `src/lib/ai/tools.server.ts`.

---

## Low-Usage Handoff Protocol

When you are approaching the end of an agent session or context limit:

**~15% usage remaining** — Stop starting any large new task. Finish only the unit
currently in progress. Commit and push all completed progress immediately so it is
not stranded locally if the session ends unexpectedly.

**~10% usage remaining — enter handoff mode:**

1. Finish only the smallest safe, self-contained unit of work remaining.
2. Run quick validation if practical (`bun run lint`, `vitest run`).
3. Commit all completed work with a clear message.
4. Push the branch to origin.
5. Update `HANDOFF.md` with:
   - Current branch name
   - Latest commit SHA (`git rev-parse HEAD`)
   - What was completed in this session
   - What still needs to be done (specific, actionable)
   - Files touched / most relevant to the next agent
   - Known issues or blockers
   - Validation status (did lint/tests pass?)
   - The single exact next recommended step
6. Stop. Do not start another feature.

> **Note on usage awareness:** Agents may not always have a precise reading of remaining
> context or token usage. Regardless of what the counter shows, checkpoint frequently
> throughout every session (commit + push after each meaningful chunk). If the user says
> usage is low, or explicitly requests a handoff at any time, immediately enter handoff
> mode — do not wait for an internal threshold to be reached.


