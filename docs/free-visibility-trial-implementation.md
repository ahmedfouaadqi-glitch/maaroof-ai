# MAAROOF free AI visibility trial — implementation and deployment notes

## Agreed behavior
- Manual entity type selection or conservative automatic classification.
- Website, social accounts and digital assets are optional; the form accepts none.
- The free route is isolated from the paid `POST /api/visibility` endpoint, MCI answer reuse and shared answer caches.
- Exactly three model routes are selected only when the resolved model IDs prove three distinct provider namespaces: OpenAI, Google, and one additional configured provider. The user-facing report displays engine labels only; provider and backend model IDs are not returned.
- A run is counted only when a reserved attempt transitions to running immediately before the first live model request.
- Report data is valid for 72 hours; exactly one additional report retrieval is allowed during that period.
- The next trial can start 77 hours after the prior genuine start (72-hour report period plus 5-hour cooldown), repeating without a lifetime cap.
- Account and canonical entity locks are atomic; device/session locks are supplementary; IP is an abuse-risk signal and is not a blanket lock for shared networks.
- VPN, proxy and Tor are checked server-side. Missing or uncertain IP intelligence fails closed.
- The contact handoff reads the existing admin-managed `app_settings.contact_info`; no contact details are hardcoded into the trial.
- The 10-engine catalogue and paid path remain unchanged.

## Implemented in this branch
- Landing page vector illustration and a multilingual link to the trial page.
- Live homepage aggregate counter backed by `visibility_trial_stats`, exposed through a public-safe `Cache-Control: no-store` endpoint and refreshed every 5 seconds plus on window focus.
- Private attempt ledger, RLS restrictions, idempotent start counter and atomic reservation/retrieval/completion RPCs.
- Account/entity/device/session advisory locks and an IP multi-account risk threshold.
- 72-hour result expiry, 77-hour cooldown and one-time report retrieval.
- Opportunistic expiry cleanup plus optional `pg_cron` scheduling when the extension is installed.
- Authenticated `POST /api/visibility-trial` with a separate live model route; it never calls the paid endpoint.
- Blind category discovery uses a separate prompt that omits the target entity name and all brand-linked assets. Organic mention/recommendation metrics are not reported when no category is supplied; if the blind request fails, that engine is excluded from the blind metric denominator.
- Three-route selection fails closed unless three different configured provider namespaces are available.
- Arabic, English and Kurdish trial UI, optional assets and report display.
- Unit tests for timing, entity normalization, HMAC separation and conservative classification.

## Public counter route\n`GET /api/visibility-trial-usage` returns only the aggregate total and an availability flag. It does not expose attempt records, account IDs, entity names, IP hashes, device hashes or session hashes.\n\n## Required server environment
These values must be configured in the target deployment environment; do not commit them:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `TRIAL_IDENTITY_SECRET` — random secret of at least 32 characters used for HMAC hashes of entity/device/session/IP signals. Keep it stable across deployments; rotating it invalidates existing lock fingerprints.
- `IP_RISK_CHECK_URL` — HTTPS endpoint for the organization's chosen IP intelligence provider.
- `IP_RISK_CHECK_TOKEN` — secret token for that provider.
- `APP_URL` — optional application URL sent as OpenRouter referer.

### IP intelligence adapter contract
The configured endpoint receives `POST { "ip": "..." }` with `Authorization: Bearer <token>` and must return JSON:
```json
{
  "vpn": false,
  "proxy": false,
  "tor": false,
  "risk": "low"
}
```
All three booleans and a risk value of `low`, `medium`, or `high` are required. The route rejects the trial when the provider is missing, times out, returns malformed data, or flags VPN/proxy/Tor/high risk. This adapter intentionally does not assume a vendor-specific API or invent an integration.

## Migration order
Apply the migrations in timestamp order from `20261113010000` through `20261113090000` in a non-production environment first. The homepage counter stays unavailable until the first migration is applied. Do not run production migrations as part of this branch work.

## Operational limitations
- Entity identity currently uses Unicode-normalized names (including Arabic diacritic/Alef/Ya normalization); transliteration and unrelated aliases are not guaranteed to collapse to one entity. Browser device identifiers are signals, not unforgeable hardware identity; a browser cannot read a MAC address.
- The current IP address is sent over HTTPS to the configured IP-intelligence endpoint for classification; only its HMAC hash is retained in the trial ledger. Select a provider whose privacy and retention terms are acceptable.
- IP risk services are probabilistic and cannot guarantee detection of every VPN or proxy.
- The third distinct provider is configuration-dependent. If the model registry does not resolve three provider-distinct model IDs, no trial starts and the counter does not increase.
- The model requests are live inference calls; they are not evidence of native first-party access to each named consumer product. The report is explicitly labelled a three-response sample, not a market-wide visibility measurement.
- A scheduled purge runs only when `pg_cron` is installed and permitted. Otherwise the API runs opportunistic cleanup on each trial request; expired reports remain inaccessible even before physical cleanup.

## Not done here
- No migration was deployed to Supabase.
- No environment secrets or IP intelligence vendor credentials were configured.
- No production model requests or production deployment were run.
- The pull request remains draft and `main` remains untouched.
