# ROADMAP.md — Cedar Valley ShopDesk

**Immediate goal:** Get the existing foundation into a professional, stable state before
adding new features. The sequence is:

> finish approved dashboard → verify it works → preserve data behavior →
> establish clean GitHub/Vercel development → finish separating from Lovable →
> **then** build TV mode, Hank, animations, and next-generation shop tools

Update this file when work ships or priorities change. See `HANDOFF.md` for the
immediate in-progress state.

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
- [x] TV / display mode (`/tv`) — auto-cycling screens, job board
- [x] Job board (`/board`) for current work orders
- [x] Major light-dashboard redesign by Codex (`37da12bc61a4e7f921ecb612e0cf404ef24930ce`)
  - KPI cards, sparklines, monthly chart, mechanic productivity, YTD, sidebar, header, Hank UI
- [x] Figma-alignment pass by Codex (`cca7923b0ca9f0e5326af9cbef543d161c459200`)
  - Proportions, spacing, mechanic production, monthly chart sizing, YTD layout
- [x] Multi-agent context infrastructure (AGENTS.md, PROJECT_CONTEXT.md, ROADMAP.md, HANDOFF.md, LOVABLE_NOTES.md, CLAUDE.md)
- [x] GitHub development safeguards and staging environment (Codex, branch: `codex/github-development-safeguards` — draft PR open, not yet merged)

---

## Priority 1 — Finish dashboard / Figma alignment (active)

The major redesign is estimated ~75% complete. The architecture and visual direction are
in place. What remains is likely design matching, spacing, responsive cleanup, and final
verification — not a rebuild.

**Before touching the dashboard:**
1. Read the Figma file: `https://www.figma.com/design/1GarIodYxJ1rBaTeuFYSVp`
   (page: **Dashboard — Reference review**)
2. Compare the running app against the Figma design screen by screen
3. List what actually differs before making any changes
4. Verify that data-integrity rules are intact (null values, partial months, productivity math)

**Design direction:** light, clean, modern, readable, polished, restrained Cedar Valley
branding. A professional shop application, not a generic admin template.

**Data rules that must be preserved:**
- Missing daily values stay missing, never silently become zero
- Partial current month must not visually imply a full-month downturn
- Mechanic productivity is based on actual stored values, not computed defaults
- No fake/placeholder data in any part of the UI

Once the dashboard matches the approved design, **stop redesigning it.**

---

## Priority 2 — Merge Codex staging/safety work

The `codex/github-development-safeguards` branch has a draft PR with significant safety
and staging infrastructure. Before other infrastructure work, this should be reviewed,
tested, and merged or superseded.

Do not duplicate or conflict with work already done there.

---

## Priority 3 — Clean GitHub / Vercel development workflow

- Confirm Vercel is the primary deployment path and it is working end-to-end
- Ensure preview deployments work correctly on feature branches
- Confirm the staging Supabase environment is properly separated from production
- Document the local dev → branch → preview → merge → production flow

---

## Priority 4 — Lovable dependency audit and migration

The project still depends on:
- `@lovable.dev/vite-tanstack-config` — drives the entire build
- `@lovable.dev/cloud-auth-js` — auth bridge

For each dependency, determine: **keep temporarily → migrate → remove**

Do not remove anything without understanding exactly what it provides.
See `LOVABLE_NOTES.md` for the full inventory and migration considerations.

---

## Priority 5 — TV Mode (full design + build)

TV mode currently has a working but basic implementation. The full vision:

**Rotating screens** (cycling every ~few seconds):
- Large-format shop dashboard / today's numbers
- Today's appointment schedule
- Mechanic productivity
- Tire/order arrivals
- Shop notifications
- Google reviews
- Important staff announcements

**Design and animation:** TV mode is where expressive animation is appropriate.
- Animated counters and progress bars
- Smooth screen transitions
- Temporary full-screen alerts
- Celebrations when goals are reached

Figma designs for TV mode have not yet been created. This is a Figma-first feature:
design before code.

---

## Priority 6 — Hank UI and voice improvements

- Implement real AI states in the UI: listening, thinking, speaking, uploading, analyzing
- Improve voice-mode UX (sound bar feedback, latency handling, wake-word reliability)
- Improve Hank's chat panel layout and message styling
- Expand Hank's tool coverage (tire order queries, productivity summaries, etc.)
- Keep the AI layer reasonably provider-independent

Figma designs for Hank interface states (listening, thinking, speaking, wake-state,
voice waveform) have not yet been created. Design before code.

---

## Priority 7 — Animation, micro-interactions, and polish

For the **desktop dashboard** (restrained):
- Smooth number transitions (count-up / fade-in on load)
- Skeleton loaders while data fetches
- Subtle hover and focus states

For **TV mode** (more expressive — see Priority 5).

Page transitions, chart animations, loading states, success/error states to follow.

---

## Future / Backlog

- Mobile layouts for key screens
- Employee onboarding flow
- Advanced goal-tracking UI (per-tech goals, progress arcs)
- Notifications push delivery (SMS / email channel integration)
- Full inventory management UI (currently view-only)
- Customer history view (vehicle → service history)
- Scheduling / appointment integration
- Export and reporting (PDF summaries, CSV exports)
- Multi-shop support (framework is multi-tenant; UI assumes single shop today)
- Offline / PWA support for the job board
- Deeper Hank integrations (create/edit tire orders, schedule jobs, voice dictation)
- Google reviews integration (for TV mode display)

---

## Notes for Agents

- Figma is the visual authority. Match it; do not design independently.
- Do not casually change production backend config, DNS, Supabase permissions, or auth.
- Null metric values must stay null. Do not default missing data to zero.
- The desktop dashboard should remain visually restrained. Expressive animation belongs in TV mode.
- New screen designs go through Figma before they are coded.
- Update this file when a priority ships or a new one is added.
