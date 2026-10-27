// Pure: ten-engine council for direct chat tools. Engine names are fixed; models never shown to users.
export const ENGINE_COUNCIL_MODELS = [
  { key: "chatgpt", model: "openai/gpt-4o-mini" },
  { key: "gemini", model: "google/gemini-2.5-flash" },
  { key: "claude", model: "anthropic/claude-haiku-4.5" },
  { key: "perplexity", model: "perplexity/sonar" },
  { key: "copilot", model: "openai/gpt-4o" },
  { key: "grok", model: "x-ai/grok-4-fast" },
  { key: "mistral", model: "mistralai/mistral-small-3.1-24b-instruct" },
  { key: "deepseek", model: "deepseek/deepseek-chat" },
  { key: "kimi", model: "moonshotai/kimi-k2" },
  { key: "qwen", model: "qwen/qwen-2.5-72b-instruct" },
] as const;

export type EngineVerdict =
  | { engine: string; status: "answered"; agree: boolean; score: number; note: string }
  | { engine: string; status: "no_answer"; reason: string };

/** Parse an engine's JSON reply; null when it is not a usable verdict. */
export function parseVerdict(engine: string, txt: string, clean: (s: string) => string = (s) => s): EngineVerdict | null {
  const m = String(txt || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0]);
    const score = Number(p.score);
    if (!Number.isFinite(score)) return null;
    return { engine, status: "answered", agree: !!p.agree, score: Math.max(0, Math.min(100, Math.round(score))), note: clean(String(p.note || "")).slice(0, 220) };
  } catch { return null; }
}

/** Try the primary route first; on any failure use the fallback for the same engine. */
export async function withFallback(engine: string, primary: () => Promise<EngineVerdict>, fallback: () => Promise<EngineVerdict>): Promise<EngineVerdict & { via?: string }> {
  let first: EngineVerdict;
  try { first = await primary(); } catch { first = { engine, status: "no_answer", reason: "error" }; }
  if (first.status === "answered") return { ...first, via: "openrouter" };
  let second: EngineVerdict;
  try { second = await fallback(); } catch { second = { engine, status: "no_answer", reason: "error" }; }
  if (second.status === "answered") return { ...second, via: "gateway" };
  return { engine, status: "no_answer", reason: `${(first as any).reason}+${(second as any).reason}` };
}

/** Only answering engines count; no answer is never treated as agreement. */
export function summarizeCouncil(v: EngineVerdict[]) {
  const answered = v.filter((x): x is Extract<EngineVerdict, { status: "answered" }> => x.status === "answered");
  const agree = answered.filter((x) => x.agree).length;
  const avg = answered.length ? Math.round(answered.reduce((s, x) => s + x.score, 0) / answered.length) : null;
  const decision = !answered.length ? "no_evidence" : agree * 2 > answered.length ? "agree" : agree * 2 === answered.length ? "split" : "disagree";
  return { asked: v.length, answered: answered.length, agree, disagree: answered.length - agree, avgScore: avg, decision } as const;
}
