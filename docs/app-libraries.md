# App libraries

Do not `bun add` this whole list. ShopDesk already has most of the daily stack.

## Already in the repo

- Forms: `react-hook-form` + `zod` + `@hookform/resolvers`
- Dates: `date-fns` + `react-day-picker` (use this before FullCalendar)
- Icons: `lucide-react` (stay on Lucide)
- Charts: `recharts`
- Spreadsheet import: `xlsx`
- Uploads: existing Supabase `shop-uploads` bucket — vehicle / tire photos go there, no extra package
- Data: TanStack Query + TanStack Start server functions + Drizzle/Supabase

## Add only when that screen is being built

- Tables: `@tanstack/react-table` — work orders, inventory, customers
- PDF / print RO: `@react-pdf/renderer`
- Email: Resend
- SMS reminders: Twilio

## Skip for now

- FullCalendar — `react-day-picker` is already here
- `src/lib/og` — that path was for a Next.js scaffold. This app is Vite + TanStack Start. Share cards can wait until we add a dedicated image route.
