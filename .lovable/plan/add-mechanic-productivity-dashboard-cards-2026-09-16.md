# Add Mechanic Productivity dashboard cards

## Shared reporting behavior

- Add one overall `mechanic_productivity` metric to the existing Numbers report, goals, exports, and Hank `get_numbers_report` result.
- Calculate overall productivity as total billed hours divided by total worked hours when both are available.
- Let an accepted overall daily/monthly/yearly value override calculated inputs for that exact reporting period.
- Never average mechanic percentages to produce the shop-wide percentage; return unavailable when no valid total or accepted overall value exists.
- Store corrections through the existing `technician_productivity` reporting path using a reserved shop-overall identity, not a new table or dashboard-only value.

## Dashboard

- Return Previous Day, This Week, and Month to Date overall productivity from the shared reporting service.
- Add the fifth `MetricCard` to each row with the existing design, a productivity icon, compact percentage formatting, and existing goal-progress treatment.
- Use five columns only on sufficiently wide screens and preserve natural wrapping below that width.

## Goals and Hank

- Add Mechanic Productivity to existing Numbers & Goals configuration.
- Include it in the existing secure Numbers/Hank report output for weekly, monthly, yearly, and current/previous-day questions.
- Keep missing data as `—`; never substitute zero.

## Verification

- Test accepted overrides, weighted hours calculation, missing/zero worked-hours behavior, formatting, goals, and dashboard projection.
- Run focused tests and type checks.
- Verify all three signed-in dashboard rows contain five cards and existing cards remain unchanged.
