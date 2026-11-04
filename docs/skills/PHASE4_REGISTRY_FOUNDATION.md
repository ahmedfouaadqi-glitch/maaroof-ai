# Phase 4 — External Skill Registry Foundation

**Status:** Implemented on a dedicated branch; runtime activation intentionally disabled.  
**Baseline:** Phase 3 specification branch.  
**Registry source:** 80 uploaded ZIP archives audited on 2026-11-04.

## Delivered

- Added `src/lib/maaroof/external-skill-registry.ts`.
- Recorded 70 unique package variants representing 69 unique skill names.
- Removed 10 exact duplicate archive copies from the registry inventory.
- Preserved both distinct Humanizer variants (3.1.0 and 2.1.1) with separate SHA-256 digests and stable package IDs.
- Captured original archive name, SHA-256 digest, archive size, file count, reference count, eval-file count and bundled script count.
- Added compatibility bindings only to existing `ToolKey` identifiers. No new tools or engines were introduced.
- Added registry validation for duplicate IDs/digests, digest shape, expected corpus counts, candidate lifecycle, reference-only loading and Humanizer variant preservation.
- Added unit tests for corpus integrity, variant identity, disabled execution, existing-tool binding and unknown-skill lookup.

## Safety state

All 70 package variants remain:

- `lifecycle: candidate`
- `loadMode: reference_only`
- `executionAllowed: false`
- `evidenceRequired: true`

The logical `archive:sha256:...` content references are provenance locators, not runtime-readable files. The original ZIP contents, SKILL.md files, references and eval fixtures have **not** been vendored into the repository in this batch. The next source-ingestion batch must verify content extraction, path safety, digest integrity and reference indexing before any loader can consume them.

License status is deliberately conservative: a present LICENSE file is marked `review_required`, while packages without a bundled license file are marked `unknown`. No package is marked legally verified.

Bundled scripts were counted but not executed. External providers, credentials, publishing, database writes and paid API calls were not invoked.

## Explicit non-changes

- The existing 18-skill MAAROOF catalogue is unchanged.
- The ten-engine catalogue is unchanged.
- Existing tool identifiers and runtime routing are unchanged.
- No dynamic skill inference, instruction injection, reference loading or automatic execution was enabled.
- No database migration or settings change was made.

## Verification

Automated test cases were added but have not been run in this GitHub-only editing session. A local CI/test run is required before merge. Static registry checks should pass only after the test suite is executed in the repository environment.
