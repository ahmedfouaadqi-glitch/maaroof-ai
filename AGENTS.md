- MCI (Context Intelligence) lives in src/lib/mci/: registry + fail-open resolver run before tools; additive only, never changes tool logic — why: cut repeat AI/web calls safely.

- MCI Foundation modules (types, canonical-entity, budget, freshness, evidence gate, provenance, selector) are pure and exported via src/lib/mci/index.ts; not yet wired into tools — why: review before integration.
- Router uses intent preloading — why: faster navigation; heavy libs stay lazy.
- MCI tool reuse goes through mciReuse/mciStore in src/lib/mci/resolver.server.ts, called at the start/end of a tool route only — why: one fail-open, user-scoped cache path that never alters tool logic.
- Dashboard tool UIs are React.lazy + Suspense; nine-engine cards for non-engine tools come from pure adapters in src/lib/engine-card-adapters.ts labelled estimated/recommended — why: faster dashboard and no fabricated live answers.
