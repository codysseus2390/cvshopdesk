# Lovable Dependency Audit

**Date:** 2026-09-18  
**Landed on main:** 2026-09-18 (Grok, after PR #6 could not merge through HANDOFF conflict)  
**Original branch:** `audit/lovable-dependency-audit`  
**Scope:** Lovable-related dependencies, files, config, hosting, auth.

The app still **cannot** drop Lovable packages without a migration plan. This file is documentation only.

## Blocking (do not remove without a plan)

| Item | Why |
|---|---|
| `@lovable.dev/vite-tanstack-config` | Entire Vite/TanStack/Nitro build |
| `@lovable.dev/cloud-auth-js` | Google OAuth sign-in |
| `src/integrations/lovable/index.ts` | Only app call site for cloud-auth |
| `src/routes/auth.tsx` (partial) | Live Google login |

## Keep for now

| Item | Why |
|---|---|
| `.lovable/project.json` | Removing severs Lovable GitHub sync |
| `cvshopdesk.lovable.app` | May still be production |
| `LOVABLE_NOTES.md` | Migration context |

## Safe later

`previewAuthStorage.ts`, `lovable-error-reporting.ts`, `__root.tsx` calls, Lovable-Cloud error strings, `.lovable/plan/*.md`, bunfig excludes, README Lovable branding.

## Verify before any removal

1. Logo URL `/__l5e/assets-v1/...` on the Vercel deployment (may 404).
2. Supabase project `xbpkvbjmclokmbumhymg` Auth redirect URLs include the Vercel host, not only `*.lovable.app`.
3. Which URL the shop actually uses in production.

## Migration order

1. Verify logo on Vercel.
2. Verify OAuth redirect URIs.
3. Replace `lovable.auth.signInWithOAuth` with `supabase.auth.signInWithOAuth`.
4. Delete no-op preview/error helpers.
5. Hand-write `vite.config.ts` and only then drop `@lovable.dev/vite-tanstack-config`.
6. Confirm Vercel is primary host.
7. Then consider deleting `.lovable/`.

Full long-form writeup still exists on PR #6 / branch `audit/lovable-dependency-audit` if a finding needs more detail.
