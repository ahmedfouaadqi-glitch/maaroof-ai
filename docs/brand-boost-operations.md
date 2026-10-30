# Brand Boost production operations

## 1. Supabase database

Apply migrations in order, including:

- `20261030150000_brand_boost_workspace_scope.sql`
- `20261030153000_brand_operations_ledger.sql`
- `20261030170000_brand_boost_automation.sql`
- `20261030180000_brand_boost_email_verification.sql`

The email verification migration disables previously enabled recipients because those addresses were not verified by the new flow.

## 2. Scheduler heartbeat

Enable the `pg_cron`, `pg_net`, and Vault extensions in the Supabase project. Replace both placeholders in `supabase/scripts/brand-boost-cron-setup.sql` and run it in the SQL Editor.

Set these server environment variables:

- `BRAND_BOOST_SCHEDULER_SECRET` — exactly the same random value stored in Vault.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

The Cron job calls `POST /api/brand-boost-scheduler` every five minutes. Each tick claims at most two due jobs. It does not guarantee execution at the exact scheduled second. Weekly cadence means two runs 84 hours apart. Each run goes through the existing Brand Boost operation and its configured usage charge.

## 3. Monthly reports by email

Configure:

- `RESEND_API_KEY`
- `BRAND_BOOST_REPORT_FROM` — a sender address on a verified Resend sending domain.

The user enters a recipient address, requests a six-digit code, verifies the mailbox, then explicitly enables delivery. Codes expire after 15 minutes, resend is throttled to one request per minute, and failed code checks are limited to five attempts.

The scheduler sends the previous complete UTC calendar month's report on the first UTC day of each month. Delivery keys and provider idempotency keys reduce duplicate sends. A successful provider acceptance is recorded; inbox delivery remains subject to the mail provider and recipient mail server.

## 4. Crawler identity verification

The public Brand Authority endpoint classifies User-Agent strings. Only Googlebot and Bingbot receive DNS-based verification:

- Googlebot: reverse DNS hostname must end in `googlebot.com`, then forward DNS must resolve back to the same source IP.
- Bingbot: reverse DNS hostname must end in `search.msn.com`, then forward DNS must resolve back to the same source IP.

Set `MAAROOF_TRUSTED_CLIENT_IP_HEADER` only to a source-IP header that the hosting ingress overwrites and protects from client spoofing. Do not blindly trust a client-supplied forwarded header. Until a trusted source IP is configured, crawler requests remain unverified or User-Agent-only.

This verifies the supported crawler IPs at request time; it does not cryptographically authenticate every AI crawler. Other bot labels remain User-Agent classifications.

## 5. Operational checks before production

1. Confirm all migrations are applied in the target Supabase project.
2. Confirm the Cron heartbeat returns HTTP 200 and inspect Supabase Cron run history.
3. Create a test job in a non-production workspace and inspect `brand_boost_runs` and the operation ledger.
4. Verify a real mailbox and run a controlled report test.
5. Confirm `brand_boost_report_deliveries` records provider message ID and status.
6. Test crawler verification only behind the configured trusted ingress header; do not count User-Agent-only traffic as verified.

No automatic customer-domain publishing is implied. The customer installation ZIP remains a hand-off package until an authorized CMS/site connector and post-publish verification are implemented.
