# Brand Boost automation deployment

This feature is implemented in the application branch, but background execution is not active merely because the code is merged or deployed.

## 1. Apply the database migration

Apply \`supabase/migrations/20261030170000_brand_boost_automation.sql\` to the Supabase project.

It creates crawler verification cache fields, opt-in monthly-report settings, and report-delivery records.

## 2. Configure the scheduler secret

Generate a random secret with at least 32 random bytes. Set it in the application runtime as:

- \`BRAND_BOOST_SCHEDULER_SECRET\`
- \`MAAROOF_TRUSTED_CLIENT_IP_HEADER\` — the exact single-IP header populated by the trusted ingress proxy. The proxy must overwrite client-supplied values. Do not use an arbitrary \`X-Forwarded-For\` chain.
- \`RESEND_API_KEY\`
- \`BRAND_BOOST_REPORT_FROM\` — an address on a verified sender domain in Resend.

The app does not read the Resend secret from the browser. Monthly reports are opt-in per account/workspace.

## 3. Configure Supabase Cron

In Supabase Vault, store:

- \`maaroof_app_base_url\`: the public origin of the deployed Maaroof application, without a trailing slash.
- \`maaroof_brand_boost_scheduler_secret\`: the same random secret as \`BRAND_BOOST_SCHEDULER_SECRET\`.

Then run \`supabase/automation/brand-boost-cron.sql\` in the Supabase SQL Editor. It schedules an authenticated POST every 15 minutes to \`/api/brand-boost-scheduler\`.

Monitor executions under Supabase Dashboard → Integrations → Cron → Jobs / Run history.

## 4. Schedule semantics and billing

- Weekly = twice in each seven-day period, spaced 84 hours apart.
- Daily = every 24 hours.
- Monthly = one calendar month after the prior run.
- The first scheduled run is due on the next scheduler tick after the user creates or resumes the job.
- Every Brand Boost run is sent through the existing \`/api/brand-boost\` route, so the normal token charging and operation ledger code is reused. The current route charges 5 units per execution.
- Failed runs are recorded and are not silently retried immediately; the next scheduled execution remains the next cadence. This avoids duplicate charges when a provider times out after receiving a request.

The scheduler processes at most five due jobs per tick and claims each job with a compare-and-set update on its prior \`next_run_at\` value to prevent concurrent duplicate dispatches.

## 5. Monthly email report

The report covers the previous complete UTC calendar month and is sent on day 1 of the next month. The owner must enter a recipient email and explicitly enable the setting in Brand Boost → Log. It includes operation counts, recorded usage units, crawler traffic and the subset verified by supported DNS checks.

Email delivery is not active until the Resend API key and a verified sender address are configured in the app runtime. Delivery attempts and status are stored; Resend idempotency keys reduce duplicate sends.

## 6. Crawler identity checks

Only Googlebot and Bingbot are DNS-verified in this implementation:

1. Read the source IP only from the explicitly configured trusted ingress header.
2. Reverse-resolve the IP and validate the provider hostname suffix.
3. Forward-resolve that hostname and require the original source IP to appear in the returned A/AAAA records.
4. Cache the result using a SHA-256 IP digest; raw source IPs are not persisted.

Other known crawler names remain \`user_agent_only\`, not verified. If no trusted ingress IP header is configured, requests are logged as \`source_ip_unavailable\`. The app does not infer identity from User-Agent text alone.

## 7. Deployment verification

After deployment and configuration:

1. Confirm the Cron job returns HTTP 200 in its run history.
2. Create a test Brand Boost job with explicit approval and a controlled balance.
3. Confirm one \`brand_boost_runs\` row, one \`brand_operations\` entry, updated \`last_run_at\`, and future \`next_run_at\`.
4. Test Googlebot/Bingbot from a controlled environment with a valid provider IP only; never spoof a User-Agent and count that as a positive verification.
5. Set a test monthly report setting and test the mail provider independently before enabling production recipients.

No production schedule, DNS verification, database migration, or email send is considered active until those external setup steps have been completed and observed.
