- MCI (Context Intelligence) lives in src/lib/mci/: registry + fail-open resolver run before tools; additive only, never changes tool logic — why: cut repeat AI/web calls safely.

- MCI Foundation modules (types, canonical-entity, budget, freshness, evidence gate, provenance, selector) are pure and exported via src/lib/mci/index.ts; not yet wired into tools — why: review before integration.
- Router uses intent preloading — why: faster navigation; heavy libs stay lazy.
- MCI tool reuse goes through mciReuse/mciStore in src/lib/mci/resolver.server.ts, called at the start/end of a tool route only — why: one fail-open, user-scoped cache path that never alters tool logic.
- Dashboard tool UIs are React.lazy + Suspense; nine-engine cards for non-engine tools come from pure adapters in src/lib/engine-card-adapters.ts labelled estimated/recommended — why: faster dashboard and no fabricated live answers.
- Agent planning reads MCI hints via mciPlanningHints (read-only, fail-open); agent step cards use cardsForStep — why: fewer repeated steps without changing tool logic.
- Tool sub-operations (e.g. visibility.probe) charge via chargeTokens units/unitTokens and fall back to the parent tool price; probe policy lives in app_settings.tool_run_modes + per_user_tool_overrides.visibility — why: one balance system for every tool, no parallel pricing.
- Live probe background mode uses the Worker ctx.waitUntil exposed per request via AsyncLocalStorage (src/lib/request-ctx.server.ts, set in src/server.ts), falling back to awaiting inline — why: no job queue, and cloudflare:* imports break the build.
- Server functions are protected by createCsrfMiddleware filtered to serverFn only — why: block cross-site RPC without touching external webhook routes.

- Entity Truth Card fields live on profiles (entity_*, hq_country, target_markets); only server/admin may set verification/lock fields (trigger guard) and consistency checks are pure rules in src/lib/entity-consistency.ts — why: one zero-cost identity source for all tools.
