## Change

Describe the problem and the resulting behavior.

## Validation

- [ ] Unit tests, migration integration tests, typecheck, lint, build, and secret scan reviewed.
- [ ] App flows tested against a separate staging backend when applicable.
- [ ] Relevant owner, manager, staff, and display permissions checked.
- [ ] Exact PR head SHA and matching Vercel Preview URL recorded below.
- [ ] Owner reviewed that preview; `Preview accepted` status remains pending until explicit acceptance.

## Release

State whether this needs a database migration, auth/storage configuration, or server secret.
For backend changes, link the staging result, verified backup, and recovery plan.
PR base must be `main`. Never push directly to main, merge without owner approval,
or alias a staging-backed Preview deployment onto the live domain.

Preview URL:
Reviewed head SHA:
Schema evidence / no-schema-change explanation:
Owner acceptance:

Follow [the release workflow](../docs/release-workflow.md). A green CI build alone
is not proof of a usable preview or an authorized production release.
