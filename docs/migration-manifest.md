# Cedar Valley ShopDesk migration manifest

Audit date: 2026-09-17  
Audit scope: provider metadata and policy inspection plus staging authentication configuration. Lovable production, DNS, production data, and secrets were not changed. The independent staging Auth URL/site settings were updated; the direct OAuth code is recorded below.

## Decision

The existing production database cannot currently be retained by the authenticated Supabase account because production project `xbpkvbjmclokmbumhymg` is not visible to that account. The Supabase API lists only the independent staging project and returns a permission error for the production project. It is still possible that Lovable controls a project that can be transferred or that the owner can be added directly. Until that access is granted, retain-versus-migrate is **unverified**; if access cannot be transferred, migration is required.

## Verified repository state

- Repository: `codysseus2390/cvshopdesk`.
- Audited branch: `codex/github-development-safeguards`.
- Branch head: `2d53b60b9f848f3ebf2533f9a2a6305a456447a2`, the direct Supabase OAuth implementation plus removal of the Lovable preview storage bridge.
- Redesign commit: `45a9af7cc79fd0c89b689852e1bf57684c79658a`.
- `main`: `1f694690b7af1f28db6009c07b12e8441dd58691`.
- The feature branch is 28 commits ahead of `main`; the redesign is not merged.
- No matching dashboard pull request was returned by the repository PR search.
- This Codex workspace has no local repository checkout, so local uncommitted files cannot be inspected. The remote branch is clean at its recorded head.

Supporting files: `AGENTS.md`, `README.md`, `docs/github-development.md`, and `docs/supabase-staging.md`.

## Supabase ownership and export access

- The authenticated Supabase account can see organization **Cedar Valley ShopDesk** and staging project `cvshopdesk-staging`, reference `fsmyugwrfuvqrrhufryf`, region `us-east-2`, status `ACTIVE_HEALTHY`.
- `supabase_list_projects` returns only that staging project.
- `supabase_get_project(xbpkvbjmclokmbumhymg)` returns a permission error.
- Therefore the current account has no verified management or export access to the production project.
- Lovable reports that its project has a Supabase database enabled, but the Lovable metadata does not expose the production Supabase organization or project reference.
- Staging is independently manageable and currently contains 21 public application tables with RLS enabled, one synthetic shop, two profiles, two shop members, and 21 metric snapshots.
- The staging database contains 22 rows in `drizzle.__drizzle_migrations`. The Supabase management migration endpoint reports an empty list because the app uses its own Drizzle journal; this is an API-view difference, not evidence that the journal is missing.
- Staging storage is verified as a private `shop-uploads` bucket with a 25 MiB limit and four reviewed policies.
- Production schema, Auth users, Storage objects, database backups, and export capability remain unverified because the production project is not accessible through the current Supabase account.

Recommendation: do not migrate data yet. First ask the owner to either add the account to the production Supabase project or confirm that Lovable owns it and authorize an export/restore migration.

## Vercel deployment and backend targets

- Project: `cvshopdesk-dashboard-preview`.
- Earlier manually deployed artifact: `waczZ5USA25pbswAnhLAyuUZUtYc`.
- Current assigned preview URL: https://cvshopdesk-dashboard-preview.vercel.app.
- GitHub commit status now reports successful Vercel deployments for the auth/runtime commits, including latest branch head `dd9d088ccd0c256f800d362600378e5d90288a6f` (Vercel target `6YPzYNErf4jxEAvSWcwuDVWX4yFN`). This verifies Git-triggered preview builds for this branch; the Vercel account connector still cannot read deployment metadata or provider-recorded env values.
- Vercel environment-variable names and scopes visible in the dashboard:
  - `SUPABASE_URL`: Production and Preview
  - `VITE_SUPABASE_URL`: Production and Preview
  - `SUPABASE_PUBLISHABLE_KEY`: Production and Preview
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: Production and Preview
  - `SUPABASE_SERVICE_ROLE_KEY`: Production only
- Values were not revealed. The preview's exact Supabase project cannot therefore be identified from the current dashboard session.
- Git automatic preview deployment is now evidenced by the successful Vercel status attached to each new branch commit. Exact Preview backend target remains unverified because environment values are masked and the Vercel API connector is not authorized for deployment-detail reads.

No database write tests were run against the preview because its backend target has not been confirmed as staging.

## Lovable production

Lovable project: Cedar Valley ShopDesk, project id `8e7e2e56-87bf-4ebd-91f1-301aed2b41a5`.

Verified through Lovable metadata:

- Project is published and database-enabled with Supabase.
- Workspace: Cody's Lovable; authenticated account is the workspace owner.
- Editor/latest project commit: `1f694690b7af1f28db6009c07b12e8441dd58691`.
- Last edited time and the latest Lovable edit both match the `main` README commit.

Lovable metadata exposes `latest_commit_sha` but no separate published-deployment SHA. Therefore the editor's current version is verified as `1f69469`; the exact commit serving `https://cvshopdesk.lovable.app` is still unverified. The feature-branch redesign is not the current Lovable editor version.

## Permission-gap finding

The existing evidence was produced against the independent staging project, not production.

- `scripts/staging-permissions.sql` simulates owner, manager, staff, display, pending, revoked, and another-shop identities.
- The earlier finding was that staff and display members could insert customer rows even when `role_permissions.edit_records = false`. This was a database-boundary gap, not merely a hidden-button issue.
- Migration `drizzle/migrations/0022_enforce_edit_records_on_customers.sql` adds `public.can_edit_records` and replaces the customer INSERT/UPDATE policies.
- Read-only inspection of current staging confirms the new policies and function are present:
  - customer INSERT/UPDATE both call `can_edit_records(shop_id)`;
  - owner/manager bypass is explicit;
  - other approved roles depend on the `edit_records` permission.
- No new write test was run during this audit. Production is not accessible, so production impact is unknown.

## Required access steps

1. Supabase dashboard: open project reference `xbpkvbjmclokmbumhymg`, confirm the organization owner, and grant the authenticated owner account project access or confirm that the project must be migrated.
2. Supabase dashboard: confirm available database backup/restore and Auth export controls; do not send passwords or keys in chat.
3. Vercel project `cvshopdesk-dashboard-preview`:
   - Settings → Git/Connect: show connected repository, production branch, and preview branch behavior.
   - Deployments → `waczZ5USA25pbswAnhLAyuUZUtYc` → Source: record the provider Git SHA if available.
   - Settings → Environment Variables: inspect the non-secret `SUPABASE_URL` value for Preview and Production without exposing any key.
4. Lovable project → Publish/deployment history: record the published deployment commit separately from the editor/latest commit.

## Cutover and rollback refinement

DNS reversal alone is insufficient after writes begin on the new backend.

- Keep Lovable production as the only writer until the cutover window.
- Take a full database backup, Auth recovery/export, Storage-object export, and configuration/policy export before cutover.
- Freeze writes at the old app, record the final source timestamp/sequence, and apply that final delta exactly once to the destination.
- Switch Vercel and then DNS only after destination smoke tests pass.
- During the observation window, keep the old app available but read-only or in maintenance mode. Do not let both applications write independently.
- If the new backend receives writes and rollback is needed, capture a destination delta first. Either replay those writes into the old backend through an audited import or discard the rollback only after the owner explicitly accepts the data loss. A DNS reversal without reconciliation would split records and files.
- Storage requires its own object delta and replay plan; database backups contain Storage metadata, not the uploaded files themselves.
- After the rollback window closes, designate one backend as authoritative and disable the other writer path.

## Next bounded implementation task

Resolve provider access and produce a signed migration inventory containing:

1. production Supabase owner and export capabilities;
2. Vercel Git source/branch/SHA and non-secret backend targets;
3. Lovable published commit and backend reference;
4. a tested staging backup restore and destination-delta procedure.

No application redesign or production migration should begin until that inventory is complete.

## Independent staging import and authentication implementation (2026-09-17)

- The imported TireShop history is in the independently controlled Supabase staging project `fsmyugwrfuvqrrhufryf`; it was not re-imported in this task.
- Staging contains 21 `metric_snapshots` rows covering 2025-01-31 through 2026-09-16, with `source='manual'`, `import_id IS NULL`, and notes mapping Tires to `Tires`, Cars to `Cars`, and GP to `Order Profit`. Store 1 2025 totals match the supplied records exactly (2,423 tires, 3,106 cars, $546,438.23 GP). The supplied Store 2 totals are not present (92 tires, 197 cars, $114,686.20 GP); no raw source files or import hashes are recorded in staging. This is an explicit follow-up item, not a second import.
- The staging project has one shop, two Auth users, two approved members, and one approved owner. Custom `role_permissions`, `shop_settings`, and `ai_settings` rows are empty; defaults remain in effect. The private `shop-uploads` bucket exists, but no valuable file set was verified in this audit.
- Commit `257f015870ddc1c0ab9ab70bce163bb3745222d3` changes the auth page to call `supabase.auth.signInWithOAuth({ provider: "google" })` directly and keeps email/password sign-in. The callback is `{origin}/auth`, so no Lovable auth bridge is required by the page.
- Commit `f7d62ea06edb1a126cb665142f387a27a4b62a7e` removes the Lovable preview session-storage broker from the Supabase client and replaces the Lovable-specific missing-variable message. The independent preview now uses Supabase JS browser persistence directly.
- Commit `2d53b60b9f848f3ebf2533f9a2a6305a456447a2` clarifies the server-only Admin client error. `SUPABASE_SERVICE_ROLE_KEY` is required for trusted server routes and must be supplied only in the staging Preview environment.
- Staging Auth Site URL is `https://cvshopdesk-dashboard-preview.vercel.app`; the allowlist contains that origin's `/auth` callback and localhost. Google provider credentials are still disabled because they require the owner's Google Cloud OAuth client.
- GitHub reports a successful Vercel status for the latest branch head (deployment target URL is recorded in the commit status), but the Vercel account connector did not authorize deployment-detail reads. The preview alias remains `https://cvshopdesk-dashboard-preview.vercel.app`; the browser loaded the refreshed dashboard before sign-out, and unauthenticated `/hub` redirected to `/auth`.
- Vercel Preview must be confirmed to use staging `SUPABASE_URL`/publishable key and a staging-only `SUPABASE_SERVICE_ROLE_KEY` before write tests. The current dashboard showed the service-role variable in Production scope only; do not copy a production secret into Preview.
- OpenAI and ElevenLabs keys should be entered directly in Vercel Settings → Environment Variables (Preview scope for staging, server-only names such as `OPENAI_API_KEY` and `ELEVENLABS_API_KEY`; never use a `VITE_` prefix) and/or the Supabase Edge Function secret store if the function reads them. Never send key values through chat.

### Remaining owner actions

1. In Google Cloud Console, create or reuse a Web OAuth client. Add authorized JavaScript origin `https://cvshopdesk-dashboard-preview.vercel.app` and redirect URI `https://fsmyugwrfuvqrrhufryf.supabase.co/auth/v1/callback`. Enter the client ID/secret directly in Supabase staging Authentication → Providers → Google and enable it.
2. In Vercel, verify Preview's non-secret Supabase URL is the staging URL and add the staging service-role secret to Preview only if the server-side access gate requires it. Add `OPENAI_API_KEY`/ `ELEVENLABS_API_KEY` to Preview only when Hank testing is ready.
3. Provide a staging owner/staff test account through the browser (never chat) to complete sign-in/out, session persistence, and unauthorized-access tests. Production and Lovable remain untouched.
