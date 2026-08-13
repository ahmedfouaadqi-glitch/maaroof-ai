# MAAROOF Capability Status

## Scope

This branch extends the existing MAAROOF agent. It does not rebuild the agent, replace the orchestrator, or claim that external services are connected.

## Implemented in this branch

| Capability | Status | Evidence |
|---|---|---|
| Maaroof kernel manifest | ACTIVE | `src/lib/maaroof/kernel.server.ts` |
| Workspace/user memory scope | ACTIVE, enforced by existing memory/RLS paths | `memory.server.ts`, kernel policy |
| Knowledge recall contract | ACTIVE when existing flags are enabled | `knowledge.server.ts`, orchestrator integration |
| Model registry governance | ACTIVE when existing governance flags are enabled | `models.server.ts` |
| Browser path selection | ACTIVE as a truthful UI/API contract | `maaroof.tsx`, `/api/maaroof`, `browser.server.ts` |
| Browser status SSE event | ACTIVE | `orchestrator.server.ts`, `MaaroofStage.tsx` |
| Supabase knowledge storage | ACTIVE source of truth | Existing knowledge/teaching layers |
| Google Drive adapter boundary | IMPLEMENTED, NOT CONNECTED | `knowledge-storage.server.ts` |
| Google Drive per-user/workspace layout | IMPLEMENTED as deterministic layout | `buildDriveWorkspaceLayout()` |

## Opt-in or pending external authorization

| Capability | Status | What is still required |
|---|---|---|
| Embedded browser navigation | OPT-IN / unavailable by default | A real `MAAROOF_EMBEDDED_BROWSER_ENDPOINT` and security review |
| User browser connector | OPT-IN / unavailable by default | A real user connection and explicit confirmation for each sensitive action |
| Google Drive storage | OPT-IN / unavailable by default | User OAuth consent and a configured Drive policy |
| More than the registry's real models | NOT CLAIMED | Real provider records and provider credentials/connector policies |
| Automatic deployment | NOT ENABLED | A separately verified deployment pipeline and production approval |

## Explicit non-claims

This branch does not claim that it can browse, log in, submit forms, read Google Drive, or call a model merely because a selector, adapter, or contract exists. Runtime evidence must be emitted by a real configured provider before the agent can describe an action as executed.
