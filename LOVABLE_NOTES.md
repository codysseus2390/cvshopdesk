# LOVABLE_NOTES.md — Lovable-Specific Restrictions and Integration Notes

This file preserves the original Lovable warnings from the old `AGENTS.md` and adds
context about how the Lovable integration works, what depends on it, and what to watch
for if the project is ever migrated away from Lovable.

---

## Original Lovable Warning (preserved verbatim)

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

---

## What Lovable Controls

### Build system — `@lovable.dev/vite-tanstack-config`

The entire Vite + TanStack Start + Nitro build is configured through
`@lovable.dev/vite-tanstack-config`. The `vite.config.ts` explicitly warns:

> Do NOT add these plugins manually or the app will break with duplicate plugins:
> TanStack devtools, tanstackStart, viteReact, tailwindcss, tsConfigPaths,
> nitro (build-only using cloudflare as a default target), VITE_* env injection,
> @ path alias, React/TanStack dedupe, error logger plugins, sandbox detection.

**Do not manually add any of those plugins** to `vite.config.ts`. If additional Vite
config is needed, pass it through `defineConfig({ vite: { ... } })` as the file already
shows.

### Auth — `@lovable.dev/cloud-auth-js`

`src/integrations/lovable/index.ts` and the Supabase auth setup use
`@lovable.dev/cloud-auth-js`. This handles the bridge between Lovable's preview
environment and Supabase auth. Do not remove this package without:
1. Understanding what it provides that plain `@supabase/supabase-js` does not.
2. Testing that auth still works in both the Lovable preview and production.

### Project metadata — `.lovable/project.json`

```json
{
  "schemaVersion": 1,
  "template": "tanstack_start_ts_current",
  "revision": "tanstack_start_ts_current-7da8770d11d6"
}
```

Do not delete or modify this file. It ties the repo to the Lovable project and template.

### Error reporting — `src/lib/lovable-error-reporting.ts`

This module provides client-side error capture for Lovable's editor. It is safe to leave
in place. Do not remove it unless Lovable is fully decoupled and the project has its own
error monitoring.

---

## Live URLs

- **Lovable live preview:** `https://cvshopdesk.lovable.app`
- **Lovable editor:** `https://lovable.dev/projects/8e7e2e56-87bf-4ebd-91f1-301aed2b41a5`

---

## Git History Rules (critical)

The `main` branch is the branch Lovable tracks. Any of these operations on `main`
(or any pushed branch) will corrupt Lovable's project history:

- `git push --force` / `git push --force-with-lease`
- `git rebase` on already-pushed commits
- `git commit --amend` on already-pushed commits
- `git rebase -i` (interactive rebase squashing pushed commits)

**This rule is enforced in `AGENTS.md` and applies to all agents.**

---

## Migration Considerations (for future reference)

If the project is migrated away from Lovable:

1. Replace `@lovable.dev/vite-tanstack-config` with a hand-maintained `vite.config.ts`
   that manually includes TanStack Start, React, Tailwind, tsconfig paths, and Nitro.
   The package's implied config list (above) is the complete list of what to port.
2. Replace `@lovable.dev/cloud-auth-js` with direct `@supabase/supabase-js` auth calls.
   Test the `previewAuthStorage.ts` integration point.
3. Remove `.lovable/project.json` and `src/lib/lovable-error-reporting.ts`.
4. Update `README.md` to remove Lovable references.
5. Move the live deployment to Vercel directly instead of through Lovable's hosting.

Until that migration is complete, all Lovable restrictions above remain in force.
