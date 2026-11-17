# MAAROOF Ai — P0 Risk Register
**Date:** 2026-11-17  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Status:** DRAFT — P0 OPEN. Risk ratings are review priorities, not exploitability scores.

| ID | Risk / condition | Evidence class | Priority | Impact if confirmed | Current disposition |
|---|---|---|---|---|---|
| R-01 | A tracked `.env` path is visible in repository root metadata; `.gitignore` has no explicit `.env` rule. Contents were not opened. | Observed metadata | Critical review priority | Secret exposure and credential misuse | Verify safely outside chat/logs; rotate affected credentials if exposure is confirmed. Do not print values. |
| R-02 | Session export bus stores one result per tool key without workspace/owner scope. | Historical source finding; current code rechecked | High | A report may include a result captured under another workspace in the same app module instance. | **Mitigated in source:** key and record now include workspaceId; reads filter exact workspace. Runtime/browser switching still requires E2E verification. |
| R-03 | Workspace deletion UI previously exposed a destructive path; persistence/cascade behavior remains unreviewed. | Historical source finding; current code rechecked | High | Loss of client history, reports, evidence, exports or other dependent data. | **Preventive guard applied:** destructive workspace operation is blocked server-side and delete UI controls removed. Archive/restore is not implemented; database cascade remains unverified. |
| R-04 | Tool history previously exposed per-item delete and clear-all operations. | Historical source finding; current code rechecked | High | Irrecoverable history loss or broken audit trail. | **Preventive guard applied:** server functions block both operations and destructive UI controls are removed. Persistent retention/restore still unverified. |
| R-05 | Supabase-backed report builder and workspace components are not inspected beyond import boundaries due explicit exclusion. | Explicitly excluded | High / unknown | Ownership, workspace scoping, access control and data retention cannot be certified. | Keep all related acceptance claims UNVERIFIED. Do not bypass exclusion. |
| R-06 | MCI budget previously applied a 200-token floor after the model-window cap. | Confirmed static logic; regression tests added | Medium | Context budget contract is violated for small windows. | **Fixed in source:** model-window cap now takes precedence over the normal floor; tested at a 500-token window. |
| R-07 | MCI freshness checks previously accepted future-dated evidence as fresh. | Confirmed static logic; regression test added | Medium | Future-dated evidence can be treated as fresh. | **Fixed in source:** negative evidence age is rejected. |
| R-08 | Context selector previously accepted unvalidated reliability and token counts. | Confirmed static validation gap; regression tests added | Medium | Invalid values may distort ranking or budget selection. | **Fixed in source:** reliability must be finite and within 0..1; token count must be a non-negative safe integer; invalid items are excluded with provenance reasons. |
| R-09 | Visibility metric calculator counts non-empty answers by normalized engine key without validating membership in requested engine set or answer status. | Candidate metric-integrity issue | Medium | Coverage/mention metrics may include unexpected or failed-status answers. | Confirm intended contract; add adversarial fixtures before changing implementation. |
| R-10 | Explicit `mentioned: false` may be overridden by text inference in visibility metrics. | Candidate semantic ambiguity | Medium | Contradictory telemetry may produce false positive mentions. | Define precedence between provider flag and text inference. |
| R-11 | Six-sheet XLSX export path does not visibly share the normal path's sheet-name sanitization. | Candidate path-specific defect | Medium | Invalid worksheet names may cause export failure for certain headings. | Add tests for forbidden characters, duplicates and length limits; preserve other formats. |
| R-12 | Evidence-pack truncation may omit failed/skipped limitation items without counting them in `omitted`. | Candidate output-completeness gap | Medium | Report may hide omitted limitations when character budget is reached. | Add overflow regression test and explicit omission note. |
| R-13 | Historical MCI audit documentation describes active wiring while current MCI index labels the foundation not yet wired. | Documentation discrepancy | Medium | Developers may misunderstand which generation is active and where MCI is applied. | Reconcile with permitted call-site inventory; do not inspect excluded persistence. |
| R-14 | CI now includes unit tests, lint baseline diagnostic, TypeScript validation and production build. | Confirmed workflow configuration and run steps | Low / process | Repository-wide lint baseline is very noisy and not enforced as a blocking gate. | **Partially mitigated:** steps exist; lint is diagnostic/non-blocking. Keep baseline lint debt open until a controlled cleanup. |
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


## 6. Additional source-level verification (export, metrics and evidence packing)

### R-11 — Six-sheet XLSX worksheet-name sanitization
**Reclassified: confirmed static defect in the `six_sheets` branch.**
- In `src/lib/exports.ts`, the `excelLayout === "six_sheets"` branch truncates headings to 31 characters and resolves duplicate names, but does not replace Excel-forbidden worksheet-name characters `\\ / ? * [ ] :`.
- The normal multi-sheet path later in the same file uses `createUniqueSheetName`, which does replace those characters.
- No dedicated export.ts test file was found in the current tree; existing export-format tests do not establish this branch's invalid-name behavior.
- Runtime failure for a specific input was not executed; the source-level difference is confirmed. Add a shared sanitizer and regression tests in the export implementation phase.

### R-09 — Visibility metric engine/status semantics
**Reclassified: confirmed implementation behavior; intended contract still needs owner decision.**
- `calculateVisibilityProbeMetrics` counts any answer with a non-empty `answer` field, regardless of its `status` value.
- It does not restrict observed answers to the normalized `requestedEngines` set. Therefore an unexpected engine key can increase `answered_engines` and numerator while denominator remains the requested-engine count.
- Existing tests cover empty answers as failures, but not a non-empty answer with `status: "failed"` or an engine absent from the requested set.
- Decide whether status is authoritative and whether unexpected engines should be excluded or reported separately; add adversarial tests before modifying metrics.

### R-10 — Explicit negative mention flag precedence
**Confirmed source behavior; semantic contract unresolved.**
- `mentioned: false` does not prevent the fallback text matcher from marking an answer as mentioned when the brand string appears in the answer text.
- Existing tests do not cover this contradictory combination.
- Define whether an explicit provider boolean overrides text inference or whether text inference is intentionally additive.

### R-12 — Evidence-pack failed-step omission
**Confirmed static completeness gap.**
- Failed/skipped step summaries are included only if the full limitations section fits the remaining character budget.
- If it does not fit, the code does not increment `omitted` or add a limitations-truncated marker; the final omitted note counts successful results only.
- Existing test covers one small failed step and successful-output overflow, not failure-section overflow.
- Add an explicit failed-limitations omission count/marker and regression test before relying on this pack as a complete limitations record.


## 7. R-01 evidence strengthened — tracked environment file

**Reclassified: confirmed public-repository exposure of a tracked `.env` file; contents intentionally not inspected.**
- The recursive Git tree at current branch head contains a root `.env` blob (685 bytes).
- The repository is public.
- The tracked `.gitignore` does not contain an `.env` ignore rule.
- Git path history shows `.env` commits dated 2026-05-07 and 2026-06-05.
- No file content, key names, values or credentials were opened, copied or emitted.
- This proves the environment file is tracked in the public repository; it does **not** establish which values are valid or whether they are secrets.

**Required incident response (not executed):**
1. Treat every credential that may have been present in this file as potentially exposed.
2. Rotate/revoke affected API keys, database credentials, signing secrets and provider tokens through their owning services.
3. Replace the tracked file with a non-secret example template and add appropriate ignore rules in a separately approved remediation change.
4. Consider repository-history cleanup only after rotation and with a coordinated plan; rewriting public history is not a substitute for rotation.
5. Do not paste the file contents into chat, logs, tickets or reports.

The audit did not perform credential rotation, file deletion, history rewrite or secret scanning. Those actions require owner-controlled service access and explicit authorization.

## 8. Reassessment after source-level fixes — 2026-11-17

- R-02 is mitigated in the session export bus by explicit workspace keys and exact-workspace reads; browser E2E remains outstanding.
- R-03 and R-04 have preventive server-side blocks and UI removal; reversible archive/restore remains unimplemented.
- R-06, R-07 and R-08 are corrected in the pure MCI foundation with boundary regression tests.
- R-11 and R-12 were corrected in the export/evidence-pack implementation and covered by tests.
- R-01 remains unresolved: the tracked root `.env` exposure has not been remediated, and no credential rotation or history rewrite was performed.
- R-05 remains explicitly unverified because Supabase, RLS and persisted data were excluded.
- R-09 and R-10 remain product-semantic decisions; no metric precedence change was made without an approved contract.
- R-13 remains a documentation/runtime-generation reconciliation item.
- R-15 dependency and framework warnings remain tracked.

The register remains **DRAFT / P0 OPEN**. Source-level fixes do not certify persistence, RLS, live tenant isolation or end-to-end behavior.
