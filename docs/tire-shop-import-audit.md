# TireShop import audit

Audit date: 2026-09-17  
Scope: read-only comparison of the independent staging database against the historical TireShop values already supplied for this project. No imports, writes, deduplication changes, or deployments were performed.

## Database identified

The accessible Supabase project is staging:

- Project: `cvshopdesk-staging`
- Reference: `fsmyugwrfuvqrrhufryf`
- Organization: Cedar Valley ShopDesk
- Status: ACTIVE_HEALTHY
- Region: us-east-2

The accessible database contains one shop, `Cedar Valley Tire & Auto Service`. It is staging and must not be treated as production.

The Vercel preview dashboard displayed Month to Date values of approximately $22,629 gross profit, 95 tires, and 118 cars, plus year-to-date values of $393,916 gross profit, 1,669 tires, and 2,339 cars. Those values match this staging database exactly apart from display rounding. This is strong evidence that the working preview is reading staging, but the Vercel environment URL remains masked in the provider UI and should still be confirmed directly before any write test.

## What is present in staging

The staging database has:

- 21 current `metric_snapshots` rows.
- Coverage from 2025-01-31 through 2026-09-16.
- All rows use `source = manual` and `import_id is null`.
- The notes identify the values as user-confirmed historical monthly reports and explicitly map Gross Profit to Order Profit, Tires to Tires, and Cars to Cars.
- The `imports` table has zero rows, so the original TireShop source files, hashes, storage paths, and extraction records are not retained in staging.
- Customer, vehicle, inventory, job, tire-order, technician-productivity, and AI-settings tables are empty.
- There is no Store 2 shop or Store 2 metric series in staging.

## Comparison with the supplied source values

### Store 1, 2025

The 12 staging rows match the supplied Store 1 values exactly:

| Measure | Source total | Staging total |
|---|---:|---:|
| Tires | 2,423 | 2,423 |
| Cars | 3,106 | 3,106 |
| Gross Profit / Order Profit | $546,438.23 | $546,438.23 |

Coverage is January through December 2025. No duplicate Store 1 2025 rows should be imported.

### Store 1, 2026

Staging also contains nine rows:

- January through August 2026: completed monthly records.
- September 2026: partial month through September 16.

Totals across those rows are 1,669 tires, 2,339 cars, and $393,916.10 gross profit. September is $22,628.94, 95 tires, and 118 cars and is marked partial in the row note.

### Store 2, 2025

The supplied Store 2 values total:

| Measure | Source total | Staging |
|---|---:|---:|
| Tires | 92 | Absent |
| Cars | 197 | Absent |
| Gross Profit / Order Profit | $114,686.20 | Absent |

Store 2 is not present as a second shop or as a separate metric series in the accessible staging project.

### Combined supplied 2025 values

The supplied Store 1 + Store 2 totals are 2,515 tires, 3,303 cars, and $661,124.43 gross profit. Staging contains only the Store 1 portion.

## Data or configuration that may exist only in Lovable/production

Production is not accessible through the current Supabase account, so these cannot yet be confirmed:

- Original TireShop files and their storage objects.
- Accepted import rows and extraction metadata.
- Customers, vehicles, inventory, jobs, and tire orders.
- Production technician productivity and AI settings.
- Production Auth users and memberships.
- Lovable-managed provider secrets, OAuth configuration, and callback settings.
- Any production corrections or records entered after the staging copy.

These items must be checked in Lovable/production before deciding what to retain. Password continuity is not assumed.

## Recommendation

Treat the Store 1 monthly metrics already in staging as the verified copy. Do not import them again. Use staging as the base for the new app only if the intended scope is Store 1 metrics plus the current staging records.

Store 2, raw source files, customer/inventory/job/order data, production users, and Lovable-only configuration require an explicit keep/discard decision. If any of those are required, transfer or recreate only those missing items after the production project and source-file evidence are accessible.

Staging is not production. Do not point the production domain or live shop workflow at it until the retained data set, Auth plan, Storage files, and write/cutover procedure are approved.
