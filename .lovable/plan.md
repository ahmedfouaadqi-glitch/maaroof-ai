# Specialist sub-agents for every tool, tab and option, plus the brand (development only)

## Principle
Build on what already exists: the agent factory (DNA, roles, warm reuse), the expert council, capability scoring, the tool catalog and the orchestrator. Nothing is renamed, rebuilt, duplicated, removed or switched off. Every addition can be turned off and falls back to today's behaviour if it fails.

## Already in place (confirmed)
- 18 tools in the catalog, including What-If, Visibility, Brand Boost (Broadcast and Propagation Tracker), Social Analysis, Applied Ranking, BizDev, Feasibility, Known, Compare, Research, Strategist, Company Email, Competitor Monitor, Brand Authority and Rewrite.
- The orchestrator already pulls capabilities from each tool's definition and creates or reuses one agent per run with DNA built from those capabilities.
- The expert council and capability scoring already choose an expert for each capability.

## Gaps
1. One agent covers the whole run. There's no specialist per tool, and none per tab or option.
2. Tabs and options (for example the 7 Brand Boost tabs, What-If scenarios, Visibility engines and modes, and Feasibility/BizDev inputs) aren't described anywhere the agent can read, so the planner guesses the inputs.
3. The brand or client has no dedicated agent. Identity is re-read inside each tool.

## What we'll build
1. **Tool map (additive, read-only):** a pure description of each existing tool: its tabs, the options inside each tab, the required fields, and where each field gets its value (the Entity Truth Card, a saved client, the request, or a question to the user). It's built from the current components. No tool is changed.
2. **Specialist sub-agents:** each tool gets a specialist created through the existing `getOrCreateAgent`. It uses `parent_agent_id` to point to the run's main agent and gets its DNA from the tool map: tool, tabs and options. Tabs with their own logic (Broadcast, Propagation, Authority, What-If scenarios) get a child specialist under the tool specialist. Warm reuse and personality evolution work as they do today.
3. **Brand/client agent:** one specialist per entity (the account's brand, or the agency client named in the request). It holds the identity, headquarters and target markets and feeds them to every tool specialist. Order of priority: the entity named in the request, then a saved client, then the account profile. If it's unclear, the agent asks the user.
4. **Filling fields before running:** before each step, the tool specialist checks its fields against the tool map. It fills them from the brand agent or past tool results. Anything still missing becomes a question to the user, worded as "I found X, can you confirm?" without naming the source. No step is sent to a tool with missing fields.
5. **User choices:** the existing agent screen gets three switches: create sub-agents, run a live check on the 10 models, and allow outside lookup when information is missing. Each switch has a short note on what changes, what it costs, and what you lose if it's off. The cost shows before you confirm. Nothing is charged for a step that fails.
6. **Display:** the existing live stage shows a tree of the main agent, its specialists, and the tab and option each one is working on. Raw technical text is never shown.
7. **Admin:** a switch in the existing Maaroof settings turns specialists on or off, plus a cap on how deep they can nest (2 levels). This follows the same approach as `capability_os`.

## Technical details
- New pure module `src/lib/maaroof/tool-map.ts` covering tool, tabs, options, fields and field sources, with unit tests that check it matches `tool-catalog.ts`.
- `orchestrator.server.ts`: one additive hook around the existing step loop that calls `getOrCreateAgent` with `parentAgentId`, and `finalizeAgent` for each specialist. It's guarded by `settings.sub_agents?.enabled` and fails open.
- Field filling reuses `asText`/`asList` from `input-coerce.ts` and the Entity Truth Card from `user-context.server.ts`.
- Questions go through the existing SSE `emit` as a new `clarify` event. The UI waits for an answer, then continues.
- No database changes. `maaroof_agents` already has `parent_agent_id`, `dna` and `role`.
- Checks: typecheck plus the existing tests, the new tool-map tests, and a full agent run signed in, for a brand account and for an agency with a client.
