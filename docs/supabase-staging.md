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

| Item                                  | Verified result               |
| ------------------------------------- | ----------------------------- |
| Organization / project name           | Pending account access        |
| Staging project reference             | Pending creation or selection |
| Database schema and migration journal | Pending rehearsal             |
| Private storage bucket and policies   | Pending setup                 |
| Auth redirect URLs and test roles     | Pending setup                 |
| Independent provider credentials      | Pending setup                 |
| Role and cross-shop behavior tests    | Pending security follow-ups   |
| Backup restore rehearsal              | Pending private backup access |
| Preview frontend host                 | Local initially               |

This document is a setup checklist, not evidence that staging is already running.
