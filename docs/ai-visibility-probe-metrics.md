# AI visibility probe metrics

## Scope

The live probe in `POST /api/visibility` runs a blind recommendation question followed by an evidence-grounded review for selected configured engine integrations. The new `visibility_metrics` object describes the successful blind answers returned by that run.

These are observed-sample metrics. They do not represent market share, all users of a product, or guaranteed results in the consumer-facing product UI. A configured API/model route may differ from the named consumer product; inspect the route/model metadata for every run.

## Metrics

- **Engine response coverage:** successful non-empty engine answers / requested engines.
- **Mention coverage:** engines whose answer mentions the target / engines with successful answers.
- **Mention rate:** successful answers mentioning the target / successful answers.
- **Recommendation rate:** successful answers whose returned ranked brand list contains the target / successful answers.
- **Share of voice:** target's unique brand-label appearances / all unique brand-label appearances in returned brand lists, summed across successful answers. This is a sample-level SOV, not market share.
- **Competitor breakdown:** top ten other unique brand labels, ranked by appearances across successful returned brand lists, with their sample-level SOV and answer appearance rate.
- **Evidence-matched citation rate:** answers containing a model-returned URL that exactly matches one of the collected evidence URLs / successful answers. It does not establish that the consumer product UI displayed a native citation.
- **Top-5 rate:** ranked brand lists placing the target in positions 1–5 / successful answers with non-empty ranked brand lists.
- **Average rank:** mean target position for answers where the target appears in the returned brand list and a positive rank is available.

All ratios include numerator and denominator. A zero denominator yields `null`, except engine response coverage which is 0% when engines were requested but none answered. Failed/empty responses are not treated as negative brand observations.

Because the current probe stores one blind answer per engine, mention coverage and mention rate coincide in a single run. They are retained as separate fields for compatibility with future multi-query sampling.

## Evidence and limitations

- The probe's `brands` array is a model-returned ranked list, not verified UI ranking telemetry.
- The source list is built only from collected public evidence. A URL counts toward citation rate only if the model also returned that exact URL.
- URL equality is exact; redirects, canonical URL variants, and query parameters can lead to conservative under-counting.
- A model may return inaccurate brands or URLs. These metrics measure observed output, not truth; inspect raw answers and evidence.
- Product/API identity is recorded by the existing integration registry. A proxy route is not proof that the native named product was queried.
- Compare runs only when brand, question, language, market, engine set, and collection method are sufficiently aligned.

## Integration

The metrics are returned as `probe.visibility_metrics`, stored in the Brand Operations ledger for synchronous and background probe runs, and displayed in the Engine Probe panel. The panel can compare selected percentage-point changes against the most recent prior measured run for the same owner, brand, and workspace. This is a descriptive comparison, not proof that a particular optimization caused the change. Existing model-generated `visibility_percent` from the standard visibility analysis remains explicitly labeled as an estimate and is not overwritten by these measured-sample metrics.

## Tests

Pure metric logic is covered by `src/lib/maaroof/visibility-metrics.test.ts`. Run with:

```sh
pnpm vitest run src/lib/maaroof/visibility-metrics.test.ts
```

A live-provider test is deliberately not part of the unit suite because it can consume paid usage. Test live integrations separately with an authorized, controlled test workspace.
