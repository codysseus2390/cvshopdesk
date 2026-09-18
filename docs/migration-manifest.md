# Cedar Valley ShopDesk migration manifest

Audit date: 2026-09-17  
Audit scope: read-only provider metadata and policy inspection. No provider settings, code, database writes, permissions, secrets, or deployments were changed.

## Decision

The existing production database cannot currently be retained by the authenticated Supabase account because production project `xbpkvbjmclokmbumhymg` is not visible to that account. The Supabase API lists only the independent staging project and returns a permission error for the production project. It is still possible that Lovable controls a project that can be transferred or that the owner can be added directly. Until that access is granted, retain-versus-migrate is **unverified**; if access cannot be transferred, migration is required.

## Verified repository state

- Repository: `codysseus2390/cvshopdesk`.
- Audited branch: `codex/github-development-safeguards`.
- Branch head: `80a178e53d734a773b711dc04697131da76795dc`, the independent preview auth compatibility fix.
- Redesign commit: `45a9af7cc79fd0c89b689852e1bf57684c79658a`.
- `main`: `1f694690b7af1f28db6009c07b12e8441dd58691`.
- The feature branch is 28 commits ahead of `main); the redesign is not merged.
- No matching dashboard pull request was returned by the repository PR search.
- This Codex workspace has no local repository checkout, so local uncommitted files cannot be inspected. The remote branch is clean at its recorded head.

Supporting files: `AGENTS.md`, `README.md`, `docs/github-development.md`, and `docs/supabase-staging.md`.

## Supabase ownership and export access

- The authenticated Supabase account can see organization **Cedar Valley ShopDesk** and staging project `cvshopdesk-staging`, reference `fsmyugwrfuvqrrhufryf), region `us-east-2), status `ACTIVE_HEALTHY`.
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
- Current ready deployment: `waczZ5USA25pbswAnhLAyuUZUtYc`.
- Current assigned preview URL: https://cvshopdesk-dashboard-preview.vercel.app.
- The deployment page identifies its source as `vercel deploy`, so this artifact was manually deployed. Vercel did not expose a provider-recorded Git branch or SHA for the deployment.
- The artifact was prepared from the audited feature branch; the exact provider-recorded commit remains unverified.
- Vercel environment-variable names and scopes visible in the dashboard:
  - `SUPABASE_URL`: Production and Preview
  - `VITE_SUPABASE_URL`: Production and Preview
  - `SUPABASE_PUBLISHABLE_KEY`: Production and Preview
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: Production and Preview
  - `SUPABASE_SERVICE_ROLE_KEY`: Production only
- Values were not revealed. The preview's exact Supabase project cannot therefore be identified from the current dashboard session.
- Vercel Git automatic deployment status is unverified. The project exposes a Connect/Git settings page, but the current deployment's “vercel deploy” source is not evidence of Git-triggered deployment.

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
