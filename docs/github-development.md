# Develop ShopDesk through GitHub

## Current boundary

GitHub owns code history and review. Supabase provides authentication, PostgreSQL,
and uploaded files. Hank calls OpenAI directly; voice replies call ElevenLabs.
React and TanStack Start include server functions, so this app needs a real server
host (Vercel or similar), not a static upload and not the Lovable editor.

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
| `SUPABASE_DB_URL`                                           | Explicit staging database test process only | Existing database metadata assertions                    |

Never put server credentials in `VITE_*`, Git, PR text, logs, screenshots, or frontend
settings. The existing tracked `.env` contains public production settings. Prefer
moving off that file once hosting is fully independent. `.gitignore` protects new
env files, but does not untrack that existing file.

## Staging readiness

The owner created `cvshopdesk-staging` in their own Cedar Valley ShopDesk
organization, on the Free plan in Ohio. Its reference is
`fsmyugwrfuvqrrhufryf`, distinct from production. See
[`supabase-staging.md`](./supabase-staging.md) for the acceptance record.

Google login previously used Lovable's auth bridge. Staging and production auth
must use Supabase directly going forward.

## Checks and review

GitHub Actions runs tests, typecheck, lint, build, and a redacted Gitleaks history
scan on PRs to `main`. Do not merge a failing check.

Use a feature branch and review the PR. Prefer a regular merge commit when merging.

## Backup, release, and recovery

Before backend changes, record the current app commit and migration journal, and
make a provider-supported backup. Test on staging, merge after checks pass, then
publish from GitHub to the chosen host (not Lovable).

Recover code with a new revert commit that preserves history. Database recovery
needs its own tested forward fix or restore plan.
