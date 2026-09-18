# ROADMAP.md — Cedar Valley ShopDesk

Current priorities are listed in order. Update this file when work ships or priorities change.
See `HANDOFF.md` for the immediate in-progress state.

---

## Shipped

- [x] Initial Lovable/TanStack Start scaffold and Supabase integration
- [x] Core dashboard (`/hub`) with daily, weekly, MTD, and YTD metrics
- [x] Metric snapshots with `is_current` / `superseded_by` correction chain
- [x] Role-based access control (owner / manager / staff / display)
- [x] Data import pipeline (upload → extract → review → accept)
- [x] Technician productivity tracking
- [x] Tire order management
- [x] Customer and vehicle records
- [x] Notification system with audience, priority, channels, and expiry
- [x] Hank AI assistant (chat, tool calls, shop data access, image generation)
- [x] ElevenLabs voice TTS for Hank
- [x] Wake-word detection for Hank
- [x] TV / display mode (`/tv`) with auto-cycling screens and job board
- [x] Job board (`/board`) for current work orders
- [x] Shared visual polish pass on dashboard; typecheck and tests passing
- [x] Mechanic productivity card added to dashboard

---

## Active / Near-term Priorities

### 1. Dashboard / Figma alignment
Complete the visual alignment between the running app and the approved Figma designs.
- Match layout, typography, spacing, and color tokens to Figma specs
- Ensure partial-month MTD data is clearly distinguished from closed-month data
- Remove any placeholder or stub UI that does not match the design

### 2. TV Mode polish
The `/tv` route works but needs design and UX polish.
- Align TV mode visuals with Figma display-mode designs
- Add smooth transitions between screen cycles
- Confirm readability at 1920×1080 from a distance

### 3. Hank UI and voice improvements
- Improve voice-mode UX (sound bar feedback, latency handling)
- Improve Hank's chat panel layout and message styling
- Expand Hank's shop-data tool coverage (e.g., tire order queries, productivity summaries)
- Test and tune wake-word reliability

### 4. Lovable dependency audit and migration
The project still depends on `@lovable.dev/vite-tanstack-config` and
`@lovable.dev/cloud-auth-js`. Evaluate which are safe to replace with
first-party equivalents and document a migration plan before acting.
See `LOVABLE_NOTES.md` for restrictions.

### 5. Multi-agent development workflow improvements
- Keep `AGENTS.md`, `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `HANDOFF.md` up to date
- Identify and document any sharp edges that slow agent handoffs
- Add a `bun run typecheck` script if not present so agents can validate without a full build

### 6. Animation, micro-interactions, and polish
- Smooth number transitions on the dashboard (count-up / fade-in)
- Skeleton loaders where data is still fetching
- Subtle hover and focus states on interactive elements

---

## Future / Backlog

- Advanced goal-tracking UI (per-tech goals, shop-wide targets with progress arcs)
- Notifications push delivery (SMS / email channel integration)
- Full inventory management UI (currently view-only)
- Customer history view (vehicle → service history)
- Scheduling / appointment integration
- Export and reporting features (PDF summaries, CSV exports)
- Multi-shop support (framework is multi-tenant; UI assumes single shop for now)
- Offline / PWA support for the job board
- Deeper Hank integrations (create/edit tire orders, schedule jobs)

---

## Notes for Agents

- Do not rewrite history on `main` or any pushed branch.
- Figma is the approved design authority — match it, do not design independently.
- Null metric values must stay null; do not default missing data to zero.
- Update this file when a priority ships or a new one is added.
