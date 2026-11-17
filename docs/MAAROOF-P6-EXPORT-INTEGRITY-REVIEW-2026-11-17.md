# MAAROOF Ai — P6 Export Integrity Review

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Scope:** preserve existing export formats and correct verified pure export defects.

## Existing export surface preserved

The existing report export formats remain in place:
- PDF through browser print with HTML fallback.
- XLSX.
- CSV.
- DOCX.
- PPTX.
- Markdown.
- JSON.
- Machine-readable outputs where entity data is available: `llms.txt`, Organization JSON-LD, and FAQPage JSON-LD.

The website's `robots.txt` and `sitemap.xml` remain site-level resources, not client report formats. No existing export format was removed or renamed.

## Fixes implemented

### Excel worksheet names
- Added `src/lib/export-worksheet-name.ts`.
- Both the six-curated-sheet XLSX path and the regular workbook path now use the same sanitizer.
- The sanitizer replaces forbidden/control characters, trims boundary apostrophes, enforces the 31-character limit, and uses a fallback for empty names.
- Added unit tests for forbidden characters, maximum length, apostrophes and fallback behavior.

### Execution evidence completeness
- Added `omittedFailed` to the evidence-pack result.
- Failed/skipped step summaries omitted by the prompt character budget are now counted and represented by an explicit omission marker.
- The evidence pack reserves character budget for execution limitations before adding successful result payloads.
- Added a regression test with many failed steps and a constrained character budget.

## Other findings retained

- No browser-based PDF/print test, DOCX/PPTX/XLSX round-trip test, RTL/LTR visual comparison, or large-file browser test was run.
- ReportBuilder's database-backed metric/history pagination remains outside this implementation because the storage contract is excluded.
- Visibility metric semantics remain an open contract question: answer status, requested-engine membership, and precedence between explicit `mentioned: false` and text inference require a product decision before code changes.
- Export bus workspace scoping is documented separately in the P3 review. Persisted history and report-template isolation remain unverified.

## Verification status

- Regression tests added; CI for the latest export commits is pending at document creation.
- Existing formats were preserved in source; no claim of full end-to-end format validation is made.
- No paid probes or external model calls were run.

## P6 status

**PARTIAL — two confirmed integrity defects corrected with regression tests.** Full browser/round-trip export validation and persisted data completeness remain outstanding.
