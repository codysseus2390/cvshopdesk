# Mobile dashboard mockup refinement

## Changes

- Simplify the dashboard header by removing the visible shop-day and last-saved line.
- Refine the mobile header, logo/action card, icon navigation, Today row, KPI cards, and assistant composer to match the supplied mockup using existing components and tokens.
- Add an Owner/Admin-only action in the existing notification bell panel that opens the existing announcement composer; staff remain read-only.
- desktop behavior, dark mode, all routes, data, permissions, and backend logic should match changes made with mobile dashboard.

## Technical details

- Limit edits to shared presentation components and the dashboard route.
- Reuse the current permissions hook, notification functions, and notification composer.
- Add no packages, migrations, sample data, or new routes.

## Validation

- Run the existing TypeScript check and quick test suite only.
