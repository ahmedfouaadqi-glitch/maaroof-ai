# MAAROOF Attribution Intelligence — Foundation v1

## Scope of this increment

This branch adds an isolated Attribution Intelligence foundation under
`src/lib/maaroof/attribution/`. The domain calculations are pure; a separate,
explicit GA4 read function accepts an injected fetch implementation and token.
Nothing invokes that reader automatically. The branch does not replace AI
Visibility, change the ten AI engines, add a new tool, collect browser traffic,
persist analytics, connect to CRM systems, or access Supabase.

The goal of this first increment is to make the measurement rules explicit and
testable before introducing any event collector or data connector.

## Four separate measurement domains

1. **AI visibility** — brand mentions, answers, citations and measured probe output.
2. **Crawler activity** — requests provisionally identified as automated from available evidence.
3. **AI referral traffic** — sessions with explicit AI referrer or campaign evidence; non-crawler does not prove human identity.
4. **Business outcomes** — leads, conversions and revenue linked to a consented,
   workspace-scoped journey.

These domains must not be collapsed into one score. A brand mention does not
prove a click; a crawler fetch does not prove a human visit; a session does not
prove a lead; and an attributed conversion does not establish causal lift.

## Classification policy

The classifier applies the following order:

1. A user-agent matching a crawler marker is provisionally classified as `crawler` and excluded
   from human journey attribution.
2. An explicit UTM source identifying a known AI platform is `ai_referral`.
3. A recognized AI-platform HTTP referrer is `ai_referral`.
4. Explicit campaign tags are classified by their medium (paid search, email,
   social, or generic referral).
5. Recognized search and social referrers are classified into their channels.
6. A valid but unrecognized referrer is generic `referral`.
7. Missing referrer and campaign source is `direct` with low confidence.
8. Invalid or contradictory evidence remains `unknown`.

**Direct is never silently reclassified as AI.** A recognized AI host list is
versioned code and will require ongoing maintenance; unsupported AI products
remain unknown/referral until explicit evidence is added.

## Attribution models

- `first_touch`: 100% to the first eligible touch.
- `last_touch`: 100% to the last eligible touch.
- `last_non_direct`: 100% to the last eligible non-direct, non-unknown touch;
  falls back to the last eligible touch if none exists.
- `linear`: equal credit across eligible touches.
- `time_decay`: exponential half-life weighting; default half-life is seven days.

These are descriptive allocation models, not causal estimates. A conversion is
only attributed to touchpoints in the same workspace and at or before the
conversion timestamp. Crawler touchpoints are excluded.

## Data contract

The event schema requires an event ID, timestamp, nullable workspace ID,
nullable session ID, event name and consent state. Normalized event IDs are namespaced by provider to prevent cross-provider collisions. Optional fields include
landing/referrer URLs, user agent, campaign tags, monetary value and ISO 4217
three-letter currency code; currency precision is applied using the runtime's currency metadata.

The schema is intentionally strict. An adapter must validate and normalize its
input before passing events to the domain core. The current foundation does not
create identifiers, persist personal data, or infer consent.

## Privacy and security gates before collection

A live collector must not be added until the implementation defines and tests:

- consent behavior by jurisdiction and collection purpose;
- data minimization, retention, deletion and access policies;
- workspace ownership enforcement on every read and write;
- tenant-scoped session identity and event idempotency;
- bot filtering and spoofing limitations;
- secure ingestion, rate limits, payload size limits and abuse protection;
- documented treatment of blocked referrers, stripped UTMs and ad blockers.

No raw IP address is included in this initial contract. Do not add it by default.

## Planned integration sequence

- **A0 — Targeted architecture audit:** relevant visibility, social, workspace-guard
  and report boundaries were inspected; a complete repo-wide security audit and
  live Supabase/RLS verification remain outstanding.
- **A1 — Pure domain core:** source classification, event validation and
  deterministic attribution models. Added in this branch.
- **A2 — Adapter contracts:** provider normalization, explicit-consent gate for
  event-level records, in-batch deduplication, and GA4 aggregate-row mapping.
  A read-only GA4 Data API reader with pagination and a session-source aggregate
  projection/export are added. The reader requires the `analytics.readonly`
  OAuth scope; token acquisition/refresh, property discovery and app wiring are not implemented.
- **A3 — Conversion and revenue normalization:** confirmed/pending/reversed
  conversion normalization, duplicate guards, currency-separated aggregation,
  separate confirmed/pending/reversed amounts, explicit source-event membership,
  and provider-ID namespacing. Pure functions are added.
- **Sessionization:** supplied session IDs are grouped without inventing sessions;
  crawler-marked sessions are excluded from non-crawler session counts.
- **A4 — MAAROOF integration:** a workspace-scoped report projection is added,
  with Arabic/English/Kurdish export-section adapters; it is not yet wired into
  existing reports or UI.
- **A5 — Verification:** fixtures are added; actual test execution, tenant
  integration tests, privacy tests, lint and build remain outstanding.

## Current limitations

- This is a domain foundation, not a live analytics feature.
- No events are being collected or stored; repository interfaces are contracts only.
- A read-only GA4 Data API runReport function is implemented with injected fetch
  and short-lived token; it is not connected to OAuth, property discovery, UI or
  application workflows.
- No CRM connector, UI, report widget, scheduled job or new MAAROOF tool is wired.
- No concrete repository/storage adapter implements the tenant-scoped interface.
- Session totals depend on source-provided session IDs; missing IDs are counted as
  ungrouped events rather than converted into inferred sessions.
- The report projection only attributes conversions to explicitly listed source
  event IDs within the conversion session. Cross-session journeys require a
  separately consented pseudonymous identity link and are not implemented.
- The AI platform host registry is intentionally finite and cannot identify
  traffic when browsers strip referrers or tracking parameters.
- The current time-decay model is a transparent rule, not a learned model.
- The domain core does not verify whether a user-agent is genuine; production
  crawler verification requires network/source validation beyond a UA string.

## Integration risks identified in the existing code

- Direct visibility requests explicitly resolve the signed-in user and verify
  workspace ownership before reading workspace data.
- Social analysis uses the shared workspace guard and then scopes the workspace
  lookup to the signed-in owner.
- The shared workspace guard permits requests without a workspace ID to run in
  account-level scope; new attribution endpoints must define whether that scope
  is permitted rather than inheriting it accidentally.
- Existing report server functions authenticate the user, but several report
  reads and state transitions filter by report ID or workspace ID without an
  explicit owner lookup in the function body. Their tenant safety therefore
  depends on the applicable Supabase RLS policies.
- Supabase policies and live cross-tenant behavior were not inspected or tested.
  For that reason this branch does not write attribution data, wire into report
  persistence, or claim verified tenant isolation.

## External API references

- Google Analytics Data API `properties.runReport` reference:
  https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
- Google Analytics Data API dimensions and metrics:
  https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
- Google Analytics Data API report creation and pagination:
  https://developers.google.com/analytics/devguides/reporting/data/v1/basics

## Acceptance criteria for this increment

- Explicit AI referrer and UTM fixtures classify as AI referrals.
- Missing referrer remains Direct, never AI.
- Known crawler fixtures are separated from human traffic and excluded from
  attribution.
- Cross-workspace, cross-session and post-conversion touchpoints are excluded.
- All five attribution models return deterministic, normalized credits.
- Missing eligible touchpoints produce an explicit unattributed result.
