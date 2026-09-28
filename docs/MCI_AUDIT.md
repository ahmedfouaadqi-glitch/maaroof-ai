# MCI Audit — Phase 0/1

| Tool | Kind | External data | LLM calls / run | Firecrawl / run | Existing cache | Duplication | MCI hook |
|---|---|---|---|---|---|---|---|
| known (MKD) | research | yes | 4–9 engines + 1 extract | 3–5 searches | none before MCI | same brand+market re-run from scratch | **active**: run reuse (7d) + engine answer cache (24h) |
| analyze | analysis | yes | 1–2 | scrape | analysis_cache | re-analysis of same URL | planned |
| compare | analysis | yes | 1 | 1–3 | firecrawl_cache | same pair re-compared | planned |
| research | research | yes | 1 | 3+ | firecrawl_cache | same query | planned |
| suggest | content | no | 1 | 0 | — | — | not applicable (creative output) |

## Rules applied
- Additive only: no tool prompts, algorithms or business logic changed.
- No token/word limits added. Cost is observability only (`mci_decisions`).
- Fail-open: any MCI error → the existing tool runs as before.
- Toggle: `app_settings.key = 'mci'` → `{ enabled }`; per-tool default in `src/lib/mci/registry.ts`.
- Reuse is per-user only (fingerprint = brand + market + depth); "Refresh now" forces a fresh run.
- Reused results are not charged (`reuseChargeRatio: 0`).
- Savings are reported only from measured rows, never estimated.
