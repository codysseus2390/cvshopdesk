# Current-month chart treatment

## Scope
- Keep the dashboard graph on the existing monthly Numbers data and preserve every stored value.
- Change only the graph presentation and focused tests.

## Implementation
- Split each current-year metric series into completed-month values and the current month-to-date point.
- Draw the normal solid yearly line only through the last completed month.
- Show the current month as a same-color standalone point, with an optional subtle dashed connector from the prior completed month.
- Keep future months empty and historical years unchanged.
- Update the tooltip to label the current point “Month to date” with its real metric value.
- Determine the current month from the shop business date already returned with dashboard data, so it advances automatically.

## Verification
- Add focused chart-data tests covering completed months, current MTD, future nulls, historical years, and all five selectable metrics.
- Verify the dashboard renders January–December and the current MTD point remains exact while excluded from the solid line.
