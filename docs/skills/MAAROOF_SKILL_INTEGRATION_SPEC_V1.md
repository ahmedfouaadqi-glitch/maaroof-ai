# MAAROOF AI — Phase 3: Skill Integration & Instruction Reconciliation Specification

**Status:** Specification complete; implementation not started  
**Baseline:** `main` at `ece75108502d3c3fc57c062ab39c0ec634ea23e0`  
**Scope:** Integrate 69 externally supplied skill packages into the existing MAAROOF capability, tool, orchestration, evidence, memory and governance architecture.  
**Non-goal:** Replace the ten-engine catalogue, replace existing tools, import all package instructions into every prompt, or execute external integrations without credentials and approval.

---

## 1. Executive decision

The 69 skill packages are to be treated as **capability specifications and reusable domain procedures**, not as 69 new tools and not as 69 autonomous agents.

The target design is:

1. Preserve the existing 18-skill MAAROOF catalogue and its public keys unless a later implementation change is explicitly reviewed.
2. Add a compatibility and composition layer that maps incoming skills to existing tools, engines and platform services.
3. Load only the selected skill's concise instruction and only the reference sections needed for the current task.
4. Resolve instruction conflicts before execution using explicit precedence, safety constraints and evidence requirements.
5. Represent unavailable external services as unavailable dependencies; never imply that a skill package makes a provider integration operational.
6. Allow selected combinations of overlapping packages to become **composite workflows** where they create a distinct, testable capability.
7. Gate all writes, publishing, external side effects and paid provider calls behind existing authorization and approval controls.

The first deliverable is a governed registry and resolver. Runtime activation is a later phase.

## 2. Baseline and invariants

### 2.1 Existing system baseline

The audit identified these existing structures:

- 18 entries in `src/lib/maaroof/skill-catalog.ts`.
- Existing tool catalogue and tool-to-skill mapping.
- Keyword-oriented skill inference.
- Orchestrator and Expert Council.
- Capability Operating System and capability scoring.
- MCI, memory and knowledge services.
- Evidence, Trust and Reality-related services/settings.
- Existing ten-engine catalogue in `src/lib/ai-engines.ts`.
- Dynamic feature settings in `src/lib/maaroof/settings.server.ts`.

The current settings file contains several independently gated subsystems. Their presence is not proof that they are active in production. New skill integration must not silently enable them.

### 2.2 Non-negotiable invariants

- The ten-engine catalogue and engine identifiers remain unchanged.
- Existing tool identifiers, request contracts and user-visible behaviour remain backward-compatible.
- No duplicate tool is created when an existing tool can satisfy the capability.
- A skill cannot grant itself permissions, credentials, provider access or execution authority.
- No external skill script is executed as part of registration, inference or documentation ingestion.
- No skill may override system safety, privacy, authorization, tenant/workspace isolation or explicit user constraints.
- No unsupported claim is promoted to a measured fact.
- No publishing, outreach, CRM write, database mutation or paid call occurs solely because a skill recommends it.
- Existing kill switches, token ledger, timeouts, refund rules and approval requirements remain authoritative.

## 3. Target architecture

```text
User request
   |
   v
Request/context normalizer
   |
   v
Skill inference and intent classifier
   |
   v
Compatibility resolver
   |---- existing skill catalogue
   |---- 69-skill external registry
   |---- composite workflow registry
   |
   v
Instruction reconciliation and policy gate
   |
   v
Progressive skill loader
   |---- core instruction
   |---- selected reference sections
   |---- optional examples / eval hints
   |
   v
Existing Orchestrator / Council / Capability OS
   |
   v
Existing tools and ten configured engines
   |
   v
Evidence + validation + output contract
   |
   v
Existing memory / knowledge / job / export pathways
```

The resolver returns a **plan**, not a new execution environment. The orchestrator remains the owner of sequencing, tool invocation, retries, timeout handling, cost accounting and final response assembly.

### 3.1 Logical modules

| Module | Responsibility | Must not do |
|---|---|---|
| Skill Registry | Store normalized skill metadata and source provenance | Execute package scripts |
| Skill Inference | Rank relevant skills from intent, entities and context | Select skills by keyword alone |
| Compatibility Resolver | Map skills to existing tools/services | Create duplicate tools |
| Instruction Reconciler | Apply precedence and resolve incompatible directives | Weaken system or safety rules |
| Progressive Loader | Load only relevant instructions/references | Inject every skill into every prompt |
| Dependency Gate | Check adapters, credentials, permissions and availability | Pretend missing integrations exist |
| Evidence Contract | Require sources, assumptions and uncertainty labels | Convert estimates into facts |
| Evaluation Harness | Test routing, conflicts, quality and regressions | Trigger paid production operations |

## 4. Unified skill metadata contract

Each imported skill must be normalized to a versioned metadata record. The following TypeScript shape is normative for the design; it is not yet implemented.

```ts
export type SkillRisk = "low" | "moderate" | "high" | "critical";
export type SkillLoadMode = "always_minimal" | "on_demand" | "reference_only";
export type SkillLifecycle = "candidate" | "approved" | "deprecated" | "blocked";

export interface SkillManifestV1 {
  schemaVersion: 1;
  id: string;
  canonicalName: string;
  displayName: Record<string, string>;
  version: string;
  source: {
    packageId: string;
    packageVersion?: string;
    sourceDigest: string;
    importedAt: string;
    licenseStatus: "verified" | "review_required" | "unknown";
  };
  purpose: string;
  intentLabels: string[];
  keywords: string[];
  entities?: string[];
  domains: string[];
  languages: string[];
  inputContract: {
    required: string[];
    optional: string[];
  };
  outputContract: {
    format: string;
    requiredFields: string[];
  };
  capabilityBindings: Array<{
    targetType: "tool" | "service" | "engine" | "composite";
    targetId: string;
    role: "primary" | "supporting" | "validation";
    required: boolean;
  }>;
  dependencies: Array<{
    id: string;
    kind: "internal" | "provider" | "credential" | "dataset" | "runtime";
    required: boolean;
    availabilityPolicy: "block" | "degrade" | "skip";
  }>;
  instructions: {
    coreRef: string;
    referenceRefs: string[];
    loadMode: SkillLoadMode;
    maxCoreTokens: number;
  };
  governance: {
    lifecycle: SkillLifecycle;
    risk: SkillRisk;
    requiresApproval: boolean;
    allowedSideEffects: string[];
    prohibitedSideEffects: string[];
    evidenceRequired: boolean;
    freshnessDays?: number;
  };
  composition: {
    compatibleWith: string[];
    conflictsWith: string[];
    supersedes?: string[];
    canCompose: boolean;
  };
  evaluation: {
    evalSetRefs: string[];
    minimumPassRate?: number;
    regressionSuite: string[];
  };
}
```

### 4.1 Metadata rules

- `id` is stable and lowercase; package display names are not identifiers.
- `sourceDigest` identifies the exact imported source so package updates can be reviewed.
- Every binding must point to a real existing tool, service, engine or approved composite.
- Every dependency must be classified as required or optional and have an explicit failure policy.
- `allowedSideEffects` is descriptive only; runtime permissions remain controlled by the actual tool and authorization layer.
- `maxCoreTokens` is a ceiling, not a target. Reference material is loaded separately.
- `licenseStatus=unknown` or `review_required` prevents production approval until reviewed.
- A skill with no validated output contract cannot be used as a final-output authority.

## 5. Skill inference and selection

### 5.1 Selection stages

1. **Intent extraction:** identify the requested outcome, not merely topic words.
2. **Context extraction:** identify workspace, entity, market, language, audience, task state and prior constraints.
3. **Candidate retrieval:** combine lexical matches with intent labels, entity/domain matches and historical evaluation signals.
4. **Capability fit:** verify that candidate skills map to existing tools/services that can actually perform the work.
5. **Dependency check:** mark each candidate available, degraded or unavailable.
6. **Conflict check:** inspect incompatible instructions, duplicated objectives and mutually exclusive output contracts.
7. **Plan selection:** choose one primary skill and only the smallest necessary supporting/validation set.
8. **Budget check:** estimate instruction tokens, model calls, external calls and expected latency.
9. **Approval check:** classify side effects and require explicit approval where applicable.
10. **Load and execute:** pass the resolved plan to the existing orchestrator.

### 5.2 Ranking model

Use a deterministic, explainable weighted score as the initial routing baseline:

```text
score =
  0.30 * intent_match +
  0.20 * capability_fit +
  0.15 * context_match +
  0.10 * entity_domain_match +
  0.10 * evaluation_reliability +
  0.10 * dependency_readiness +
  0.05 * freshness
```

All factors are normalized to 0–1. The score is a routing heuristic, not a quality guarantee. Missing evaluation data must be neutral or explicitly penalized; it must not be fabricated.

Initial selection constraints:

- One primary skill by default.
- Up to two supporting skills when they add distinct capabilities.
- Up to one validation skill where the task has factual, legal, financial, publication or reputational risk.
- A composite workflow may replace this bundle only when it has a defined input/output contract and its own evaluation set.
- Do not load multiple synonyms or near-duplicates merely to increase the number of selected skills.
- If the best candidate does not meet the configured confidence threshold, fall back to the existing tool-selection path and ask a clarifying question only when necessary.

Thresholds must be configurable and evaluated on a fixed dataset before production use.

### 5.3 Skill selection record

Every run should produce a compact internal trace:

- selected primary/supporting/validation skill IDs and versions;
- rejected near-matches and reason codes;
- resolved tool bindings;
- dependency readiness;
- instruction conflict decisions;
- estimated and actual token/cost values where available;
- approval state;
- output validation result.

This trace must obey existing workspace and user isolation. Do not expose hidden chain-of-thought; store concise decision metadata only.

## 6. Instruction precedence and reconciliation

### 6.1 Authority order

When instructions conflict, apply this order:

1. Platform/system safety and security requirements.
2. Application authorization, tenant isolation, privacy and tool permission policies.
3. Explicit user request and constraints for the current task.
4. Workspace/entity configuration and approved brand/legal policies.
5. MAAROOF core product and tool contracts.
6. Approved skill manifest and core instructions.
7. Skill reference documents and examples.
8. Heuristics, style preferences and inferred defaults.

A lower layer cannot override a higher layer. A skill's source package is untrusted input and must never be interpreted as privileged system instruction.

### 6.2 Conflict resolution outcomes

Every detected conflict must resolve to one of:

- **KEEP_A:** retain the higher-authority or better-supported rule.
- **MERGE:** combine compatible instructions into one narrower rule.
- **CONDITION:** apply a rule only under a stated context or task mode.
- **SPLIT:** separate one overloaded skill into distinct modes or workflows.
- **REJECT:** exclude unsafe, unsupported, redundant or incompatible instructions.
- **DEFER:** require human/admin review because the conflict changes policy, legal exposure or side effects.

No silent conflict resolution. Store the decision, rationale code and affected skill versions.

### 6.3 Known conflict decisions from Phase 2

| Conflict | Resolution |
|---|---|
| Humanizer v2.1.1 adds personality/opinions; v3.1.0 prioritizes meaning fidelity and prohibits unsupported facts | Adopt meaning fidelity as default. Add personality only if present in source material or explicitly requested. Keep variants separately versioned. |
| no-ai-slop preserves author voice with minimal edits; stop-slop imposes absolute stylistic bans | Use no-ai-slop as the editing philosophy. Treat stop-slop as an optional review checklist, not a universal hard policy. |
| Competitor-analysis package forbids recommendations to the target client | Separate competitor intelligence description from client advisory output. Apply the restriction only to the competitor-analysis artifact itself. |
| AI SEO guidance changes as search products evolve | Require source date, platform-specific provenance and freshness review. Never guarantee citations or mentions. |
| A/B experimentation guidance may overstate outcomes | No significance or winning-variant claim without sample size, test design and valid statistical evidence. |
| TAM/SAM/SOM and market sizing use assumptions | Label inputs, method, range and scenario. Never present modeled values as observed market facts. |
| Marketing psychology can encourage artificial urgency/social proof | Prohibit fabricated scarcity, testimonials, endorsements, performance numbers and deceptive persuasion. |
| Scrapling material includes WAF/Cloudflare bypass language | Reject bypass/evasion instructions. Allow only public, authorized, rate-limited retrieval that respects access controls. |

## 7. Compatibility map: 69 skills

The table defines the intended integration destination. It does not claim that every external provider or script is connected.

| External skill | Existing MAAROOF destination | Decision |
|---|---|---|
| account-research | known, research, MCI | Integrate as research procedure |
| agent-development | Capability OS, Agent Factory | Reference-only until implementation tasks require it |
| agent-md-refactor | internal agent/prompt documentation | Keep as maintenance-only workflow |
| agent-reach | research, social analysis; external adapter if authorized | Dependency-gated |
| ai-seo | analyze, visibility, applied_ranking, brand_authority, keyword intelligence | Integrate; freshness required |
| alternative-blog-writer | content workflow via research/geo_rewrite | Compose with content creation |
| applying-brand-guidelines | workspace/entity brand configuration, geo_rewrite | Integrate as brand constraint |
| aso-audit | analyze, research, keyword intelligence | New workflow over existing tools; no new tool |
| audit-support | analyze, research, evidence validation | Integrate as audit support |
| backtesting-frameworks | what_if, feasibility, analytics | Conditional; requires historical dataset |
| blog-factcheck | research, Evidence services | Validation skill |
| blog-repurpose | existing content workflow, geo_rewrite | Integrate as transformation procedure |
| blog-rewrite | geo_rewrite, content workflow | Integrate |
| blog-translate | translation/localization path, geo_rewrite | Integrate; preserve meaning and locale |
| blog-write | research, geo_rewrite | Integrate |
| business-model | feasibility, bizdev, what_if | Integrate |
| call-prep | known, research, company_email | Integrate; CRM/calendar adapters optional |
| churn-prevention | analyze, bizdev, what_if | Integrate; customer data required |
| comparison-article-writer | compare, research, geo_rewrite | Integrate with evidence gate |
| competitive-intelligence | compare, research, competitor_monitor (currently paused) | Integrate only through active existing paths; do not unpause competitor_monitor |
| content-creation | research, geo_rewrite | Integrate |
| content-experimentation-best-practices | analyze, what_if, KPI reporting | Integrate as experiment design, not telemetry |
| content-gap-analysis | keyword intelligence, compare, analyze | Integrate |
| content-modeling-best-practices | content strategy and knowledge structure | Reference procedure |
| content-strategy | suggest, research, geo_strategist | Integrate |
| copy-editing | geo_rewrite/content workflow | Merge with quality gate |
| copywriting | geo_rewrite, suggest | Integrate |
| cover-letter-generator | company_email or document output workflow | Integrate as document task; no new tool |
| crafting-effective-readmes | repository/documentation workflow | Maintenance-only; requires explicit code task |
| create-prd | product planning/document output workflow | Integrate as PRD workflow |
| dispatching-parallel-agents | existing Orchestrator/Agent Factory | Reconcile with existing concurrency controls; no duplicate dispatcher |
| draft-outreach | company_email | Integrate; sending remains approval-gated |
| grammar-check | content quality gate | Merge into composite |
| humanizer (variant A) | content quality gate | Keep versioned; apply reconciled policy |
| humanizer (variant B) | content quality gate | Keep versioned; apply reconciled policy |
| keyword-research | keyword intelligence, research | Integrate |
| knowledge-synthesis | MCI, knowledge graph, research | Integrate; provenance required |
| kpi-dashboard-design | KPI/report/export pathway | Integrate as output design, not data source |
| legal-risk-assessment | analyze, research, evidence | High-risk; caveat and human legal review |
| listicle-blog-writer | content creation/geo_rewrite | Integrate as format mode |
| manim-animator | media generation adapter, if connected | Optional dependency; never assume installed |
| market-research-reports | research, known, compare, feasibility, bizdev | Integrate |
| market-sizing-analysis | feasibility, bizdev, what_if | Integrate with assumption/range labels |
| marketing-ideas | suggest, geo_strategist | Integrate |
| marketing-psychology | suggest, geo_rewrite, geo_strategist | Integrate under ethical persuasion policy |
| memory-management | MCI, memory and knowledge services | Map to existing memory controls; no second memory store |
| metadata-optimization | analyze, geo_rewrite, keyword intelligence | Integrate |
| muapi-product-campaign | brand_boost/content workflow | Optional provider adapter; credential and cost gate |
| muapi-ugc-ads-workflow | brand_boost/content workflow | Optional provider adapter; human review |
| no-ai-slop | content quality gate | Preferred editing philosophy |
| obsidian-bases | knowledge export/interoperability | Optional integration; not core runtime |
| obsidian-canvas-creator | knowledge export/interoperability | Optional integration |
| obsidian-markdown | knowledge export/interoperability | Optional integration |
| pricing-strategy | feasibility, bizdev, what_if | Integrate |
| programmatic-seo | keyword intelligence, analyze, geo_rewrite | Integrate; page quality and duplication checks |
| research-writing-skill | research, evidence, report generation | Integrate |
| risk-metrics-calculation | feasibility, what_if, analytics | Integrate; method and input disclosure |
| scrapling | authorized retrieval adapter only | Restricted; reject evasion/bypass instructions |
| search-strategy | research and existing retrieval adapters | Integrate; source provenance |
| secops-hunt | security workflow only if an authorized security tool is available | Dependency-gated; no autonomous scanning |
| seo-aeo-best-practices | analyze, visibility, applied_ranking, keyword intelligence | Integrate; keep axes definitions distinct |
| seo-audit | analyze, research, keyword intelligence | Integrate |
| seo-competitor-analysis | compare, research, keyword intelligence | Integrate with perspective separation |
| seo-content-audit | analyze, geo_rewrite, Evidence services | Integrate as audit/validation |
| stop-slop | content quality gate | Optional checklist, not hard global policy |
| system-settings-playbooks | admin settings documentation | Admin-only reference; no automatic settings writes |
| task-management | existing Orchestrator, maaroof_jobs and task UI | Integrate with existing job lifecycle |
| war-council | Expert Council and existing conflict capability | Reuse existing council; no duplicate council |
| writing-prds | create-prd workflow | Merge with create-prd unless evals prove distinct |
| youtube-video-research | research and authorized transcript/media adapters | Dependency-gated |

**Identity note:** The audit found 69 unique skill names but 70 distinct package variants because two different Humanizer packages share the same name. Preserve both source digests and versions; do not collapse them into one untraceable package.

## 8. Composite workflows created from overlap

These are workflow definitions, not new low-level tools.

### 8.1 Content Quality & Voice Gate
Inputs: draft, target audience, locale, approved brand voice.  
Composition: copy-editing + grammar-check + humanizer + no-ai-slop + stop-slop checklist + brand guidelines.  
Output: corrected draft, change summary, preserved-meaning check, unsupported-claim flags.  
Default policy: minimal edits; no invented facts or personality.

### 8.2 Claim Verification & Citation Readiness
Composition: blog-factcheck + SEO content audit + Evidence services.  
Output: claim ledger with supported/unsupported/uncertain states, evidence references and unresolved gaps.  
Hard rule: no citation fabrication.

### 8.3 Competitive Content Intelligence
Composition: competitive intelligence + content gap + competitor SEO analysis + keyword research.  
Output: competitor observations, source/date, gap taxonomy and opportunity hypotheses.  
Hard rule: do not claim complete competitor coverage from sampled search results.

### 8.4 Marketing Psychology Strategy
Composition: marketing psychology + content strategy + geo strategy.  
Output: audience barrier, journey stage, ethical persuasion principle, message angle and test hypothesis.  
Hard rule: no fake scarcity, fake social proof or fabricated performance claims.

### 8.5 Growth Economics & Market Model
Composition: business model + market sizing + pricing + churn + KPI + scenario analysis.  
Output: assumptions, model, scenario ranges, sensitivity and decision implications.  
Hard rule: separate actuals, estimates and forecasts.

### 8.6 Research Evidence Synthesis
Composition: search strategy + knowledge synthesis + account research + available evidence sources.  
Output: sourced synthesis, confidence/coverage limits and open questions.  
Hard rule: retain source provenance and date.

### 8.7 ASO Intelligence
Composition: ASO audit + keyword research + competitive intelligence + existing analysis tools.  
Output: store listing audit, keyword clusters, competitor observations and prioritized improvements.  
Dependency note: store analytics/provider APIs are optional and must be explicitly connected.

## 9. Progressive disclosure and reference loading

Use three instruction layers:

- **Layer 0 — Manifest:** always available to the resolver; concise metadata only.
- **Layer 1 — Core instruction:** loaded for the selected skill; contains purpose, process, constraints and output contract.
- **Layer 2 — References:** load only the named sections needed for the current subtask.

Do not load entire package directories by default. Use stable reference identifiers and content digests. Reference retrieval should support section-level selection and a bounded token budget.

Suggested defaults for the first evaluation cycle (not production constants):

| Item | Initial ceiling |
|---|---:|
| Candidate skills scored | 12 |
| Selected skills per task | 4 total, including validation |
| Core instruction budget | 1,200 tokens per selected skill |
| Combined core skill budget | 3,000 tokens |
| Reference excerpts | 2,000 tokens total |
| Total skill context | 5,000 tokens |

If the task needs more context, the loader should retrieve a specific reference section or ask the orchestrator for a second bounded pass. It must not silently inject all references.

## 10. Dependency and capability availability

Each dependency must have one of three runtime states:

- **AVAILABLE:** credentials, permissions, adapter and health checks are valid.
- **DEGRADED:** an optional dependency is unavailable; the workflow may continue with a clearly stated limitation.
- **BLOCKED:** a required dependency, permission or approval is missing; do not execute the dependent action.

External integrations identified in the package audit include SEO providers, analytics, CRM, CMS, social/video, media generation, Obsidian and security tools. Their mention in a package is not evidence of a configured integration.

Examples:

- Ahrefs/Semrush/Similarweb/GSC/GA4: optional data adapters; do not fabricate metrics if disconnected.
- Salesforce/CRM/email sequences: no writes without connected credentials and explicit permission.
- WordPress/Ghost/Sanity: do not publish or create drafts unless the requested adapter exists and the user authorizes it.
- MUAPI/Manim/FFmpeg/Whisper: optional media dependencies; cost and file handling must be visible.
- Scrapling: only authorized public retrieval; no WAF/Cloudflare bypass or access-control evasion.
- SecOps: no scanning or hunting without a clearly authorized target and a connected approved security tool.

## 11. Evidence, risk and side-effect gates

| Risk | Minimum controls |
|---|---|
| Low: formatting, grammar, translation | Preserve source meaning; disclose uncertain terms |
| Moderate: SEO/content/marketing recommendations | Cite data sources, date observations, separate hypothesis from measurement |
| High: legal, financial, security, market sizing | Evidence ledger, assumptions, confidence/limits, human review |
| Critical: external write, publication, outreach, account/security action | Explicit user approval, permission check, bounded target, audit record |

All evidence-bearing outputs should distinguish:

- observed data;
- retrieved source statements;
- model interpretation;
- assumptions;
- estimates/forecasts;
- recommendations;
- unverified claims.

The skill cannot downgrade the evidence state or remove the transparency notice required by the existing Reality/Trust policy.

## 12. Evaluation and acceptance criteria

### 12.1 Evaluation dimensions

1. Intent routing precision and recall.
2. Correct primary skill selection.
3. Avoidance of unnecessary skill activation.
4. Conflict resolution correctness.
5. Tool-binding validity.
6. Dependency-state accuracy.
7. Evidence provenance and uncertainty handling.
8. Output-contract compliance.
9. Token and latency overhead.
10. Backward compatibility with existing skills/tools.
11. Arabic, English and Kurdish language handling.
12. Workspace and user data isolation.

### 12.2 Test set design

Create a versioned evaluation dataset with:

- at least 20 representative prompts per high-priority domain;
- Arabic, Iraqi Arabic where relevant, English and Kurdish cases;
- ambiguous requests and multi-intent requests;
- prompts designed to trigger known conflicts;
- missing-provider and missing-credential scenarios;
- workspace-switch and cross-workspace isolation cases;
- unsupported factual claims and source freshness cases;
- side-effect requests that require approval;
- regression cases for every existing skill/tool binding.

The 20-per-domain target is an initial dataset design target, not a claim that those tests already exist.

### 12.3 Proposed release gates

These thresholds are proposed for calibration, not measured results:

- Skill routing precision >= 90% on the curated test set.
- Primary skill recall >= 85%.
- Unsafe or unauthorized side-effect execution = 0.
- Fabricated source/citation in evaluation = 0.
- Invalid tool binding = 0.
- Cross-workspace data leakage = 0.
- Existing tool/skill regression tests: 100% pass.
- Median skill-context overhead <= 3,000 tokens, with hard ceiling <= 5,000 unless explicitly approved.
- No production rollout while critical or high-severity evaluation failures remain open.

Thresholds should be calibrated against a labelled baseline before they become CI blockers.

## 13. Implementation sequence after specification approval

| Implementation batch | Scope | Exit condition |
|---|---|---|
| A — Registry foundation | Manifest schema, source digest, lifecycle and validation | All 69 names represented; duplicate variants preserved |
| B — Compatibility map | Bindings to current tools/services/engines | No dangling or invented tool IDs |
| C — Reconciliation engine | Precedence, conflict records and known conflict policies | Conflict fixtures pass |
| D — Progressive loader | Core/reference separation and token budgets | Prompt budget and lazy-load tests pass |
| E — Inference v2 | Intent/context/capability/dependency scoring | Evaluation thresholds met |
| F — Composite workflows | Seven workflows with contracts and evals | Each workflow independently validated |
| G — Controlled activation | Feature flags, observability, rollback and admin visibility | Shadow mode stable; no regression |
| H — Gradual rollout | Domain-by-domain activation | Release gates pass for each batch |

Recommended rollout order: low-risk content quality and research workflows first; then SEO/ASO and competitive analysis; then business/market modelling; then high-risk legal/security and any external side-effect workflow last.

## 14. Operational observability

Record the following non-sensitive metadata per run:

- skill IDs and versions;
- resolver scores and reason codes;
- reference IDs/digests loaded;
- tool bindings and dependency states;
- conflict decisions;
- estimated/actual token usage and provider cost where available;
- approval requirement/result;
- output validation and eval result.

Do not log secrets, raw credentials, unnecessary personal data or hidden model reasoning. Follow existing retention and workspace isolation rules.

## 15. Rollback and migration

- Registry activation must be independently feature-flagged.
- Disabling the new resolver must restore the current skill-selection path.
- Existing skill keys and tool contracts must remain valid.
- Imported skill versions must be immutable once approved; updates create a new version and require re-evaluation.
- Composite workflow definitions must be versioned and independently disableable.
- Do not delete original package archives or source provenance during integration.
- Database migrations, if later required, must be additive and include rollback strategy; this specification introduces no database migration.

## 16. Out of scope for Phase 3

- Implementing the registry or resolver in application code.
- Activating all 69 skills in production.
- Enabling disabled settings in `settings.server.ts`.
- Connecting paid third-party providers.
- Executing scripts from imported packages.
- Unpausing `competitor_monitor`.
- Changing the ten-engine catalogue or measurement axes.
- Publishing content, sending outreach or writing to external systems.
- Making claims about runtime quality or test pass rates before tests are executed.

## 17. Phase 3 completion checklist

- [x] Current repository state checked; `main` baseline confirmed.
- [x] Existing PR #52 identified and left untouched.
- [x] Existing architecture and invariants documented.
- [x] Unified skill metadata contract specified.
- [x] Inference and selection flow specified.
- [x] Instruction precedence and conflict outcomes specified.
- [x] 69-skill compatibility map specified; Humanizer variants retained separately.
- [x] Seven composite workflows defined.
- [x] Progressive disclosure and token budgets specified.
- [x] External dependency and approval gates specified.
- [x] Evaluation dimensions and proposed release gates specified.
- [x] Implementation batches, observability and rollback specified.
- [ ] Runtime implementation — intentionally deferred to the next phase.
- [ ] Tests and production verification — not run because no runtime code was changed.

**Phase 3 result:** Technical integration specification is complete. No application code, database settings, provider credentials, paid APIs or production deployments were changed or invoked.
