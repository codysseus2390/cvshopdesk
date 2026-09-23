# Staging recovery and migration evidence — 2026-09-23

## Outcome

Owner-approved staging-only repair completed at approximately 14:11 UTC on
`fsmyugwrfuvqrrhufryf`, using candidate commit
`5bbe05543ef8b25c36aa0653f178b439bdb92fec` on `fix/preview-release-gates`.
Production SQL, main, and production deployment routing were not changed.

- Reconciled the missing **0022 journal entry only**, after verifying the existing
  function body, metadata, grants and customer policies. Did not replay its DDL.
- Applied the unchanged repository migrations **0023 and 0024**, with journal
  reconciliation and final schema assertions in the same database transaction.
- All 25 journal timestamps and LF hashes match the repository. Independent
  read-only release preflight passed after commit.
- All 21 metric snapshots retained identical content hashes. The Cedar calendar
  was seeded with Monday-Friday open, effective 2025-01-01, no inferred exceptions.

## Backup and tested recovery scope

The private connection was verified using the official certificate linked by the
staging dashboard, with certificate and hostname verification enabled. PostgreSQL
17.11 portable binaries came from the EDB archive linked by postgresql.org.

The custom-format logical backup completed successfully: 498174 bytes, SHA-256
`ebdc50db0eb9a8c11d2f59f68e2e6147407bec86f7be6dd67f7439327e5a73fc`.
It is retained locally under ignored `logs/staging-recovery-20260923/`, restricted
to the Windows owner and SYSTEM. Do not upload the archive or local credentials.

The archive was restored into a password-protected, loopback-only PostgreSQL 17
instance, preserving object owners and grants. Comparison of public, drizzle,
auth and storage matched **57 tables, 60 policies and 41 routines**, including
row counts/content hashes, columns, constraints, triggers, sequences and ACLs.
Comparison normalizes default-versus-explicit equivalent ACLs and physical gaps
left by dropped columns; it does not ignore differing effective privileges/data.

This proves **migration-scoped database recovery**, not full Supabase disaster
recovery. Ten provider Vault archive entries were excluded from the local restore
because that extension is unavailable in the Windows runtime. Vault had no secret
rows, and no relevant function/view/direct extension references were found.
Storage file bytes and hosted service configuration are not covered by pg_dump.

Stock PostgreSQL required temporary local superuser status to restore the existing
event-trigger owner; it was removed immediately after restore. For migration
rehearsal only, the three unchanged storage.objects policy statements ran as their
existing local owner. Supabase's actual `supautils.policy_grants` mapping was
verified to permit postgres to manage those policies. The remote migration ran
unchanged as postgres, without granting roles or changing object owners.

## Execution safeguards and verification

Root supervised lower-model Sol implementation/review. Independent review caught
and closed stale-evidence, file-binding and post-commit verification weaknesses
before the remote write. The successful local rehearsal was bound to the exact
runner, SQL, snapshot reader, backup, baseline and Git commit hashes.

The remote runner verified the staging allowlist, TLS, clean tracked checkout,
matching rehearsal, exact pre-migration baseline and journal. It locked the journal,
public tables and affected storage.objects table, rechecked baseline under locks,
and required post-migration catalog/journal/storage-policy assertions before commit.
The local rehearsal server was stopped afterward. Do not rerun the old repair;
the expected starting journal is now deliberately different.

Security advisors were checked after migration. They still report the existing
`rls_auto_enable` public-execute warning, authenticated definer-RPC review notices,
disabled leaked-password protection and an informational no-policy notice for the
private Drizzle journal. No unrelated security settings were silently changed.
See [function execute guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Still not release-ready

The first post-repair Preview (`0bfd160`) reached a different, confirmed preflight
defect: anonymous SELECT on private shop_settings returned 401/42501. The public
key itself passed `/auth/v1/settings`, while an invalid key failed. The follow-up
changes only the public credential probe to Auth settings and retains the server-key
calendar schema probe. Database grants remain unchanged. The Preview service key
is a configured Vercel sensitive variable and cannot be retrieved in an env pull.

PR 29 stays draft. A fresh hosted Preview build, signed-in role/session and browser
checks, and owner acceptance of the exact candidate remain required. A local
deployment probe was blocked by development environment settings/missing local
server key; that is not evidence about the separate Vercel Preview configuration.
No main merge, production migration or live promotion is approved.
