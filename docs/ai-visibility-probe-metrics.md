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

## Unified six-scenario query pack

The live probe now constructs six fixed scenario prompts in the selected audience language and market:

1. **Blind discovery:** does not name the target brand and requests up to five brands in explicit rank order. This is the only scenario used for organic mention rate, blind-list share of voice, and top-five rate.
2. **Brand recognition:** asks what the engine can verify about the brand and requires a structured recognition verdict.
3. **Recommendation:** asks whether the engine recommends the brand and requires one of `recommended`, `not_recommended`, `conditional`, or `unknown`.
4. **Comparison:** asks for relevant alternatives and a comparison verdict.
5. **Fact verification:** asks what is supported by evidence and requests an evidence level.
6. **Purchase intent:** assesses fit for a buyer in the selected market, without assuming that the brand serves that market.

The first blind question is sent in phase one. The five branded scenarios are batched into the existing phase-two request per engine to keep the existing two-call-per-engine charging model. Consequently, the five branded scenario answers share one model request and are **not five independent sessions**. `probe.query_pack_metrics` records this mode explicitly.

### Query-pack metric rules

- **Query coverage:** answered scenario observations / planned scenario observations.
- **Organic mention rate:** target mentions / successful blind-discovery answers only. Branded scenarios are excluded because their prompts explicitly name the brand.
- **Recommendation rate:** model-stated `recommended` verdicts / recommendation observations with an explicit decision verdict. Missing or unknown verdicts do not enter this decision denominator.
- **Verified evidence rate:** fact-verification observations labeled `verified` / fact-verification observations with a recognized evidence-level label. This is the engine's classification of supplied evidence, not an independent legal or factual audit.
- **Top-five rate:** target brand positions 1–5 / non-empty ranked blind-discovery lists only.
- **Blind-list share of voice:** target brand occurrences / all returned brand-list occurrences in blind-discovery answers only. It is not market share or the brand's share of all web/social mentions.
- Every ratio carries a numerator and denominator. A missing/failed observation is not converted into a negative mention.

### Social search sample

The social analysis runs a search query for each of six configured platforms (X, LinkedIn, Reddit, YouTube, Facebook, Instagram), with at most five returned search results per platform. It records each platform as either `measured` or `error`; a successful empty result is measured zero for that query, while a failed request is not interpreted as zero mentions.

The values `total_results_returned` and `unique_result_urls` are counts of records returned by the search provider. They are not total posts, audience reach, engagement, impressions, or complete platform mention counts. Sentiment is an AI assessment of the retrieved text snippets, not consumer survey or platform sentiment telemetry. Social share of voice remains `null` until comparable competitor results and a defensible denominator are collected.

### Shared UI, history, and exports

The dashboard's unified visibility interface shares brand, official website, geographic scope, and audience language between the AI-engine and social-search panels. Audience language also sets report language; geographic scope remains independent.

The history panel reads only the authenticated user's Brand Operations rows and applies the selected workspace filter. It shows a percentage-point comparison only when the brand, market, audience language, official website, and the relevant category/engine-model set or search-source set match. This is descriptive comparison, not causal attribution.

The existing result export bus receives the complete result object, including raw engine answers, per-scenario observations, query-pack metrics, social platform evidence, and metric denominators. No new scoring path is introduced for export.

### Official website fetch guard

When no category can be obtained from supplied keywords, profile or workspace knowledge, the probe may scrape the user-supplied official website to extract a category from its title, description, or page text. It does not infer a category from the brand name. Local/private-looking hostnames and literal IP hosts are rejected, and this code path disables the worker's direct-HTTP scrape fallback. The external retrieval provider's own network controls remain relevant; this local validation is not a general DNS-resolution guarantee.

