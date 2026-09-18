# Develop ShopDesk through GitHub

## Current boundary

GitHub owns code history. Lovable still hosts/publishes the app, manages the
backend connection and secrets, and synchronizes one active branch. React and
TanStack Start include server functions, so this app needs server hosting rather
than a static GitHub Pages upload. Supabase provides authentication, PostgreSQL,
and uploaded files. Hank calls OpenAI directly; voice replies call ElevenLabs.

Branch isolation does not isolate the database. A feature branch that uses the
checked-in production `.env` can change real shop records. Use the guarded
`bun run dev:local` command with a separate backend before testing app flows.

## Local setup

1. Use Node 24.19.0 and Bun 1.4.2; the version files and `packageManager` record them.
2. Install with `bun install --frozen-lockfile`. Do not create a second package-manager lockfile.
3. Copy `.env.example` to `.env.local` and enter the staging project's public settings.
4. Keep server/browser URLs and publishable keys identical. Run `bun run check:env`.
5. Run `bun run dev:local`; use staging users and synthetic shop data.

Environment files follow Vite's development file order, with shell values taking
precedence. Enter literal values in local env files; the safety checker does not
expand references such as `${OTHER_VARIABLE}`. The startup checker catches known
production addresses, mismatched targets, and private key names with a `VITE_`
prefix. It is an accidental-use guard, not proof that every credential is isolated.
Verify the staging project's identity in the provider dashboard as well.

The original `dev` script remains compatible with Lovable's managed preview.
Treat that preview as connected to its configured backend, including production
when no isolated backend is configured.

## Environment and secret inventory

| Setting                                                     | Where it belongs                            | Use                                                      |
| ----------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `SHOPDESK_ENVIRONMENT`                                      | Local ignored env file                      | Explicit local/staging label for guarded startup         |
| `SUPABASE_URL`, `VITE_SUPABASE_URL`                         | Backend runtime / browser build             | Must identify the same isolated backend                  |
| `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Backend runtime / browser build             | Public publishable or legacy anon key; RLS still matters |
| `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PROJECT_ID`           | Environment metadata                        | Use staging values when configured                       |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Server secret storage only                  | Privileged staff-account operations; bypasses RLS        |
| `OPENAI_API_KEY`                                            | Server secret storage only                  | Hank, imports/vision, transcription, image generation    |
| `ELEVENLABS_API_KEY`                                        | Server secret storage only                  | Voice catalogue and text-to-speech                       |
| `LOVABLE_DB_MIGRATION_URL`                                  | Verified migration operator only            | Existing Drizzle migration connection                    |
| `SUPABASE_DB_URL`                                           | Explicit staging database test process only | Existing database metadata assertions                    |
| `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS`       | Server only if a cron route is added        | Currently referenced only by an unused helper            |

Never put server credentials in `VITE_*`, Git, PR text, logs, screenshots, or frontend
settings. The existing tracked `.env` contains public production settings and stays
for compatibility with Lovable; `.gitignore` protects new env files, but does not
untrack that existing file. Separate provider credentials and budget limits are
needed for staging; leave optional keys blank until those features are tested.

## Staging readiness

The owner created `cvshopdesk-staging` in their own Cedar Valley ShopDesk
organization, on the Free plan in Ohio. Its reference is
`fsmyugwrfuvqrrhufryf`, distinct from production. On 2026-09-17, all 22 source
migrations were applied in one guarded transaction with their Drizzle journal;
all 21 app tables have RLS, and the private 25 MiB `shop-uploads` bucket and its
four policies exist. Local public settings pass the environment isolation
check. The owner-approved local staging server key successfully read the private
bucket and empty shop table. Email confirmation stays required, and the exact
local callback is `http://127.0.0.1:8080`. SQL role simulations verified customer
isolation and membership restrictions while reproducing the existing staff/display
write override gap; all fixtures rolled back. Confirmed-user app tests, provider
credentials, broader permission tests, and security fixes remain pending. See
[`supabase-staging.md`](./supabase-staging.md) for the acceptance record and
fresh-bootstrap procedure. No new billing plan or paid compute should be
selected without the owner's agreement.

- Reconcile the live schema with all 22 existing SQL migrations and the applied
  migration journal. `drizzle/schema.ts` and snapshots are empty; do not use
  `drizzle push` or generated schema differences against production.
- Rehearse the migrations in order on a disposable staging backend. Supabase
  auth/storage system schemas must exist before the app migrations run. Keep one
  migration operator; GitHub CI has no migration credentials or migration step.
- Explicitly create the private `shop-uploads` bucket with a 25 MiB limit. The
  repository contains storage policies but does not recreate the bucket itself.
  Confirm policies, grants, routines, triggers, and RLS match the intended schema.
- Configure email confirmation, redirect URLs, and Google login separately.
  Google login currently uses Lovable's auth bridge; it needs a compatible
  staging configuration or a separately reviewed replacement.
- Replace/copy the Lovable-managed logo asset for independent hosting if needed.
- Create synthetic customers, inventory, imports, and distinct test accounts for
  owner, manager, staff, display, pending, revoked, and another shop.
- Verify provider secrets and quotas in staging. Run Hank, imports, microphone
  transcription, voice selection, and text-to-speech with test content.

The existing owner identity is tied to a confirmed owner email. Use a separately
created account in staging; never copy production login tokens or passwords.

## Checks and review

Initial local validation: the locked install, production build with dummy backend
settings, typecheck, 72 existing unit tests, and six local-environment guard tests
passed. Seventeen existing database assertions were intentionally skipped. The
existing full lint command fails on legacy formatting and 24 non-formatting
errors (mostly untyped Supabase interfaces). This remains a visible failing
check; the foundation PR must remain a draft until a reviewed cleanup passes.

GitHub Actions runs tests, typecheck, lint, build, and a redacted Gitleaks history
scan on PRs to `main`, pushes to `main`/`codex/**`, and manual runs. Actions are
pinned to commits, the scanner is pinned with its archive checksum, permissions
are read-only, and application secrets are not supplied. Build settings use an
unreachable dummy backend. Unit tests do not load hosting plugins; database
assertions are explicitly skipped and must not be mistaken for full role tests.

Do not merge a failing check. A failure can expose an existing baseline problem;
fix or explicitly review it rather than silently skipping the check. Secret-scan
findings need redacted investigation; real keys require rotation. Scope any
false-positive exception to the exact finding rather than excluding whole env files.
`.gitleaksignore` records only two reviewed historical findings: the public
Supabase publishable keys in commit `5041c562`. Future changes remain scanned.

Use a feature branch, review the PR, and coordinate Lovable edits to avoid competing
changes. Preserve pushed history: no force push, rebase, amend, or squash of
published commits. Prefer a regular merge commit when merging the PR. Keep Lovable
on its current connected branch until the owner intentionally changes it.

`main` currently has no enforced protections. GitHub's API reports the private
repository needs GitHub Pro for branch protections/rulesets. Keep the repo private;
until that is enabled, review and checks are procedural rather than enforced.
After enabling protection, require these five checks and reviewed PRs. Verify how
Lovable writes to the protected active branch before requiring protections; it
may need its own PR/sync workflow.

## Backup, release, and recovery

Before backend changes, record the current app commit and migration journal, and
make a provider-supported backup of data, schemas, functions, policies, triggers,
and grants. Include an appropriate auth recovery method and a separate export of
storage objects/configuration. Database backups alone do not back up uploaded files
or secret-manager values. Store exports privately outside the repo and rehearse a
restore into staging; a backup without a successful restore is unverified.

Test the candidate on staging, including role failures, rejected AI writes, and
browser flows. Review SQL and backward compatibility before applying a migration
through the chosen operator. Merge only after checks pass and confirm Lovable has
synced the expected commit. Publish/update explicitly through Lovable and verify
login, core shop flows, Hank, and voice afterward. No automatic deployment is added.

Recover code with a new revert commit that preserves history. Database recovery
needs its own tested forward fix or restore plan; reverting code does not undo a
migration or restore lost records. Expand/contract migrations are preferred when
old and new app versions may overlap.

## Security work before broader feature changes

The architecture audit found these follow-ups; this setup change does not fix them:

1. Align database RLS and RPC permissions with application overrides. Some approved
   member policies permit writes by staff/display despite hidden or denied controls.
   Staging SQL simulations reproduced customer inserts despite denied `edit_records`
   overrides. Test real role tokens for direct table writes and RPC calls across shops.
2. Enforce assistant/voice access server-side and bind AI write consent to a
   server-issued pending action. A model-supplied `confirmed` flag is insufficient.
   Verify screenshot proposals cannot write before the user approves the action.
3. Reconcile conversation clearing with current database delete denial, preserving
   the intended shared-history policy and audit behavior.
4. Add actual role-behavior tests in isolated staging. Existing definition checks
   do not simulate each user's effective access.

## References

- [Bun locked installations](https://bun.com/docs/pm/cli/install)
- [Lovable GitHub sync](https://docs.lovable.dev/integrations/github)
- [Lovable publishing](https://docs.lovable.dev/features/publish)
- [Supabase environments](https://supabase.com/docs/guides/deployment/managing-environments)
