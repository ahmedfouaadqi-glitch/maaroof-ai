# Execution modes — runtime proof (no tool execution in recommendation / simulation)

Date: 2026-09-22 (UTC). Environment: preview (localhost dev server, Lovable Cloud backend).
Method: real authenticated POST to `/api/maaroof` (SSE), one run per mode, same goal
("Increase AI citations for a small bakery website", lang `en`).

## Defect found and fixed

`orchestrator.server.ts` forced `executionMode = "execution"` whenever
`platform_evolution.execution_modes_enabled` was false — so a user picking
*recommendation* or *simulation* still got a full execution run (5 tool calls,
`steps: 5`, run row stored as `execution_mode = execution`).

Fix (same code path, no parallel system): the two safe modes are always honoured
because they never execute tools; the evolution flag now only gates opening extra
modes globally. Default behaviour with no mode requested is unchanged
(`execution`).

## Evidence after the fix

| Mode | `tool_call` events | `tool_result` events | `done.steps` | run row `execution_mode` | new `execution_tasks` rows |
|---|---|---|---|---|---|
| recommendation | 0 | 0 | 0 | `recommendation` | 0 |
| simulation | 0 | 0 | 0 | `simulation` | 0 |
| execution (control, before fix) | 5 | 5 | 5 | `execution` | 0 |

`execution_tasks` total stayed at 0 across all runs. Emitted events in the safe
modes were planning/analysis only (`plan`, `decision`, `council`,
`capability_choice`, `envision`, `final`, `phase`, `knowledge`, `memory`,
`state_anchor`) with a terminal `done` carrying `steps: 0` and the requested mode.

## Re-verification

Re-run the two commands (authenticated bearer required) and confirm
`grep -c '^event: tool_call'` is 0 and `done` reports `steps: 0`.
