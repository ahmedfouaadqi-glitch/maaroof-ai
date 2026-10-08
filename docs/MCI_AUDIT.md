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

## Phase 2 — Tool wiring by nature (2026-10-08)
- Reuse (same user + same request, no charge, `force` to refresh): analyze 24h, visibility 24h, compare 24h, research 12h, known 7d.
- Not wired (by nature): geo-strategist, what-if (generative/strategy — always fresh), outreach, bizdev, publishing, suggest, admin.
- Storage: `engine_answer_cache` with user-scoped key `tool:<tool>:<user>:<sha>`; decisions in `mci_decisions` (intent = tool key).
- Fail-open: any MCI error → tool runs exactly as before. Admin toggle in `app_settings.mci` (global or `tools.<key>`).

## Phase 3 — Agent (2026-10-08)
- Planning: `mciPlanningHints` (read-only, user-scoped) adds a context note listing tools with a fresh result; toggle `app_settings.mci.tools.agent`. Fail-open.
- Stage UI: reuse badge per step + "Show models" cards via `cardsForStep` (pure, no model calls).
