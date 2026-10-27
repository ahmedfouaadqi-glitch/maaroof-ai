# Search Intelligence: current architecture and next steps

## Existing capabilities to reuse

- `src/lib/spreadsheet-reader.ts` and `src/lib/spreadsheet-reader.server.ts`: parse multi-sheet XLSX/CSV and public Google Sheets into structured sheet rows.
- `src/lib/operational-workbook.ts`: builds keyword/market and operational report sections from the full file rows and recorded research; missing data is explicitly marked unavailable.
- `src/lib/keyword-clusters.ts`: forms bounded keyword clusters and measures literal keyword mentions in actual recorded answers from each model; an unmeasured keyword is not converted to zero.
- `src/routes/api/dual-result.ts` and `src/lib/competitive-geo.server.ts`: combine per-market public-web evidence with the existing ten-engine response workflow and operational workbook.
- `src/routes/api/research.ts`: research responses with source references and citation-oriented recommendations.
- `src/routes/api/visibility.ts`: brand visibility and answer-engine probe path.
- `src/routes/api/known.ts`: market/competitor discovery and per-engine response statuses.
- `src/routes/api/deep-audit.ts`: URL-level technical/content evidence for SEO, AEO, GEO, SGE and GSEO.
- `src/lib/maaroof/skill-catalog.ts`: a new Search & AI Visibility Strategy skill routes the goal to these existing tools; it does not introduce a new model or duplicate backend tool.

## SGEO and GSEO

SGEO is computed separately by `src/lib/maaroof/sgeo-synthesis.ts` from same-URL evidence overlap across SEO, AEO, GEO and SGE. Existing GSEO remains the fifth current audit axis. Neither the current axis catalog nor its weights were renamed or replaced. Details and scoring limitations are in [SGEO-DEFINITION.md](./SGEO-DEFINITION.md).

## Validation still required before calling the full plan complete

- Execute existing unit tests and production build against the new branch.
- Verify the complete customer workflow with a supplied workbook: all sheet names/rows preserved, markets and intent grouped correctly, and negative keywords not mixed into positive recommendations.
- Confirm website + competitor evidence includes source URLs and retrieval dates.
- Confirm the same query set is run across all ten engines where configured; record answer/empty/error/timeout status per engine and per query.
- Check cost estimation, approval, idempotency/cache behaviour and failure/no-charge rules without initiating any paid live probe.
- Check exports in Arabic, English and Kurdish and validate that the sources/evidence survive export.
- Perform a new workspace deep audit to confirm the new SGEO result is emitted, UI-visible and exported, while GSEO and the overall score remain unchanged.
