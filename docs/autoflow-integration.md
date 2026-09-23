# Autoflow integration

Status: API transport and disabled-by-default status webhook inbox implemented locally.
No live deployment or job-board sync yet.
Shop URL confirmed by the owner: https://cedarvalley.autotext.me/admin/v5.php.
API base: https://cedarvalley.autotext.me/api/v1/.

## Credentials

In the Autoflow administrator account, open Integration Setup to obtain the API
key and API password. Put them in the ignored `.env.local` file as
`AUTOFLOW_API_KEY` and `AUTOFLOW_API_PASSWORD`; use `AUTOFLOW_SUBDOMAIN=cedarvalley`.
Do not put credentials in chat, Git, browser code, or a `VITE_` variable.
The local file was initially created with blank credential fields for owner entry.

The webhook security key is separate. Autoflow generates one for each webhook;
do not create a subscription until a tested receiver URL is available. The current
example has a single `AUTOFLOW_WEBHOOK_SECURITY_KEY` slot for the first subscription.
Multiple subscriptions require separate key configuration.

## Verified API contract

Source: https://qc.autotext.me/api/v1/docs (read 2026-09-23).

- API requests use the shop's subdomain and HTTP Basic authentication with the
  API key as username and API password as password.
- Read appointments with `GET /appointments`, using `start` and `end` query values.
- Read inspection results with `GET /dvi/{RoNumber}`.
- Read work orders with `GET /work_orders/{RoNumber}`.
- The status webhook has `event.type=status_update`, `event.id`, and ticket,
  shop, customer, and vehicle objects. `ticket.id` is Autoflow's visit identifier;
  `ticket.remote_id` and `ticket.invoice` are separate identifiers.
- Verify `X-atme-hash` against the SHA256 digest of
  `ATME:{security_key}:{event.id}`. This is not an HMAC or a signature of the
  complete request body. A passing check alone does not establish body integrity,
  freshness, shop authorization, or protection from replay.

The documentation examples vary: some IDs are strings, others numbers, and absent
remote IDs may appear as empty objects. Preserve leading zeroes in RO numbers.
Do not assume `event.timestamp` is always present: the status example omits it.
The examples do not establish retry policy, ordering, pagination, or rate limits.

## Implemented

`src/lib/autoflow.server.ts` provides read-only transport with a validated shop
subdomain, timeout, refused redirects, no caching, and sanitized errors. Its JSON
result is `unknown` deliberately: resource schemas must be validated before use.
It also provides the documented hash verifier using constant-time comparison.
Tests use synthetic credentials and mocked responses; they never call Autoflow.

The POST route `/api/webhooks/autoflow` validates the hash and configured shop,
limits incoming JSON to 128 KiB, and stores status-update events in a private inbox.
It returns 200 only after durable storage (including a previously stored duplicate).
Storage failures return 503. Unsupported event types return 400.
Draft Drizzle migration `0025_autoflow_webhook_inbox` enables RLS and revokes all
client access; only the service role can insert/read. The first payload wins on
duplicate delivery. All records remain `pending_review`; no job data changes.
The payload remains untrusted because the provider hash does not cover its body.

The receiver requires all of these server environment variables:

- `AUTOFLOW_WEBHOOK_ENABLED=true` (default is disabled)
- `AUTOFLOW_SUBDOMAIN=cedarvalley`
- `AUTOFLOW_SHOP_ID`: verified Autoflow numeric shop ID, as text
- `AUTOFLOW_SHOPDESK_SHOP_ID`: verified ShopDesk shop UUID for the target environment
- `AUTOFLOW_WEBHOOK_SECURITY_KEY`: key for the status-update subscription
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: target environment's server credentials

Do not use production shop IDs against staging, or enable the handler before the
migration is applied. Local `.env.local` values do not configure the hosted app.
The owner entered `https://app.cedarvalleytire.com/api/webhooks/autoflow` in Autoflow;
that URL will work only after deployment and configuration. Keep the subscription
disabled until the deployment is verified. Only select the Status Update event.

Validation: a live read-only appointments request returned the expected envelope
on 2026-09-23; no customer data was printed. Mocked receiver tests and disposable
PostgreSQL tests cover denial, size limits, failed storage, RLS, and deduplication.
The built local route returns 503 when disabled. No remote migration was applied.

## Next implementation steps

1. Rotate credentials disclosed in conversation before live activation and set them
   directly in the target hosting environment. Do not log customer records or keys.
2. Confirm jobs/statuses as the first sync scope and bind the configured Autoflow
   shop to the correct ShopDesk shop ID and environment. Authorize that mapping
   on every browser-callable read before invoking this transport.
3. Define and test the status payload schema and matching rules against real
   redacted examples. Preserve ShopDesk local notes/status overrides and the
   existing snapshot audit chain; do not match solely by customer name.
4. Before implementing a processor, establish current-state lookup, out-of-order
   handling, and an explicit policy for the provider hash's limited body coverage.
   Confirm provider retry behavior and data-retention policy for the private inbox.
5. Review and apply the draft migration to verified staging, deploy/configure the
   receiver there, and verify real delivery before enabling the live subscription.

Some Autoflow write endpoints can trigger customer texts. Adding write-back or
messaging requires its own explicitly selected scope.
