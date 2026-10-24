// Part 6 — Workflow Graph interpreter.
// Fusion, not replacement: reads `maaroof_schedules.workflow_graph` and
// dispatches nodes via the EXISTING orchestrator, MCP dispatcher, and
// approval queue. No parallel engine, no shadow agent runtime.
//
// Graph shape (jsonb):
//   {
//     "nodes": [
//       { "id": "n1", "kind": "tool"|"agent"|"mcp"|"approval"|"human"|"branch",
//         "tool"?: string, "capability"?: string, "input"?: any,
//         "condition"?: string /* JS-like expression against prior outputs */,
//         "on_failure"?: "stop"|"continue"|"rollback",
//         "retry"?: { "max": number, "backoff_ms": number }
//       }, ...
//     ],
//     "edges": [ { "from": "n1", "to": "n2", "when"?: "success"|"failure"|"always" } ]
//   }
//
// This module purposely stays small: it walks the graph, evaluates edges,
// and defers actual execution to functions the rest of the codebase already
// exposes.

import { createClient } from "@supabase/supabase-js";

export type WorkflowNode = {
  id: string;
  kind: "tool" | "agent" | "mcp" | "approval" | "human" | "branch";
  tool?: string;
  capability?: string;
  input?: unknown;
  condition?: string;
  on_failure?: "stop" | "continue" | "rollback";
  retry?: { max: number; backoff_ms: number };
};

export type WorkflowEdge = { from: string; to: string; when?: "success" | "failure" | "always" };

export type WorkflowGraph = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export type WorkflowState = "pending" | "running" | "paused" | "awaiting_approval" | "done" | "failed" | "rolled_back";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _db;
}

export function validateGraph(g: unknown): { ok: true; graph: WorkflowGraph } | { ok: false; error: string } {
  if (!g || typeof g !== "object") return { ok: false, error: "graph_must_be_object" };
  const graph = g as WorkflowGraph;
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) return { ok: false, error: "graph_requires_nodes" };
  if (!Array.isArray(graph.edges)) return { ok: false, error: "graph_requires_edges" };
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) return { ok: false, error: `edge_references_missing_node` };
  }
  return { ok: true, graph };
}

/**
 * Set the workflow_state on the parent run. Called by the orchestrator when
 * a run is driven by a workflow graph. Kept intentionally minimal — the
 * orchestrator remains the single execution surface.
 */
export async function markWorkflowState(runId: string, state: WorkflowState): Promise<void> {
  try {
    await (db() as any).from("maaroof_runs").update({ workflow_state: state }).eq("id", runId);
  } catch {}
}

/**
 * Determine the next nodes to execute given the last completed node
 * and its outcome. Pure function — kept small so the orchestrator can
 * call it iteratively without owning graph traversal internals.
 */
export function nextNodes(graph: WorkflowGraph, lastNodeId: string, outcome: "success" | "failure"): WorkflowNode[] {
  const outs = graph.edges.filter(
    (e) => e.from === lastNodeId && (!e.when || e.when === "always" || e.when === outcome),
  );
  const targets = new Set(outs.map((e) => e.to));
  return graph.nodes.filter((n) => targets.has(n.id));
}

export function entryNodes(graph: WorkflowGraph): WorkflowNode[] {
  const hasIncoming = new Set(graph.edges.map((e) => e.to));
  return graph.nodes.filter((n) => !hasIncoming.has(n.id));
}
