// Pure helpers for workspace background jobs (no I/O).
export const JOB_TERMINAL = ["completed", "failed", "cancelled"] as const;
export const JOB_STALE_MS = 10 * 60 * 1000;

export function isTerminalJobStatus(s: string): boolean {
  return (JOB_TERMINAL as readonly string[]).includes(s);
}

/** Never widen a workspace-scoped read to owner-wide data after a query error. */
export function shouldFallbackFromWorkspaceScope(_error: unknown): boolean {
  return false;
}

/** Detect a missing workspace_id schema column without masking unrelated insert failures. */
export function isMissingWorkspaceIdColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = String(e.code || "");
  const text = [e.message, e.details, e.hint].map((x) => String(x || "")).join(" ").toLowerCase();
  return text.includes("workspace_id") &&
    (code === "42703" || code === "PGRST204" || /does not exist|not found|schema cache|unknown column|undefined column/.test(text));
}

/** A non-terminal job with no update for JOB_STALE_MS is considered stuck. */
export function isStaleJob(job: { status: string; updated_at: string }, now = Date.now()): boolean {
  if (isTerminalJobStatus(job.status)) return false;
  const t = new Date(job.updated_at).getTime();
  return Number.isFinite(t) && now - t > JOB_STALE_MS;
}

/** Deep audits finish in seconds; one with no update for AUDIT_STALE_MS is stuck. Pure. */
export const AUDIT_STALE_MS = 30_000;
export function isStaleAuditJob(job: { status: string; updated_at: string }, now = Date.now()): boolean {
  if (isTerminalJobStatus(job.status)) return false;
  const t = new Date(job.updated_at).getTime();
  return Number.isFinite(t) && now - t > AUDIT_STALE_MS;
}

/** Sequential event numbering starting at 1. */
export function createSeqCounter(start = 0) {
  let n = start;
  return () => ++n;
}

export function parseAfter(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Stable result key prevents a resumed run from reusing a tool result for a different input. */
function stableInput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableInput);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableInput(item)]));
  }
  return value;
}

export function reusableResultKey(tool: string, input: unknown): string {
  const serialized = JSON.stringify(stableInput(input ?? null));
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "reuse:" + tool + ":" + (hash >>> 0).toString(16).padStart(8, "0");
}

/** Only successful, usable results are eligible for reuse. New events are keyed by exact input;
 * legacy events without signatures are reusable only when a tool has one unambiguous result. */
export function reusableResults(payloads: Array<{ tool?: unknown; ok?: unknown; output?: unknown; input_signature?: unknown } | null | undefined>): Record<string, any> {
  const out: Record<string, any> = {};
  const legacyByTool = new Map<string, any[]>();
  for (const p of payloads) {
    if (!p || p.ok !== true || typeof p.tool !== "string") continue;
    const o: any = p.output;
    if (o && typeof o === "object" && (o.error || o.skipped || o.needs_input)) continue;
    if (typeof p.input_signature === "string" && p.input_signature.startsWith("reuse:")) {
      out[p.input_signature] = o;
      continue;
    }
    const legacy = legacyByTool.get(p.tool) || [];
    legacy.push(o);
    legacyByTool.set(p.tool, legacy);
  }
  for (const [tool, values] of legacyByTool) if (values.length === 1) out[tool] = values[0];
  return out;
}

/**
 * Polling decision for a job watcher. `status` is the HTTP status, or null for a network error.
 * Transient problems (network, auth refresh, rate limit, server errors) keep watching. Pure.
 */
export function shouldRetryPoll(status: number | null): boolean {
  if (status === null) return true;
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

/** Wait before the next poll after `failures` consecutive transient errors (2s → 10s). Pure. */
export function pollBackoffMs(failures: number): number {
  return Math.min(10_000, 2_000 * Math.max(1, failures));
}

/** Expected cost of tools still to run on resume; reused tools cost nothing. Pure. */
export function remainingCost(tools: string[], reused: string[], prices: Record<string, number>): { tools: string[]; tokens: number } {
  const done = new Set(reused);
  const left = Array.from(new Set(tools)).filter((t) => !done.has(t));
  return { tools: left, tokens: left.reduce((s, t) => s + (Number(prices[t]) || 0), 0) };
}

/** Agent jobs send a heartbeat every 10s; no update for AGENT_STALE_MS means the runner died. Pure. */
export const AGENT_STALE_MS = 600_000;
export function isStaleAgentJob(job: { status: string; updated_at: string }, now = Date.now()): boolean {
  if (isTerminalJobStatus(job.status)) return false;
  const t = new Date(job.updated_at).getTime();
  return Number.isFinite(t) && now - t > AGENT_STALE_MS;
}

export const AGENT_STUCK_MSG = "توقف المنفّذ دون تقدّم؛ لم يُخصم إلا ما اكتمل. اضغط «استئناف» لإكمال الباقي دون إعادة خصم.";
/** A watchdog-stopped job may be resumed automatically once, and never a job that was itself an auto-resume. Pure. */
export function canAutoResume(job: { status: string; error?: string | null; request_payload?: any }, claimed = false): boolean {
  const slot = job.request_payload?.auto_resume_job_id;
  return job.status === "failed" && job.error === AGENT_STUCK_MSG && job.request_payload?.auto_resumed !== true && (claimed ? slot === "pending" : slot == null);
}
