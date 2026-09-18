# PROJECT_CONTEXT.md — Cedar Valley ShopDesk

Internal shop-management and operations platform for **Cedar Valley Tire & Auto Service**.
Not a public product today, but the architecture and UX are being kept clean enough that
the system could eventually be adapted and offered to other automotive repair shops.

---

## What It Is

ShopDesk replaces the scattered combination of TireShop, spreadsheets, AutoFlow, texts,
paper, and other disconnected systems the shop was using. It gives the shop a single place
for everything that matters operationally:

- Live dashboard — today's sales, car count, gross profit, tires sold
- Weekly trend charts, MTD and YTD comparisons
- Mechanic productivity tracking
- Job board (current work orders / repair queue)
- Tire order management
- Customer and vehicle records
- Notifications system for staff
- Data import pipeline (upload management-system reports → review → accept)
- TV / display mode for the shop floor screen
- **Hank** — the shop AI assistant (chat + voice)
- Role-based access control

---

## Development Direction

The app was originally built through **Lovable** but is actively migrating toward a normal
software-development workflow:

- **GitHub** is the source of truth for code
- **Vercel** handles preview deployments and is the long-term hosting path
- **Supabase** handles the database, auth, storage, and backend
- **Figma** is the visual design source of truth
- **OpenAI** powers Hank and other AI functionality
- **ElevenLabs** is part of the Hank voice plan

Lovable has not been ripped out. The existing Lovable project is being kept around until
every remaining production dependency and backend ownership detail is verified. The goal
is a safe, deliberate migration — not independence through accidentally breaking production.

**Critical constraint:** Agents must not casually change production backend configuration,
DNS, Supabase permissions, or authentication because they noticed something they could
"clean up." Staging and production must remain separate. Every Lovable dependency should
eventually be categorized as: **keep temporarily → migrate → remove** — but only through
intentional, reviewed work.

See `LOVABLE_NOTES.md` for the full list of Lovable integration points.

---

## Multi-Agent Development System

Several AI coding systems are used on this project:

| Agent | Role |
|---|---|
| **Codex** | Primary builder; has done the most code work to date |
| **Claude Code** | Builder + codebase reader, debugger, reviewer, refactoring/architecture |
| **Wrench** | OpenAI API-based coding agent; future coordinator with sub-agents |
| Free-tier agents | Kiro, Amazon Q Developer, Cursor, GitHub Copilot, Junie, Cline, and similar — used when free usage is available |

Because multiple agents touch the project, the repository carries the project memory.
Every agent must read `AGENTS.md`, `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `HANDOFF.md`
before doing substantial work.

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
| Server runtime | Nitro (Cloudflare adapter) |
| Database / Auth | Supabase (project ID: `xbpkvbjmclokmbumhymg`) |
| ORM / migrations | Drizzle Kit; schema types in `src/integrations/supabase/types.ts` |
| AI — chat | OpenAI (`gpt-5.6-luna` default — see `src/lib/ai/model-config.ts`) |
| AI — voice TTS | ElevenLabs (`src/lib/ai/elevenlabs.server.ts`) |
| AI — image | OpenAI (`gpt-image-1`) |
| Charts | Recharts |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Date utilities | date-fns v4 |
| File imports | `xlsx` (spreadsheet parsing) |
| Deployment | Vercel (preview + production); Lovable live preview at `cvshopdesk.lovable.app` |

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
    notification-bell.tsx
    notification-composer.tsx
    numbers-goals.tsx      # Numbers + goal progress
    assistant-bar.tsx      # Hank floating bar
    hank-settings.tsx
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
```

### Server functions

All backend logic is in `src/lib/*.functions.ts` files using TanStack Start's
`createServerFn`. These run on the server — they have access to `client.server.ts`
and can safely use secrets. Never call `client.server.ts` from browser code.

### Auth flow

Supabase Auth handles sign-in. The `/_authenticated` route guard checks the session
on every navigation and redirects to `/auth` if absent. Server functions use
`auth-middleware.ts` to attach the user to the request context.

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
| `imports` | File upload records. Status lifecycle: `uploaded → extracting → extracted → accepted/rejected/failed`. |
| `shop_jobs` | Repair orders. Supports `is_current` + `superseded_by` chain. Has local status/note overrides separate from imported data. |
| `tire_orders` | Tire order tracking (brand, size, quantity, vendor, status). |
| `customers` / `vehicles` | Customer + vehicle records, importable. |
| `inventory_items` | Inventory snapshots by date. |
| `notifications` + `notification_recipients` | Internal notifications with audience, priority, channels, expiry. |
| `ai_settings` | Hank configuration: personality, model tier, voice settings (ElevenLabs voice_id, similarity, speed, etc.), wake word config. |
| `assistant_messages` | Hank chat history per shop. |
| `ai_actions` | Audit log of AI-initiated actions. |
| `audit_events` | General app audit log. |
| `profiles` | User display info (name, email). |
| `role_permissions` | Per-shop overrides to the default role→permission mapping. |
| `staff_invites` | Pending invitations (by email). |

---

## Role and Permission Model

Defined in `src/lib/permissions.ts`. Four roles:

| Role | Label | Default access |
|---|---|---|
| `owner` | Owner | All permissions, always |
| `manager` | Admin | All except manage_permissions and manage_security |
| `staff` | Staff | view_dashboard, edit_dashboard_numbers, upload_imports, access_tools, use_assistant |
| `display` | TV / Display | view_dashboard only |

Use `can(role, permission, overrides)` from `permissions.ts` for all checks.
Use `<AccessGate permission="...">` in the UI. Never duplicate role checks.

---

## Dashboard — Critical Data Rules

The dashboard displays **real shop data**. Visual changes cannot break reporting logic.

- **Missing daily values must stay missing** — not zero. A zero means the shop recorded
  zero. Missing means no confirmed entry. These are not interchangeable.
- **The monthly chart runs January → December.** Current-month data must be handled
  carefully: a partially completed month must not make the trend line dive downward and
  falsely suggest poor performance.
- **Mechanic productivity is based on actual entered/stored values** — not computed
  from placeholders or defaults.
- **Never replace missing data with fake/placeholder values.** If data is absent, show it
  as absent.
- Snapshot `is_current = true` marks the active version. Corrections create a new
  snapshot; the old one gets `superseded_at`/`superseded_by`. Never delete old snapshots.
- `report_scope` governs period type (daily/mtd/ytd/invoice/inventory/jobs/other).
  Never mix scopes in aggregations.

---

## Dashboard — Figma Design

The approved dashboard design lives at:

**Figma file:** `https://www.figma.com/design/1GarIodYxJ1rBaTeuFYSVp`
**Reference page:** `Dashboard — Reference review`

This is the visual authority. Match it. Do not redesign independently.
The direction is: **light, clean, modern, readable, polished, restrained Cedar Valley branding.**
It should look like a professionally designed shop application, not a generic admin template.

Once the dashboard matches the approved design, do not keep redesigning it.
Figma will be used for future screens before they are coded.

---

## Dashboard — Current Build State

Codex has done the major dashboard redesign and Figma-alignment work.

| Commit | Description |
|---|---|
| `37da12bc61a4e7f921ecb612e0cf404ef24930ce` | Major light-dashboard redesign (KPI cards, sparklines, monthly chart, mechanic productivity, YTD, sidebar, header, Hank UI) |
| `cca7923b0ca9f0e5326af9cbef543d161c459200` | Align dashboard layout with approved design (proportions, spacing, mechanic production, monthly chart sizing, YTD layout) |

The redesign was estimated at roughly 75%+ complete when Codex usage ran out.
The major architecture and visual direction are in place. Remaining work is likely:
design matching, spacing/responsive cleanup, visual refinement, testing, and final
verification — not a rebuild.

**Any agent picking up dashboard work must verify the actual current state from the
Figma file and the running app before making assumptions about what remains.**

---

## TV / Display Mode (`/tv`)

TV mode is a major planned feature. The concept is a full-screen, easily readable
display mounted in the shop, rotating through useful information every few seconds.

**Planned rotating screens:**
- Large-format shop dashboard / today's numbers
- Today's appointment schedule
- Mechanic productivity
- Tire/order arrivals
- Shop notifications
- Google reviews
- Important staff announcements

**Design direction:** TV mode is where expressive animation is appropriate.
- Animated counters and progress bars
- Screen transitions
- Temporary full-screen alerts
- Small celebrations when goals are reached

The **normal desktop dashboard** should remain more restrained. Animation belongs in TV mode.

Current implementation in `src/routes/_authenticated/tv.tsx` auto-cycles between
"numbers" and "tech" screens (120s per screen, 6 job rows per page, 30s per page).
The `display` role is purpose-built for this screen.

---

## AI / Hank

- Default name: **Hank**; configurable via `ai_settings.assistant_name`
- Model: OpenAI `gpt-5.6-luna` (fast tier). Standard/deep tiers reserved but route to same model today
- Tool-call rounds capped at 4 per turn (`SHOP_AI_MAX_TOOL_ROUNDS`)
- Voice: ElevenLabs TTS. API key is server-only, never sent to the browser
- STT: OpenAI Whisper via `transcribe.server.ts`
- Wake-word feature in `use-wake-word.ts`; configurable auto-listen/auto-speak
- Personality toggles (casual, humor, profanity, banter, customer-facing mode) stored in
  `ai_settings` and compiled into system instructions by `persona.ts`

**Future Hank capabilities:** text chat, voice interaction, file uploads, image understanding,
questions about shop data, reports, customer/shop information, mechanic voice dictation.

**Future Hank AI states:** listening, thinking, speaking, uploading, analyzing — the UI should
reflect actual AI state rather than a generic chat box.

**Architecture goal:** keep the AI layer reasonably provider-independent so the project
is not permanently locked to one provider.

---

## Data Import Pipeline

1. Staff uploads a file on `/imports`. Stored in Supabase Storage; row inserted into `imports`.
2. Server function triggers AI extraction → populates `extraction` JSON.
3. Manager reviews extracted data.
4. Manager approves → `accept_import_metrics` or `accept_import_records` called → data lands
   in `metric_snapshots`, `shop_jobs`, `inventory_items`, etc.
5. Import row moves to `accepted` status.

---

## Codex Staging / Safety Work

A significant GitHub development safety and staging audit was done by Codex on branch:
`codex/github-development-safeguards`

That work established:
- Safer GitHub development practices
- Staging/backend safeguards
- Testing infrastructure
- A separate Supabase staging environment

A draft PR represents this work. It has not yet been merged into `main`.
Any agent working on infrastructure or backend concerns should check that branch
before duplicating or conflicting with its work.

---

## Environment Variables

Managed via `.env` (local) and Vercel/Supabase project settings (production).
Never commit secrets. Server-side secrets (OpenAI, ElevenLabs) are accessed via
`process.env` in server functions only — never returned to the browser.

Key env vars:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — safe for browser
- OpenAI and ElevenLabs API keys — server-side only

---

## Deployment

- **Vercel** — preview deployments and long-term production hosting path
- **Nitro** build target: Cloudflare adapter
- **Lovable live preview:** `https://cvshopdesk.lovable.app`
- Pushes to `main` currently sync to Lovable and may trigger Vercel deployments
