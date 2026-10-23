// Pure: turns recorded task events into the six live stage cards. No I/O, no invented progress.
export type StageKey = "understand" | "plan" | "council" | "evidence" | "conflict" | "result";
export type StageState = "waiting" | "running" | "done" | "skipped" | "failed";
export type StageCard = { key: StageKey; state: StageState; count: number };

const ORDER: StageKey[] = ["understand", "plan", "council", "evidence", "conflict", "result"];
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

export function pipelineCards(events: Array<{ type: string; data?: any }>, running: boolean): StageCard[] {
  const counts = new Map<StageKey, number>();
  let last = -1;
  for (const e of events) {
    const s = stageOf(e);
    if (!s) continue;
    if (e.type !== "tool_call") counts.set(s, (counts.get(s) || 0) + (e.type === "tool_result" ? 1 : 0));
    else counts.set(s, counts.get(s) || 0);
    last = Math.max(last, ORDER.indexOf(s));
  }
  const finished = events.some((e) => e.type === "final");
  const failed = !finished && events.some((e) => e.type === "error");
  return ORDER.map((key, i) => {
    const seen = counts.has(key);
    let state: StageState;
    if (finished) state = seen ? "done" : "skipped";
    else if (i < last) state = seen ? "done" : "skipped";
    else if (i === last) state = failed ? "failed" : running ? "running" : "done";
    else state = failed || !running ? "skipped" : "waiting";
    return { key, state, count: counts.get(key) || 0 };
  });
}
