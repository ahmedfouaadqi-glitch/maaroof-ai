// Pure: ten-engine council for direct chat tools. Engine names are fixed; models never shown to users.
export const ENGINE_COUNCIL_MODELS = [
  { key: "chatgpt", model: "openai/gpt-4o-mini" },
  { key: "gemini", model: "google/gemini-2.5-flash" },
  { key: "claude", model: "anthropic/claude-3.5-haiku" },
  { key: "perplexity", model: "perplexity/sonar" },
  { key: "copilot", model: "openai/gpt-4o" },
  { key: "grok", model: "x-ai/grok-3-mini" },
  { key: "mistral", model: "mistralai/mistral-small-3.1-24b-instruct" },
  { key: "deepseek", model: "deepseek/deepseek-chat" },
  { key: "kimi", model: "moonshotai/kimi-k2" },
  { key: "qwen", model: "qwen/qwen-2.5-72b-instruct" },
] as const;

export type EngineVerdict =
  | { engine: string; status: "answered"; agree: boolean; score: number; note: string }
  | { engine: string; status: "no_answer"; reason: string };

/** Only answering engines count; no answer is never treated as agreement. */
export function summarizeCouncil(v: EngineVerdict[]) {
  const answered = v.filter((x): x is Extract<EngineVerdict, { status: "answered" }> => x.status === "answered");
  const agree = answered.filter((x) => x.agree).length;
  const avg = answered.length ? Math.round(answered.reduce((s, x) => s + x.score, 0) / answered.length) : null;
  const decision = !answered.length ? "no_evidence" : agree * 2 > answered.length ? "agree" : agree * 2 === answered.length ? "split" : "disagree";
  return { asked: v.length, answered: answered.length, agree, disagree: answered.length - agree, avgScore: avg, decision } as const;
}
