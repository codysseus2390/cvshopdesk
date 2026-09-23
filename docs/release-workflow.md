# ShopDesk preview-first releases

One repository, one Vercel project, one permanent integration branch: `main`.
Short-lived feature branches are how we preview unfinished work without changing main.

`feature branch -> PR targeting main -> test-backed Preview -> owner acceptance -> main`

A merge is not permission to change the live domain or migrate production. Production
uses a separate backend and must be validated as a production-target build before release.

## Required evidence for each phase

1. Create the phase branch from current main. Preserve old branches and uncommitted work.
2. Commit and push that feature branch. Open one PR per coherent phase; base is main.
3. Run unit, migration integration, typecheck, lint, build, and secret checks.
4. Verify the Preview deployment uses the staging backend. Record its exact head SHA,
   deployment URL/ID, and schema evidence. Test signed-in golden paths and role boundaries.
5. If main changed, merge it into the feature branch (never rebase published work),
   repeat checks, and review the resulting preview before acceptance.
6. The owner reviews the preview. Only after explicit acceptance may the coordinator
   set the `Preview accepted` commit status to success for that exact head SHA, linking
   the evidence. Never manufacture success to unblock a merge. New commits need fresh acceptance.
7. Merge only on explicit owner instruction. Independently verify the production schema,
   production-target build, backend identity and recovery plan before seeking live-release approval.

The acceptance status is a procedural owner gate: a credentials holder with statuses-write
access can post it. It is not a cryptographic proof of human approval. Agents must not set
success without the owner's recorded acceptance. PR review count is zero because the owner
also authors agent-created PRs and cannot approve their own PR; PRs, required statuses,
resolved conversations and administrator enforcement remain mandatory.

## Gate configuration

`.github/main-branch-protection.json` is the desired GitHub policy, not proof it is installed.
Apply through the GitHub API and read back the result. Pin GitHub Actions check sources to
app 15368. Required contexts: test:unit, test:integration, typecheck, lint, build, Secret scan,
Vercel, Preview accepted. Strict mode requires an up-to-date branch. Verify the actual PR
merge box: Actions may validate a synthetic merge SHA while Vercel and acceptance use head SHA.

Vercel project: `cvshopdesk`. Production branch: `main`. In Settings > Environments >
Production > Branch Tracking, disable **Auto-assign Custom Production Domains** and save.
Read back the saved setting; recheck after every promotion or rollback. A rollback's temporary
domain freeze is not a durable replacement for this setting. Until this is verified, do not
merge or promote. Do not undo the current rollback as part of setup.

According to [Vercel's promotion documentation](https://vercel.com/docs/deployments/promoting-a-deployment),
promoting a Preview to Production rebuilds with Production variables. Promoting an already
staged Production deployment does not rebuild. Never directly alias a Preview artifact
containing staging variables onto `app.cedarvalleytire.com`.

## Backend and migration gates

- Staging: `fsmyugwrfuvqrrhufryf`; production: `cblabtksphjsnkkyfnmo`.
- `check:deployment` runs before Vercel builds: exact environment/backend binding,
  public-key verification through Auth settings, and an independent server-key zero-row
  calendar schema check. Anonymous users must not need access to protected app tables.
  This is not an RLS, migration-journal, or signed-in browser-test substitute.
- `bun run check:release-schema --environment staging --commit <full-SHA>` uses an externally
  supplied `SUPABASE_DB_URL` on a clean tracked checkout. It runs read-only catalog/journal
  checks and emits sanitized JSON. Use `production` only for an explicitly scoped read-only
  production check. Never paste connection strings into issues, logs, or PRs.
- Migration journal mismatch is a blocker, not permission to stamp history. Compare the actual
  schema, migration bytes and journal first; rehearse recovery against an isolated copy.
- Apply each phase's schema to staging before reviewing its app preview. Production migration
  is a separate approved step, with a verified backup/restore procedure and compatibility
  with the currently live application. A code rollback does not roll back the database.
- Never run `prepare-staging-schema.mjs` on populated staging: it is only for a fresh project.

## Restart baseline (2026-09-23)

The original `plan.md` is preserved, SHA-256
`dc554beae33fa724ac85fe345f977fcb297026f0a1b7f764dd81dec9bf1b55b7`.
Phase 1-2 code is on main through PR 28; live traffic was rolled back to PR 27 commit
`54a5d33b6a4006aa084c90bfec1e9d2d440f875b`. Keep that working deployment while repairing
the release process. Do not discard or restart the completed code from scratch.

At the initial restart, staging had a journal through 0021 with 0022 objects already
present; production was observed without a Drizzle journal. Staging was subsequently
reconciled and migrated through 0024 after verified recovery on 2026-09-23; see
`staging-recovery-2026-09-23.md`. Production was not migrated. Recheck before changes;
do not replay completed migrations or declare the phase usable from local tests alone.

Phase 0 remains incomplete until GitHub/Vercel protections are verified, journal drift is
reconciled safely, and Phase 1-2 staging browser/token checks pass. Then continue Phase 3,
preserving null values, partial-month reporting, permissions and snapshot history.

### Safeguards verified during this checkpoint

GitHub main protection was applied and independently read back: strict required checks,
PR requirement, administrator enforcement, no force pushes/deletions, and the manual
`Preview accepted` context. Vercel `autoAssignCustomDomains=false` was explicitly saved
and read back with the account user as updater instead of `system`. Production was not
promoted; the live hostname still resolved to PR 27 when checked. These are point-in-time
observations, not a reason to skip future release checks.
