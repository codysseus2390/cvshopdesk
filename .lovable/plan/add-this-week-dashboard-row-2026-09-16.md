# Add “This Week” dashboard row

## What will change

- Reuse the existing weekly Numbers report builder inside the authenticated dashboard request.
- Return the current Monday–Sunday range, accepted weekly totals through the shop’s current day, and configured weekly goals.
- Insert a “This Week” section between Previous Day and Month to Date.
- Render Gross Profit, Tires Sold, Car Count, and GP Per Car with the existing `MetricCard` component and responsive grid.
- Show a dynamic, readable date range beside the heading.
- Calculate GP Per Car from total weekly gross profit divided by total weekly car count; show unavailable when cars are zero or missing.
- Show goal progress only when the existing Numbers & Goals rules produce a valid weekly goal.

## Shared data behavior

- No tables, records, or alternate weekly totals will be added.
- Daily corrections automatically flow through the shared accepted `metric_snapshots` data and `aggregatePeriod` logic.
- Hank already uses the same `buildNumbersReport` service for weekly questions, so dashboard and Hank remain aligned.

## Verification

- Add focused coverage for the weekly dashboard projection, including nulls, zero cars, derived GP per car, and goal percentages.
- Run focused tests and type checks.
- Verify the signed-in dashboard displays all four weekly cards in the requested order and date range.
