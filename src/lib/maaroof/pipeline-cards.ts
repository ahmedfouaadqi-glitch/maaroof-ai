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

// ---- Per-card timeline + live narration + real links (pure, from recorded events only). ----
export type TimelineItem = { at: number | null; kind: "say" | "step" | "done" | "fail" | "info"; text: string; links: { url: string; title: string }[] };

const DECISION_STAGE: Record<string, StageKey> = {
  goal_understanding: "understand", context_analysis: "understand", workspace_analysis: "understand", user_analysis: "understand",
  memory_analysis: "understand", knowledge_analysis: "understand", future_impact: "understand",
  expert_selection: "plan", capability_selection: "plan", tool_selection: "plan", mcp_selection: "plan", model_selection: "plan",
  execution_strategy: "plan", cost_analysis: "plan", risk_analysis: "plan",
};

export function timelineStageOf(e: { type: string; data?: any }): StageKey | null {
  const d = e.data || {};
  if (e.type === "narration") return d.tool ? "evidence" : (PHASE_TO_STAGE[String(d.phase)] ?? null);
  if (e.type === "decision") return DECISION_STAGE[String(d.stage)] ?? null;
  if (e.type === "skill_choice" || e.type === "envision" || e.type === "knowledge" || e.type === "memory") return "understand";
  if (e.type === "plan" || e.type === "tool_catalog" || e.type === "mci_hints") return "plan";
  if (e.type === "council" || e.type === "capability_choice") return "council";
  if (e.type === "conflict" || e.type === "timing") return "conflict";
  if (e.type === "trust" || e.type === "compliance") return "result";
  return stageOf(e);
}

const isUrl = (u: unknown): u is string => typeof u === "string" && /^https?:\/\/[^\s]+$/i.test(u);

/** Real links found in a tool output: known sources, probe evidence, per-answer sources. Deduplicated. */
export function linksOf(out: any, max = 12): { url: string; title: string }[] {
  const seen = new Set<string>(); const res: { url: string; title: string }[] = [];
  const add = (u: any, t: any) => { if (isUrl(u) && !seen.has(u) && res.length < max) { seen.add(u); res.push({ url: u, title: String(t || "").slice(0, 140) || u }); } };
  if (!out || typeof out !== "object") return res;
  for (const s of Array.isArray(out.sources) ? out.sources : []) add(s?.url, s?.title);
  for (const s of Array.isArray(out.result?.sources) ? out.result.sources : []) add(s?.url, s?.title);
  const p = out.probe;
  for (const s of Array.isArray(p?.evidence) ? p.evidence : []) add(s?.url, s?.title);
  for (const a of Array.isArray(p?.answers) ? p.answers : []) for (const s of Array.isArray(a?.sources) ? a.sources : []) add(s?.url, s?.title);
  return res;
}

export function stageTimeline(events: Ev[], stage: StageKey, lang: "ar" | "en" | "ku" = "ar"): TimelineItem[] {
  const t = (ar: string, en: string, ku: string) => (lang === "en" ? en : lang === "ku" ? ku : ar);
  const out: TimelineItem[] = [];
  for (const e of events) {
    if (timelineStageOf(e) !== stage) continue;
    const d = e.data || {}; const at = typeof e.at === "number" ? e.at : null;
    if (e.type === "narration" && d.text) out.push({ at, kind: "say", text: String(d.text), links: [] });
    else if (e.type === "decision" && d.summary) out.push({ at, kind: "info", text: String(d.summary).slice(0, 300), links: [] });
    else if (e.type === "skill_choice") out.push({ at, kind: "info", text: t("المهارات: ", "Skills: ", "شارەزایی: ") + (Array.isArray(d.skills) ? d.skills.map((k: string) => `${k}${d.reasons?.[k] && d.reasons[k] !== "user_selected" ? ` (${d.reasons[k]})` : ""}`).join("، ") : ""), links: [] });
    else if (e.type === "envision" && d.future_goal) out.push({ at, kind: "info", text: String(d.future_goal).slice(0, 400), links: [] });
    else if (e.type === "knowledge" && Array.isArray(d.items)) out.push({ at, kind: "info", text: t(`قرأتُ ${d.items.length} عناصر من معرفتك`, `Read ${d.items.length} items from your knowledge`, `${d.items.length} زانیاری خوێندرایەوە`), links: [] });
    else if (e.type === "plan" && Array.isArray(d.plan?.steps)) out.push({ at, kind: "info", text: t("الخطوات: ", "Steps: ", "هەنگاوەکان: ") + d.plan.steps.map((s: any) => s?.tool).filter(Boolean).join(" ← "), links: [] });
    else if (e.type === "council" && (d.opinion || d.error)) out.push({ at, kind: d.error ? "fail" : "info", text: d.error ? t(`تعذّر رأي الخبير ${d.expert || ""}`, `Expert ${d.expert || ""} unavailable`, "پسپۆڕ بەردەست نییە") : `${d.expert ? `${d.expert}: ` : ""}${String(d.opinion).slice(0, 300)}`, links: [] });
    else if (e.type === "conflict" && d.why) out.push({ at, kind: "info", text: String(d.why).slice(0, 300), links: [] });
    else if (e.type === "tool_call") out.push({ at, kind: "step", text: `${d.tool}${d.reason ? ` — ${String(d.reason).slice(0, 200)}` : ""}`, links: [] });
    else if (e.type === "tool_result") out.push({ at, kind: d.ok === false ? "fail" : "done", text: `${d.tool}: ${d.ok === false ? t("لم تكتمل", "not completed", "تەواو نەبوو") : t("نجحت", "succeeded", "سەرکەوتوو")}`, links: linksOf(d.output) });
    else if (e.type === "final" && d.text) out.push({ at, kind: "done", text: String(d.text).slice(0, 4000), links: [] });
    else if (e.type === "phase_error" || e.type === "error") out.push({ at, kind: "fail", text: t("تأخّر أو تعذّر جزء؛ استُخدم بديل وأكملت المهمة.", "A part was slow or failed; a backup was used.", "بەشێک دواکەوت؛ جێگرەوە بەکارهات."), links: [] });
  }
  return out;
}

/** Latest thing Maaroof said, for the live ticker. */
export function latestNarration(events: Ev[]): string | null {
  for (let k = events.length - 1; k >= 0; k--) if (events[k].type === "narration" && events[k].data?.text) return String(events[k].data.text);
  return null;
}
