# Cedar Valley ShopDesk

Shop operations for an independent tire shop — bookings, work orders, customers, dashboard, Hank.

This repo is the source of truth. Develop on GitHub feature branches. Do not use the Lovable editor.

## Development

Use Node.js 24.19.0 and Bun 1.4.2, matching `.node-version` and `.bun-version`.
The existing `bun.lock` is the dependency source of truth; use frozen installs.

```sh
git clone https://github.com/codysseus2390/cvshopdesk.git
cd cvshopdesk
git switch -c feature/your-change
bun install --frozen-lockfile
cp .env.example .env.local
# Point local settings at the staging backend, never production.
bun run dev:local
```

The checked-in `.env` points to production and contains public connection settings.
`dev:local` refuses that production target.

Run `bun run test:unit`, `bun run typecheck`, `bun run lint`, and `bun run build`
before requesting review.

Read [GitHub development](docs/github-development.md) for environment setup,
staging, backups, review, and release steps.
