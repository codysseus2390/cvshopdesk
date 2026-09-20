# Cedar Valley ShopDesk

Staff hub and shop management application for Cedar Valley Tire & Auto Service.

## Development

Use Node.js 24 and Bun matching `.node-version` and `.bun-version`.

```sh
git clone https://github.com/codysseus2390/cvshopdesk.git
cd cvshopdesk
git switch -c feature/your-change
bun install
cp .env.example .env.local
bun run dev:local
```

Run `bun run test:unit`, `bun run typecheck`, `bun run lint`, and `bun run build` before requesting review.

Read [GitHub development](docs/github-development.md) for environment setup and release steps.
