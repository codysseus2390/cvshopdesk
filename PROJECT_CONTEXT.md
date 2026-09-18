# PROJECT_CONTEXT.md — Cedar Valley ShopDesk

Internal shop-management platform for **Cedar Valley Tire & Auto Service**.
Not a public product — it is used by shop staff, managers, and the owner
for daily operations, metrics tracking, and team coordination.

---

## What It Is

ShopDesk gives the shop a single screen for everything that matters each day:
- Live dashboard with today's sales, car count, gross profit, and tires sold
- Weekly trend charts and MTD/YTD comparisons
- Mechanic productivity tracking
- Job board (current work orders / repair queue)
- Tire order management
- Customer and vehicle records
- Notifications system for staff
- Data import pipeline (upload management-system reports → review → accept)
- TV/display mode for the shop floor screen
- "Hank" — the shop AI assistant (chat + voice)
- Role-based access control

---

## Technology Stack

| Layer | Choice |
|---|---|
| Language | TypeScript 5.8 |
| Runtime / package manager | Bun |
| Framework | TanStack Start (React 19 + TanStack Router + SSR) |
| Build tool | Vite 8 via `@lovable.dev/vite-tanstack-config` |
| UI library | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS v4 |
| Server runtime | Nitro (Cloudflare target in production) |
| Database / Auth | Supabase (project ID: `xbpkvbjmclokmbumhymg`) |
| ORM / migrations | Drizzle Kit (`drizzle.config.ts`); schema types generated into `src/integrations/supabase/types.ts` |
| AI — chat | OpenAI (`gpt-5.6-luna` by default — see `src/lib/ai/model-config.ts`) |
| AI — voice TTS | ElevenLabs (`src/lib/ai/elevenlabs.server.ts`) |
| AI — image | OpenAI (`gpt-image-1`) |
| Charts | Recharts |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Date utilities | date-fns v4 |
| File imports | `xlsx` (spreadsheet parsing) |
| Deployment | Vercel (connected to the Lovable project, live at `cvshopdesk.lovable.app`) |

---

## Architecture

### File layout

```
src/
  routes/                  # TanStack Router file-based routes
    __root.tsx             # Root layout (providers, error boundary)
    auth.tsx               # Login / sign-up page
    index.tsx              # Redirect to hub or auth
    _authenticated/        # All routes behind auth guard
      route.tsx            # Auth guard (redirects to /auth if not signed in)
      hub.tsx              # Main dashboard
      board.tsx            # Job board
      tv.tsx               # TV / display mode
      numbers.tsx          # Numbers/metrics detail
      entry.tsx            # Manual data entry
      history.tsx          # Metric history
      imports.tsx          # Import pipeline UI
      inventory.tsx        # Inventory view
      customers.tsx        # Customer records
      tools.tsx            # Tools page
      shop-ai.tsx          # Hank AI chat
      settings.tsx         # Shop settings
      account.tsx          # Account/profile

  components/
    ui/                    # shadcn/ui components (do not edit directly)
    app-shell.tsx          # Sidebar + nav shell
    metric-card.tsx        # Reusable KPI card
    notification-bell.tsx  # Notification indicator
    notification-composer.tsx
    numbers-goals.tsx      # Numbers + goal progress
    assistant-bar.tsx      # Hank floating bar
    hank-settings.tsx      # Hank configuration UI
    hank-voice-settings.tsx
    cedar-logo.tsx
    access-gate.tsx        # Permission-gated wrapper
    shop-ai/               # Hank chat components (voice-mode, talk-button, etc.)

  lib/
    permissions.ts         # Role + permission model (pure logic, unit-tested)
    metrics-math.ts        # Metric formatting/calculation helpers
    dashboard-chart.ts     # Chart data shape helpers
    dashboard-week.ts      # Weekly breakdown helpers
    numbers-math.ts        # Numbers/goal math
    productivity-math.ts   # Technician productivity math
    import-records.ts      # Import parsing/validation logic
    utils.ts               # General utilities
    ai/
      model-config.ts      # Model IDs, limits, tier routing
      persona.ts           # Hank personality → system prompt
      voice-config.ts      # ElevenLabs voice parameters
      shop-ai.server.ts    # Hank inference server function
      tools.server.ts      # Tool registry
      tools/               # Individual AI tools
        shop-data.server.ts
        monthly-numbers.server.ts
        shop-actions.server.ts
        vision.server.ts
        image.server.ts
      elevenlabs.server.ts # TTS API calls (server-only, key never leaves)
      transcribe.server.ts # STT (speech-to-text)
    *.functions.ts         # TanStack Start server functions (RPC endpoints)

  integrations/
    supabase/
      client.ts            # Browser Supabase client
      client.server.ts     # Server-only Supabase client
      types.ts             # Auto-generated DB types (source of truth for table shapes)
      auth-middleware.ts   # SSR auth middleware
    lovable/index.ts       # Lovable integration shims

  styles.css               # Global Tailwind styles
  router.tsx               # Router setup
  server.ts                # SSR error wrapper
  start.ts                 # App entry
```

### Server functions

All backend logic is in `src/lib/*.functions.ts` files. These use TanStack Start's
`createServerFn` and run on the server — they have access to `client.server.ts` and
can safely use secrets from environment variables. Never call `client.server.ts`
from browser code.

### Auth flow

Supabase Auth handles sign-in. The `/_authenticated` route guard checks the session
on every navigation via `supabase.auth.getUser()` and redirects to `/auth` if absent.
Server functions use `auth-middleware.ts` to attach the user to the request context.

---

## Database Schema (Key Tables)

All tables are in the `public` schema. Every table has a `shop_id` FK → `shops.id`
for multi-tenancy. Row-level security is enforced by Supabase.

| Table | Purpose |
|---|---|
| `shops` | One row per shop. Has `name` and `timezone`. |
| `shop_members` | Links users to shops with a `role` (owner/manager/staff/display) and `status` (pending/approved/revoked). |
| `shop_settings` | Per-shop config: `targets`, `technician_goals`, `goal_rules`, `hidden_widgets`. |
| `metric_snapshots` | Core metrics per `business_date` and `report_scope` (daily/mtd/ytd/invoice/…). Fields: `sales`, `car_count`, `gross_profit`, `tires_sold`. Uses `is_current` + `superseded_by` for history. |
| `metric_corrections` | Audit trail for every metric correction. |
| `technician_productivity` | Per-tech rows: `hours_worked`, `hours_billed`, `cars`, `productivity_pct` for a date. |
| `imports` | File upload records. Status lifecycle: `uploaded → extracting → extracted → accepted/rejected/failed`. Stores `extraction` JSON and `period_start/end`. |
| `shop_jobs` | Repair orders / work items. Supports `is_current` + `superseded_by` chain. Has local status/note overrides separate from the imported data. |
| `tire_orders` | Tire order tracking (brand, size, quantity, vendor, status). |
| `customers` / `vehicles` | Customer + vehicle records, importable. |
| `inventory_items` | Inventory snapshots by date. |
| `notifications` + `notification_recipients` | Internal notifications with audience, priority, channels, expiry. |
| `ai_settings` | Hank configuration: personality, model tier, voice settings (ElevenLabs voice_id, similarity, speed, etc.), wake word config. |
| `assistant_messages` | Hank chat history per shop. |
| `ai_actions` | Audit log of AI-initiated actions (tool calls with before/after values and confirmation status). |
| `audit_events` | General app audit log (action, actor, detail). |
| `profiles` | User display info (name, email). |
| `role_permissions` | Per-shop overrides to the default role→permission mapping. |
| `staff_invites` | Pending invitations (by email). |

**Key Supabase functions:**
- `bootstrap_shop` — creates a new shop for a user
- `save_shop_metrics` / `save_metric_snapshot` — upsert metrics with correct snapshot chaining
- `accept_import_metrics` / `accept_import_records` — promote extracted import data
- `save_period_productivity` — upsert technician productivity
- `log_audit_event` — append an audit entry
- `has_shop_access`, `is_shop_owner`, `is_shop_manager` — access-check helpers

---

## Role and Permission Model

Defined in `src/lib/permissions.ts`. Four roles:

| Role | Label | Default access |
|---|---|---|
| `owner` | Owner | All permissions, always |
| `manager` | Admin | All except manage_permissions and manage_security |
| `staff` | Staff | view_dashboard, edit_dashboard_numbers, upload_imports, access_tools, use_assistant |
| `display` | TV / Display | view_dashboard only |

Permissions can be overridden per-shop in `role_permissions`. The `owner` role ignores overrides.
`manage_permissions` and `manage_security` can never be granted to non-owners.

Use `can(role, permission, overrides)` from `permissions.ts` for all checks.
Use `<AccessGate permission="...">` component in the UI.

---

## AI / Hank

- Default name: **Hank**; configurable via `ai_settings.assistant_name`.
- Model: OpenAI `gpt-5.6-luna` (fast tier). Standard/deep tiers reserved but currently route to the same model.
- Tool-call rounds capped at 4 per turn (`SHOP_AI_MAX_TOOL_ROUNDS`).
- Voice: ElevenLabs TTS. The API key is server-only, never sent to the browser.
- STT: OpenAI Whisper via `transcribe.server.ts`.
- Hank has a wake-word feature (`use-wake-word.ts`) and configurable auto-listen/auto-speak.
- All Hank personality toggles (casual language, humor, profanity, shop banter,
  customer-facing mode) are stored in `ai_settings` and compiled into system instructions
  by `persona.ts` — they are never shown in the chat UI.

---

## TV / Display Mode (`/tv`)

- Auto-cycles between a "numbers" screen and a "tech" (productivity) screen every 120 s.
- Long job queues paginate at 6 rows per page, advancing every 30 s.
- `display` role is purpose-built for this screen — it has only `view_dashboard`.
- Logic helpers (`screenAt`, `jobPageAt`) are exported from `src/routes/_authenticated/tv.tsx`.

---

## Data Import Pipeline

1. Staff uploads a file on `/imports`. Stored in Supabase Storage; row inserted into `imports`.
2. Server function triggers AI extraction (`shop_ai.server.ts` + tools) → populates `extraction` JSON.
3. Manager reviews the extracted data on the same page.
4. Manager approves → `accept_import_metrics` or `accept_import_records` Supabase function
   is called → data lands in `metric_snapshots`, `shop_jobs`, `inventory_items`, etc.
5. Import row moves to `accepted` status.

---

## Important Business Rules

- **Null metrics stay null.** Missing data is intentionally absent, not zero.
- **Partial months are partial.** MTD figures mid-month must never be presented
  as if the month has closed.
- Snapshot `is_current = true` means the active version. When correcting a snapshot,
  the old one gets `superseded_at`/`superseded_by` set; a new one is created.
- `report_scope` governs what kind of period a snapshot or correction represents.
  Do not mix scopes in aggregations.
- Shop data is strictly multi-tenant: all queries must include the user's `shop_id`.
  Supabase RLS enforces this at the DB layer, but application code should also scope correctly.

---

## Environment Variables

Managed via `.env` (local) and Vercel/Supabase project settings (production).
Never commit secrets. Server-side secrets (OpenAI key, ElevenLabs key) are accessed
via `process.env` inside server functions only.

Key env vars (see `.env` for the real values — not committed):
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase project, safe for browser
- OpenAI and ElevenLabs API keys — server-side only, never exposed to browser

---

## Deployment

- **Vercel** hosts the production build.
- The Nitro build target is Cloudflare (set in `@lovable.dev/vite-tanstack-config`).
- Lovable's live preview: `https://cvshopdesk.lovable.app`
- Pushes to `main` sync to Lovable and may trigger a Vercel deployment.
