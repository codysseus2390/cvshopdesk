# Supabase staging handoff

The owner selected an independent Supabase project. Production stays on its
current Lovable-managed backend until a separate migration is approved.

## Dashboard setup

1. Sign in at [Supabase](https://supabase.com/dashboard) using your own account.
2. Select the intended organization and confirm its billing plan and available
   project capacity. Do not upgrade a plan or select paid compute automatically.
3. Create a fresh project named `cvshopdesk-staging` in a suitable nearby region.
   The owner should enter and retain the new database password privately.
4. Verify the new project reference differs from production's reference in
   `supabase/config.toml`. Keep that tracked production config unchanged.
5. Put only the staging URL, project reference, and publishable key into the
   ignored `.env.local`, following `.env.example`. Check the project dashboard
   identity before running `bun run check:env` and `bun run dev:local`.

Do not send database passwords, service-role keys, or provider keys in chat.
Supply optional server keys only in the local ignored file or staging host's
secret storage. No service keys or migration credentials belong in the GitHub
checks introduced by this PR.

## Before schema application

The source uses `drizzle/migrations`, not Supabase CLI's standard migration folder.
Review migrations `0000` through `0021` against the live metadata and migration
journal. Rehearse them on this fresh staging backend with one chosen operator;
do not run `drizzle push` from the empty schema or introduce a competing migration
history. Confirm auth/storage schemas and Supabase roles already exist.

The staging bucket must be created explicitly: `shop-uploads`, private, 25 MiB
maximum file size. Reuse the reviewed policies after checking their grants and
shop isolation. Check every table's RLS, routines, triggers, grants, indexes,
constraints, and applied migration journal before enabling app testing.

For another fresh staging project, run
`node scripts/prepare-staging-schema.mjs <verified-staging-reference>` to prepare
SQL offline. Review the output and verify
the dashboard project before running the whole script as `postgres` in the SQL
editor. It refuses production's reference and a populated database, applies the
source migrations in journal order, records their canonical LF SHA-256 hashes
and timestamps in Drizzle's journal, creates the private bucket, and checks RLS
and anonymous app-function access before committing. Errors roll back the whole
transaction. The script does not connect to a database or assert its physical
project identity; the dashboard identity check remains mandatory. It is for a
fresh bootstrap, not upgrades or production migration.

Start with synthetic records and staging users. Never clone production sessions,
passwords, customer details, or attachments merely to populate staging.

## Authentication and integrations

- Configure local/staging callback URLs and email confirmation separately.
- Test email/password login first. Google login currently depends on Lovable's
  auth bridge; do not use it against the independent staging backend until its
  compatibility is verified or the bridge is replaced in a reviewed change.
- Bootstrap the owner using the expected confirmed owner email in this separate
  auth store, then create manager, staff, display, pending, revoked, and other-shop
  test accounts.
- Add separate OpenAI and ElevenLabs credentials with appropriate usage limits
  only when their flows are ready for testing.
- Staging backend selection does not supply a staging frontend host. Start
  locally; choose server-capable preview hosting separately after tests pass.

## Acceptance record

Record these non-secret details once setup is verified:

| Item                                  | Verified result                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Organization / project name           | Cedar Valley ShopDesk / cvshopdesk-staging, Free, Ohio                                                                             |
| Staging project reference             | `fsmyugwrfuvqrrhufryf`                                                                                                             |
| Database schema and migration journal | 22 source migrations applied; 21 public app tables, all RLS enabled                                                                |
| Private storage bucket and policies   | `shop-uploads`, private, 25 MiB; four reviewed upload policies present                                                             |
| Local public backend settings         | Ignored `.env.local` configured; isolation check passes                                                                            |
| Local server credential               | Existing staging key saved locally with owner approval; authenticated bucket/shop API reads pass                                   |
| App login and real test accounts      | Guarded local app renders signup form; owner signup and confirmed-email login pending                                              |
| Auth redirect URLs                    | Site URL and one exact allowed redirect: `http://127.0.0.1:8080`; email enabled, confirmation required, anonymous sign-in disabled |
| Independent provider credentials      | Pending setup                                                                                                                      |
| Role and cross-shop behavior tests    | SQL identity simulation passes isolation checks; denied staff/display customer-write override gap reproduced                       |
| Backup restore rehearsal              | Pending private backup access                                                                                                      |
| Preview frontend host                 | Local initially                                                                                                                    |

Schema setup was verified on 2026-09-17 through the staging dashboard. An initial
acceptance check rolled back because it included Supabase's pre-existing
`rls_auto_enable` event trigger. The final check distinguishes event-trigger
functions from app RPCs; no automatic RLS protection was disabled. The committed
result reported 22 migrations, 21 RLS-enabled app tables, and a private bucket.
The migration journal itself also has RLS and no client-role grants. No users,
production shop records, or production files were copied. The remaining
acceptance items are still pending; schema setup is not a completed app test.

On the same date, an authenticated server API check confirmed the private bucket,
its 25 MiB limit, and zero shop records. The privileged staging key stays only in
the ignored local environment file; GitHub and client settings do not receive it.
OpenAI and ElevenLabs keys remain blank.

`scripts/staging-permissions.sql` was run against the empty staging database.
It switches to actual `authenticated`/`anon` database roles and simulates caller
claims for owner, manager, staff, display, pending, revoked, and another shop.
Customer read isolation and cross-shop insert denial passed for all seven cases.
Staff could not approve a member; a manager could approve staff but could not
change the owner or owner-only permission overrides. Anonymous customer reads and
the superseded direct metric RPC were denied. Staff and display customer inserts
still succeeded despite explicit denied `edit_records` overrides, confirming an
existing policy gap. The transaction rolled back and reported zero shops and
zero Auth users afterward. These are database behavior checks, not real JWT,
storage-object, server-function, or signed-in browser tests. The script refuses
a populated backend; verify its dashboard identity before any future run.
