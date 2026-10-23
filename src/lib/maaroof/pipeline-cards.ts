// Pure: turns recorded task events into the six live stage cards. No I/O, no invented progress.
export type StageKey = "understand" | "plan" | "council" | "evidence" | "conflict" | "result";
export type StageState = "waiting" | "running" | "done" | "skipped" | "failed" | "stopped";
export type StageCard = { key: StageKey; state: StageState; count: number; startedAt: number | null; endedAt: number | null; durationMs: number | null; failedTools: string[]; reused: number };
type Ev = { type: string; data?: any; at?: number };

const ORDER: StageKey[] = ["understand", "plan", "council", "conflict", "evidence", "result"];
const PHASE_TO_STAGE: Record<string, StageKey> = {
  envision: "understand", planning: "plan", recommendation: "plan", simulation: "plan",
  council: "council", conflict: "conflict", summarizing: "result",
};

export function stageOf(e: { type: string; data?: any }): StageKey | null {
  if (e.type === "phase") return PHASE_TO_STAGE[String(e.data?.phase)] ?? null;
  if (e.type === "tool_call" || e.type === "tool_result") return "evidence";
  if (e.type === "final" || e.type === "done") return "result";
  return null;
}

/** Whole-task duration from recorded timestamps only; null when none are recorded. */
export function taskDuration(events: Ev[], running: boolean, now = Date.now()): { startedAt: number; endedAt: number | null; durationMs: number } | null {
  const ts = events.map((e) => e.at).filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  if (!ts.length) return null;
  const startedAt = Math.min(...ts);
  const endedAt = running ? null : Math.max(...ts);
  return { startedAt, endedAt, durationMs: Math.max(0, (endedAt ?? now) - startedAt) };
}

export function pipelineCards(events: Ev[], running: boolean, now = Date.now()): StageCard[] {
  const counts = new Map<StageKey, number>();
  const first = new Map<StageKey, number>();
  let last = -1;
  for (const e of events) {
    const s = stageOf(e);
    if (!s) continue;
    if (e.type !== "tool_call") counts.set(s, (counts.get(s) || 0) + (e.type === "tool_result" ? 1 : 0));
    else counts.set(s, counts.get(s) || 0);
    if (typeof e.at === "number" && !first.has(s)) first.set(s, e.at);
    last = Math.max(last, ORDER.indexOf(s));
  }
  const finished = events.some((e) => e.type === "final");
  const failed = !finished && events.some((e) => e.type === "error");
  const lastAt = events.reduce<number | null>((m, e) => (typeof e.at === "number" ? Math.max(m ?? e.at, e.at) : m), null);
  const seenStarts = ORDER.filter((k) => first.has(k)).map((k) => first.get(k)!);
  return ORDER.map((key, i) => {
    const seen = counts.has(key);
    let state: StageState;
    if (finished) state = seen ? "done" : "skipped";
    else if (i < last) state = seen ? "done" : "skipped";
    else if (i === last) state = failed ? "failed" : running ? "running" : "done";
    // Stages after the point the task stopped were needed but never reached.
    else state = failed || !running ? "stopped" : "waiting";
    const startedAt = first.get(key) ?? null;
    let endedAt: number | null = null;
    if (startedAt != null && state !== "running") {
      const next = seenStarts.filter((t) => t > startedAt).sort((a, b) => a - b)[0];
      endedAt = next ?? lastAt ?? startedAt;
    }
    const durationMs = startedAt == null || state === "skipped" || state === "waiting" || state === "stopped" ? null : Math.max(0, (endedAt ?? now) - startedAt);
    const failedTools = key === "evidence" ? [...new Set(events.filter((e) => e.type === "tool_result" && e.data?.ok === false && !e.data?.output?.skipped && e.data?.tool).map((e) => String(e.data.tool)))] : [];
    const reused = key === "evidence" ? events.filter((e) => e.type === "tool_result" && e.data?.reused).length : 0;
    return { key, state, count: counts.get(key) || 0, startedAt, endedAt, durationMs, failedTools, reused };
  });
}

export function formatDuration(ms: number, lang: "ar" | "en" | "ku" = "ar"): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60), r = s % 60;
  const [sec, min] = lang === "en" ? ["s", "m"] : lang === "ku" ? ["چ", "خ"] : ["ث", "د"];
  return m ? `${m} ${min} ${r} ${sec}` : `${r} ${sec}`;
}

// ---- Ten-model council: per-engine status derived from recorded probe events only. ----
export type EngineStatus = "waiting" | "asking" | "answered" | "unresponsive";
export type EngineView = { key: string; status: EngineStatus; mentioned: boolean | null; rank: number | null; answer: string; brands: string[]; reason: string | null };

function probeOf(out: any): { asked?: string[]; answers?: any[] } | null {
  if (!out || typeof out !== "object") return null;
  if (out.probe && Array.isArray(out.probe.answers)) return out.probe;
  if (Array.isArray(out.answers) && out.answers.some((a: any) => a && typeof a.engine === "string")) return out;
  return null;
}

/** Pure. Engines with no recorded answer stay "waiting" (or "asking" while the probe runs); never invented. */
export function councilEngines(events: Ev[], engineKeys: readonly string[], running: boolean): EngineView[] {
  const asking = running && events.some((e) => e.type === "tool_call" && e.data?.tool === "visibility")
    && !events.some((e) => e.type === "tool_result" && e.data?.tool === "visibility");
  let probe: { asked?: string[]; answers?: any[] } | null = null;
  for (const e of events) if (e.type === "tool_result") probe = probeOf(e.data?.output) ?? probe;
  const answers = new Map<string, any>((probe?.answers || []).filter((a: any) => a?.engine).map((a: any) => [String(a.engine), a]));
  const asked = new Set(probe?.asked || []);
  return engineKeys.map((key) => {
    const a = answers.get(key);
    if (a) return { key, status: "answered", mentioned: !!a.mentioned, rank: typeof a.rank === "number" ? a.rank : null, answer: String(a.answer || ""), brands: Array.isArray(a.brands) ? a.brands.map(String) : [], reason: a.reason ? String(a.reason) : null };
    const status: EngineStatus = probe && asked.has(key) ? "unresponsive" : asking ? "asking" : "waiting";
    return { key, status, mentioned: null, rank: null, answer: "", brands: [], reason: null };
  });
}
