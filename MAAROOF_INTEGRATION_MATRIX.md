# MAAROOF Integration Matrix

| Capability | Existing seam | Action in this branch | State after branch |
|---|---|---|---|
| Unified MAAROOF surface | `/maaroof` | No route replacement; existing UI preserved | EXISTS_KEEP |
| Auth/workspace/token/SSE | `/api/maaroof` | No request contract removal or route replacement | EXISTS_KEEP |
| Plan/Act/Reflect/Council | `orchestrator.server.ts` | Kernel manifest added before existing stages; existing stages preserved | EXISTS_EXTEND |
| Kernel identity and policy contract | New `src/lib/maaroof/kernel.server.ts` | Added server-side manifest and prompt block using existing settings/tool catalog | MISSING_ADD_MINIMAL |
| Durable kernel run record | Existing `maaroof_messages` | Kernel manifest logged with role `kernel`; no new table | EXISTS_EXTEND |
| Execution modes | `settings.server.ts` and orchestrator branches | Default flag changed to honor explicit simulation/recommendation selections; advanced engines remain OFF | EXISTS_PARTIAL_COMPLETE |
| Memory isolation | `memory.server.ts` | No provider change; manifest records user/workspace scope | EXISTS_KEEP |
| Knowledge recall | `knowledge.server.ts` | Remains opt-in; no default activation | EXISTS_KEEP |
| Evidence/reality | Existing reality/trust layers | Manifest reports the configured evidence policy; no new evidence abstraction | EXISTS_KEEP |
| Tool safety | `tool-catalog.ts` and `toolPath` | Allowed tools come from existing settings and unknown/disabled tools remain rejected | EXISTS_KEEP |
| Omni Router | No verified adapter | Not implemented in this slice | MISSING_ADD_LATER |
| Browser provider | No verified catalog tool | Not implemented in this slice | UNVERIFIED |
| Google Drive | No runtime memory provider | Not implemented in this slice | MISSING_ADD_LATER |
| Global scope | Existing geo/language contracts | No Iraq-only assumptions introduced | EXISTS_KEEP |

## Non-destructive constraints

This branch does not create `/maaroof-agent`, `maaroof_memory_v2`, `knowledge_v2`, a parallel kernel directory, a new database table, or a second orchestrator. It does not enable all feature flags or claim that unimplemented providers are available.

## Acceptance mapping

The new unit tests cover scope labeling, duplicate tool removal, and non-executing mode labeling. Existing tests remain in the suite. Full runtime workspace isolation and provider behavior still require an authenticated integration environment and are not silently simulated by this branch.
