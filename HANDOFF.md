# HANDOFF.md — Living Handoff Document

---

## Current Branch

`chore/leave-lovable`

---

## Handoff Log

### Session: 2026-09-18 — Leave Lovable + editor toolkit

**Agent:** Grok
**Branch:** `chore/leave-lovable`

**Completed this session:**

- Added `.vscode/extensions.json`, `.vscode/settings.json`, and `.editorconfig`
- Rewrote README and AGENTS so GitHub is the source of truth
- Removed Lovable editor/host language from `docs/github-development.md`
- Deleted `.lovable/*` project metadata and plan files and `LOVABLE_NOTES.md`

**Still on purpose (do not rip yet):**

- `@lovable.dev/vite-tanstack-config` still drives `vite.config.ts`. Replacing it
  without a working native Vite + TanStack Start + Nitro config will break `dev`/`build`.
- `@lovable.dev/cloud-auth-js` and `src/integrations/lovable/index.ts` still sit on
  the auth path. Next slice: swap to plain Supabase auth and drop the package.
- `src/lib/lovable-error-reporting.ts` if still imported.

**Next recommended step:**
Merge this PR. Then replace the Lovable Vite wrapper and cloud-auth package on a
follow-up branch after a local `bun run build` passes.
