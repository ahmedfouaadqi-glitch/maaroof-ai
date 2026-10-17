# MAAROOF Workspace and Skill Layer — Implementation Audit

## Purpose

Introduce a non-technical default workspace without replacing the existing MAAROOF orchestrator, tools, AI engine registry, token policy, memory, or professional interface. This is an additive first phase.

## Existing architecture reused

- `src/routes/workspace.tsx`: goal-first workspace, skill suggestions, model selection, streaming activity, clarification handling, and result view.
- `src/routes/api/maaroof.ts`: authenticated SSE endpoint, workspace ownership checks, existing session/tool token policy, model entitlement checks, and live-probe selection.
- `src/lib/maaroof/orchestrator.server.ts`: existing planning, expert council, tool selection, tool execution, reflection, and result stream.
- `src/lib/tool-catalog.ts` and `src/lib/tool-options.ts`: existing tool/capability definitions and tool input metadata.
- `src/lib/ai-engines.ts` and `src/lib/ai-engines.server.ts`: existing ten-engine catalog and server-side eligibility policy.
- `src/lib/tokens.functions.ts` and `src/lib/tokens.server.ts`: existing cost preview, charging, balance, and per-user limits.
- `src/lib/maaroof/capability.server.ts`: existing capability-to-expert selection; not duplicated by the user-facing skill layer.
- `src/lib/maaroof/hermes.server.ts`, `lab.server.ts`, `benchmark.server.ts`, `trust.server.ts`, `knowledge.server.ts`, and `execution.server.ts`: existing proposal, experiment, benchmark, trust, knowledge, and execution systems to reuse for the future skill-evolution cycle.

## Skill model

A user-facing skill is a curated composition of existing executable tools, not a second tool runtime. The first catalog covers research, market intelligence, competitor analysis, AI brand visibility, content creation, growth strategy, social intelligence, and business outreach. Skill-to-tool mappings are deduplicated before being sent to the existing orchestrator.

The current orchestrator has explicit internal endpoint mappings for these 17 user-facing tools:

`analyze`, `suggest`, `compare`, `known`, `feasibility`, `bizdev`, `research`, `visibility`, `brand_boost`, `company_email`, `applied_ranking`, `geo_strategist`, `competitor_monitor`, `social_analysis`, `what_if`, `brand_authority`, and `geo_rewrite`.

Other catalog entries such as `translate`, `teach_space`, `maaroof`, and `agent.*` are not automatically exposed as user skills here: the current orchestrator does not map all of them to executable tool endpoints. They need a reviewed execution contract before being included, rather than a UI label that implies an action works.

## Admin-controlled workspace policy

Stored in the existing `app_settings` table under `user_interface_policy`; no migration or new table is introduced in this phase. Controls include:

- Enable or disable the workspace.
- Set the default navigation target (workspace or professional interface).
- Show or hide the professional-interface link.
- Enable or disable the live engine picker.
- Allow or disallow execution, recommendation, and simulation modes.
- Set each skill to self-service, contact-required, or disabled.
- Apply skill overrides by active subscription plan and by individual user (user overrides win over plan, then global defaults).
- Apply the same licensing modes to individual tools, with global, plan-specific, and user-specific overrides.
- Enforce tool licensing in the shared token-charging path before metering, including direct endpoint calls; a gated tool returns a localized contact-required response with `/contact`.

The workspace applies these settings to the UI, and `/api/maaroof` validates interface availability for both workspace and professional requests. Requests without an explicit interface marker are treated as professional requests for compatibility with existing clients. Workspace requests additionally validate selected skills and live-check availability. Existing server-side pricing, model entitlements, and balance checks remain authoritative. Tool access licensing is additive and does not change any configured price or balance.

## Profile and professional interface

- The existing `/maaroof` professional interface remains in place; its task view and tool panels were not redesigned.
- The global primary navigation and homepage calls to action now lead to `/workspace`, subject to the admin default-interface setting.
- The existing profile route and profile fields were not modified.
- The requested one-time profile enrichment (after profile completion, use the platform's relevant capabilities and save a durable user-specific knowledge profile) remains a separate backend milestone; it has not been claimed as implemented by this UI phase.

## Skill evolution — intentionally not yet activated

The current skill definitions and skill availability policy are version-controlled code/config, not a live self-editing registry. Production self-modification is not enabled. The next implementation phase should extend the existing Hermes proposal queue and lab/benchmark/trust/knowledge systems to:
1. Detect evidence-backed opportunities from actual task outcomes.
2. Draft a versioned skill or tool-change proposal with expected benefit, cost, risks, affected tools, tests, and rollback.
3. Run isolated tests/benchmarks against a baseline.
4. Require founder/admin approval before changing the active registry.
5. Publish an approved version with audit history and a rollback path.

Do not create a parallel proposal/experiment system or let a skill rewrite production tools directly.

## Validation status

- Added focused unit tests for skill recommendations and tool mappings.
- Repository metadata currently shows no GitHub Actions workflow runs or check results for the current branch head.
- The GitHub repository connector does not provide a local dependency install/build/test runtime here, so the new code has not been reported as build- or test-passing. Run `npm test`, `npm run lint`, and `npm run build` in the project environment before merging.
- Changes remain on `feat/maaroof-skills-workspace-clean`, currently ahead of `main`; no merge, deployment, or production configuration change was performed.


## Interface availability and account preferences

The admin policy now supports:
- Both interfaces enabled, with an admin-selected default.
- Workspace only.
- Professional interface only.
- Optional per-account interface choice when both are enabled.

The user's preference is stored in Supabase Auth `user_metadata.preferred_interface`, so it follows the account rather than only one browser. If the preferred interface is disabled by admin, navigation falls back to the configured default/available interface. Existing profiles and token balances are not modified by this feature. The API validates requested interface availability, so hiding a navigation link is not the only control. The admin panel also exposes per-skill and per-tool licensing overrides at global, plan, and user scope.

## Balance and charging audit

- The account's authoritative balance remains `profiles.tokens_balance`; daily/monthly counters and limits remain in the existing profile fields.
- `getCostPreview` resolves the existing per-user override/plan pricing and now exposes remaining daily and monthly quota alongside the current balance.
- The workspace shows the base Maaroof run estimate and, when requested, a separate live-probe estimate. It checks the combined estimate against the visible balance and quota before enabling the button.
- This estimate is not a reservation. The authoritative run charge still occurs in `/api/maaroof` through `chargeTokens` and the atomic `charge_tokens` database function. The live probe is charged by the existing visibility endpoint immediately before provider calls. Tool executions may have their own charges.
- Because a session can invoke a variable number of tools, the UI cannot know the exact total tool cost in advance. It states this and must not present the base-run estimate as a guaranteed all-in price. Atomic server-side checks remain authoritative if balance or quota changes between preview and execution.
- No pricing table, balance, token counter, plan, or existing account record was reset or migrated by these changes.

## Landing page

The homepage hero is now goal-first: primary task CTA, account-creation CTA, concise value proposition, and a visual three-step journey (describe goal → coordinate skills/tools → review results). The existing SEO content, pricing, guide, and contact routes remain below the hero. Metadata was aligned with the broader goal-driven intelligence positioning rather than promising only AI citation outcomes.
