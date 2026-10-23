// Pure helpers for workspace background jobs (no I/O).
export const JOB_TERMINAL = ["completed", "failed", "cancelled"] as const;
export const JOB_STALE_MS = 10 * 60 * 1000;

export function isTerminalJobStatus(s: string): boolean {
  return (JOB_TERMINAL as readonly string[]).includes(s);
}

/** A non-terminal job with no update for JOB_STALE_MS is considered stuck. */
export function isStaleJob(job: { status: string; updated_at: string }, now = Date.now()): boolean {
  if (isTerminalJobStatus(job.status)) return false;
  const t = new Date(job.updated_at).getTime();
  return Number.isFinite(t) && now - t > JOB_STALE_MS;
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

/** Successful tool outputs from earlier tool_result payloads, keyed by tool (last wins). Pure. */
export function reusableResults(payloads: Array<{ tool?: unknown; ok?: unknown; output?: unknown } | null | undefined>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const p of payloads) {
    if (!p || p.ok !== true || typeof p.tool !== "string") continue;
    const o: any = p.output;
    if (o && typeof o === "object" && (o.error || o.skipped || o.needs_input)) continue;
    out[p.tool] = o;
  }
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
