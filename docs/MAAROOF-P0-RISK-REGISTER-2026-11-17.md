# MAAROOF Ai — P0 Risk Register
**Date:** 2026-11-17  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Status:** DRAFT — P0 OPEN. Risk ratings are review priorities, not exploitability scores.

| ID | Risk / condition | Evidence class | Priority | Impact if confirmed | Current disposition |
|---|---|---|---|---|---|
| R-01 | A tracked `.env` path is visible in repository root metadata; `.gitignore` has no explicit `.env` rule. Contents were not opened. | Observed metadata | Critical review priority | Secret exposure and credential misuse | Verify safely outside chat/logs; rotate affected credentials if exposure is confirmed. Do not print values. |
| R-02 | Session export bus stores one result per tool key in a module-global map; no workspace/owner identifier exists in its key or record. | Confirmed source structure; runtime contamination not yet observed | High | A report may include a result captured under another workspace in the same app module instance. | Add workspace/owner scoping and workspace-switch tests in the appropriate implementation phase after P0. |
| R-03 | Workspace deletion UI confirms that a space and descendants will be deleted, then calls a server function. Persistence/cascade behavior is unreviewed. | Confirmed UI path; service behavior unknown | High | Loss of client history, reports, evidence, exports or other dependent data. | No deletion changes. Require archive-first/reversible semantics and dependency inventory before implementation. |
| R-04 | Tool history UI exposes per-item delete and clear-all operations; persistence semantics are unreviewed. | Confirmed UI path; service behavior unknown | High | Irrecoverable history loss or broken audit trail. | Preserve records by default; verify service behavior only if scope permits. |
| R-05 | Supabase-backed report builder and workspace components are not inspected beyond import boundaries due explicit exclusion. | Explicitly excluded | High / unknown | Ownership, workspace scoping, access control and data retention cannot be certified. | Keep all related acceptance claims UNVERIFIED. Do not bypass exclusion. |
| R-06 | MCI budget applies a 200-token minimum after model-window cap; for windows below 800, minimum may exceed 25% cap. | Confirmed static logic | Medium | Context budget contract is violated for small windows. | Add boundary tests and correct in a later approved code phase. |
| R-07 | MCI freshness checks do not explicitly reject timestamps later than now. | Confirmed static logic | Medium | Future-dated evidence can be treated as fresh. | Add future timestamp rejection and tests in later approved phase. |
| R-08 | Context selector accepts caller-provided reliability and token counts without explicit finite/range validation. | Confirmed static validation gap | Medium | Invalid values may distort ranking or budget selection. | Define accepted ranges and validate with boundary tests. |
| R-09 | Visibility metric calculator counts non-empty answers by normalized engine key without validating membership in requested engine set or answer status. | Candidate metric-integrity issue | Medium | Coverage/mention metrics may include unexpected or failed-status answers. | Confirm intended contract; add adversarial fixtures before changing implementation. |
| R-10 | Explicit `mentioned: false` may be overridden by text inference in visibility metrics. | Candidate semantic ambiguity | Medium | Contradictory telemetry may produce false positive mentions. | Define precedence between provider flag and text inference. |
| R-11 | Six-sheet XLSX export path does not visibly share the normal path's sheet-name sanitization. | Candidate path-specific defect | Medium | Invalid worksheet names may cause export failure for certain headings. | Add tests for forbidden characters, duplicates and length limits; preserve other formats. |
| R-12 | Evidence-pack truncation may omit failed/skipped limitation items without counting them in `omitted`. | Candidate output-completeness gap | Medium | Report may hide omitted limitations when character budget is reached. | Add overflow regression test and explicit omission note. |
| R-13 | Historical MCI audit documentation describes active wiring while current MCI index labels the foundation not yet wired. | Documentation discrepancy | Medium | Developers may misunderstand which generation is active and where MCI is applied. | Reconcile with permitted call-site inventory; do not inspect excluded persistence. |
| R-14 | CI workflow runs unit tests and production build but no explicit lint/typecheck step is defined in the reviewed workflow. | Confirmed workflow configuration | Low / process | Static analysis may not be enforced by this workflow. | Decide whether lint/typecheck belongs in CI after examining package scripts and project policy. |
| R-15 | CI build emits deprecated `inputValidator()` and dependency-level `use client` warnings. | Verified CI log warning | Low | Future dependency upgrades may make warnings actionable or break builds. | Track; not a current build failure. |

## Risk-handling rules
- Do not infer exploitability from a static candidate.
- Do not read, copy, print, or commit secrets.
- Do not inspect Supabase, auth internals, protected engine/catalog files, or excluded service paths.
- Do not change deletion behavior or introduce cascades/cleanup.
- Do not modify `main`, merge, deploy, or run paid/live probes.
- Any implementation must preserve existing export formats and the ten-engine catalog.

## Acceptance note
This register is incomplete until all permitted routes, components, libraries, tests and dependencies have been inventoried and all excluded controls are explicitly marked. It is a P0 working artifact, not a final security certification.
