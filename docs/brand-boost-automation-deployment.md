# Brand Boost automation deployment

Merging or deploying this code does not activate background execution. Production automation starts only after the database migrations, server environment, Supabase Vault secrets, and Cron job are configured.

## 1. Apply database migrations

Apply the Brand Boost migrations in order:

- `20261030150000_brand_boost_workspace_scope.sql`
- `20261030153000_brand_operations_ledger.sql`
- `20261030170000_brand_boost_automation.sql`
- `20261030180000_brand_boost_email_verification.sql`

See [Brand Boost production operations](./brand-boost-operations.md) for the full deployment checklist. The email-verification migration disables previously enabled recipients because they have not completed the new verification flow.

## 2. Configure application environment

Set these values in the server runtime:

- `BRAND_BOOST_SCHEDULER_SECRET` — a long random secret; use the same value in Supabase Vault.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `MAAROOF_TRUSTED_CLIENT_IP_HEADER` — the exact single-IP header populated and overwritten by the trusted hosting ingress. Do not trust an arbitrary client-supplied `X-Forwarded-For` chain.
- `RESEND_API_KEY`
- `BRAND_BOOST_REPORT_FROM` — an address on a verified Resend sender domain.

The Resend key is server-side only. Monthly reports remain opt-in per account/workspace and require mailbox verification before enabling delivery.

## 3. Configure Supabase Cron

Enable `pg_cron`, `pg_net`, and Vault in the Supabase project. Replace the two placeholders in `supabase/scripts/brand-boost-cron-setup.sql`, then run that script once in the SQL Editor.

The script creates or updates these Vault secrets:

- `maaroof_app_base_url` — the public origin of the deployed Maaroof application, without a trailing slash.
- `brand_boost_scheduler_secret` — the same random value configured as `BRAND_BOOST_SCHEDULER_SECRET` in the application runtime.

The Cron heartbeat calls `POST /api/brand-boost-scheduler` every five minutes. Each invocation claims at most two due jobs. The HTTP request timeout is configured to 300 seconds because scheduled Brand Boost work can take longer than a short health-check request.

The older path `supabase/automation/brand-boost-cron.sql` is retained as a compatibility copy of the same setup; use the `supabase/scripts` path as the canonical instructions.

Monitor executions under Supabase Dashboard → Integrations → Cron → Jobs / Run history.

## 4. Schedule semantics and billing

- Daily jobs are scheduled 24 hours apart.
- Twice-weekly jobs are scheduled 84 hours apart.
- Monthly jobs follow the calendar-month cadence.
- A new or resumed job becomes due on the next scheduler tick.
- Each job reuses the existing `/api/brand-boost` execution path, configured usage charging, and operation ledger.
- Failed executions are recorded. They are not immediately retried; the next attempt follows the next scheduled cadence.

The scheduler uses a compare-and-set claim on the previous `next_run_at` value to reduce concurrent duplicate dispatches.

## 5. Monthly email reports

Reports summarize the previous complete UTC calendar month, including recorded operation counts, charged usage units, and crawler observations. The scheduled send begins on the first UTC day of the new month; retry attempts remain eligible during the first seven UTC days.

The recipient must request a six-digit verification code, verify mailbox ownership, and explicitly enable reports. Codes expire after 15 minutes, resend requests are throttled to one per minute, and verification attempts are limited to five.

Delivery attempts and provider message IDs are recorded. Acceptance by Resend does not guarantee arrival in the recipient's inbox.

## 6. Crawler identity checks

Only Googlebot and Bingbot receive DNS-based identity verification:

1. Read the source IP only from the configured trusted ingress header.
2. Reverse-resolve the IP and validate the provider hostname suffix.
3. Forward-resolve that hostname and require the original IP to appear in the returned A/AAAA records.
4. Cache the result using a SHA-256 IP digest; raw source IPs are not persisted.

Other known crawler names remain User-Agent classifications, not verified identities. Without a correctly configured trusted ingress header, the source IP is unavailable and crawler identity cannot be verified.

## 7. Deployment verification

After deployment and configuration:

1. Confirm all migrations have been applied to the target Supabase project.
2. Confirm the Cron heartbeat receives a successful HTTP response and inspect Supabase Cron run history.
3. Create an approved test job in a non-production workspace with a controlled balance.
4. Confirm the run appears in `brand_boost_runs` and `brand_operations`, and that `last_run_at` and `next_run_at` are updated.
5. Verify a controlled mailbox end-to-end before enabling real report recipients.
6. Test crawler verification only behind the configured trusted ingress; a User-Agent string alone is not a positive verification.

No production schedule, DNS verification, email delivery, or customer-domain publishing is active until its external setup and runtime behavior have been explicitly verified. The customer website ZIP remains a hand-off package; it does not publish to a customer CMS/domain or modify that site's sitemap or robots file.
