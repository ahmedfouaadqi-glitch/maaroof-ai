# MAAROOF free AI visibility trial — implementation notes

## Current baseline (main, 2026-11-13)
- The existing `src/lib/trial.ts` is deliberately disabled and returns zero remaining trials.
- `POST /api/visibility` currently runs the paid live probe, charges tokens, requires an official website, and records `visibility_probe` operations. It must not be repurposed as the free trial endpoint or counted as a free attempt.
- The current live probe uses the ten-engine catalogue and model/provider fallback metadata. This trial must use a separately verified three-engine allow-list without changing the ten-engine catalogue or paid path.
- The current landing page has three static metrics and obtains public data through `getLandingData`.

## Agreed trial policy
- Manual entity type selection and automatic entity-type discovery are both supported.
- Website, social accounts, URLs and all other digital assets are optional.
- Trial result data is isolated from MCI reuse and any shared/stale answer cache.
- One genuine first run; one result re-open/retrieval; further attempts before the next eligible time route to the contact screen.
- Result payload and evidence expire after 72 hours.
- A new run may start only after an additional 5-hour cooldown: eligibility is 77 hours after the previous genuine run started. This cycle repeats without a lifetime cap.
- Account and entity locks both apply. Device/session signals and IP risk signals are supplementary; browser JavaScript cannot read a real MAC address.
- VPN/proxy/Tor classification must be performed server-side. If classification is unavailable, the trial must not start; uncertain classifications should be rechecked rather than silently treated as clean.
- Contact details come from admin-managed settings, never hardcoded invented phone numbers or email addresses.
- The user-facing engine names are shown; provider and backend model identifiers remain internal.
- The paid visibility flow and ten-engine catalogue remain unchanged.

## Counter semantics
The homepage counter means **genuine free-trial runs started**, not page views, CTA clicks, reservations, paid probes, retries of the same HTTP request, or report re-opens.
The database function `mark_visibility_trial_attempt_started` increments the aggregate exactly once when an attempt transitions from `reserved` to `running`, immediately before the first real engine request.
A public landing query reads only the aggregate row; it never exposes user IDs, entity names, IPs, device fingerprints or attempt details.

## Implemented in this branch
1. Added a private trial-attempt table and public-safe aggregate counter.
2. Added an idempotent database transition that increments the aggregate only once per reserved attempt.
3. Exposed the aggregate through a read-only server function and a homepage metric that refreshes periodically.
4. Kept the existing paid `/api/visibility` path untouched.

## Not yet complete — do not enable the trial CTA
- Atomic reservation and account/entity lock RPCs with concurrency protection.
- A separate authenticated `/api/visibility-trial` execution path.
- Verified three-engine allow-list and live route checks (do not infer native product identity from the display name).
- Entity taxonomy, no-asset prompt construction, evidence-quality handling and trial-specific result storage.
- One-time result retrieval, expiry purge, 77-hour re-eligibility and indefinite cycle handling.
- Server-side VPN/proxy/Tor classification and fail-closed behavior.
- Admin-managed contact screen configuration.
- Unit, database-concurrency, integration and UI tests; migration deployment and production verification.

## Visual direction
Use the existing MAAROOF visual identity and motion primitives. Refine toward Linear's restrained information hierarchy and precise vector geometry, with React Bits-inspired motion used only for meaningful state transitions. Preserve Arabic, English and Kurdish; honor reduced-motion preferences; keep mobile layouts light; do not add a heavyweight animation dependency.
