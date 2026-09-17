# Cedar Valley ShopDesk

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cvshopdesk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8e7e2e56-87bf-4ebd-91f1-301aed2b41a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Use Node.js 24.19.0 and Bun 1.4.2, matching `.node-version` and `.bun-version`.
The existing `bun.lock` is the dependency source of truth; use frozen installs.

```sh
git clone https://github.com/codysseus2390/cvshopdesk.git
cd cvshopdesk
git switch -c feature/your-change
bun install --frozen-lockfile
cp .env.example .env.local
# Replace the template settings with a separate staging backend's public settings.
bun run dev:local
```

The checked-in `.env` points to production and contains public connection settings.
`dev:local` refuses that production target. The original `dev` command remains for
Lovable's managed preview; it does not perform this local safety check.

Run `bun run test:unit`, `bun run typecheck`, `bun run lint`, and `bun run build`
before requesting review. Unit tests deliberately skip database checks even if a
database URL exists in the shell. GitHub Actions runs these checks plus a secret
scan; it does not publish the app or run migrations.

Read [GitHub development](docs/github-development.md) for environment setup,
staging readiness, backups, review, and release steps.
