// Ten-engine review of a tool result. Each engine tries OpenRouter first and falls back to the
// platform gateway with the same engine persona. Fail-open: never throws.
import { OPENROUTER_URL } from "./openrouter.server";
import { scrubModelNames } from "./model-council";
import { ENGINE_COUNCIL_MODELS, summarizeCouncil, parseVerdict, withFallback, type EngineVerdict } from "./tool-council";
import { ENGINE_PERSONA } from "@/lib/ai-engines";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

const GATEWAY_MODEL = "google/gemini-3.8-flash";

async function ask(engine: string, url: string, headers: Record<string, string>, model: string, messages: any[], timeoutMs: number): Promise<EngineVerdict> {
  try {
    const res = await fetch(url, { method: "POST", headers, signal: AbortSignal.timeout(timeoutMs), body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 200 }) });
    if (!res.ok) return { engine, status: "no_answer", reason: `http_${res.status}` };
    const j: any = await res.json().catch(() => null);
    return parseVerdict(engine, String(j?.choices?.[0]?.message?.content || ""), scrubModelNames) ?? { engine, status: "no_answer", reason: "unparsable" };
  } catch (e: any) {
    return { engine, status: "no_answer", reason: e?.name === "TimeoutError" ? "timeout" : "error" };
  }
}

export async function runToolCouncil(o: { tool: string; input: string; result: string; lang: "ar" | "en" | "ku"; timeoutMs?: number }): Promise<{ engines: EngineVerdict[]; summary: ReturnType<typeof summarizeCouncil> } | null> {
  const orKey = process.env.OPENROUTER_API_KEY;
  const gwKey = process.env.LOVABLE_API_KEY;
  if (!orKey && !gwKey) return null;
  const L = o.lang === "en" ? "English" : o.lang === "ku" ? "Central Kurdish (Sorani)" : "Modern Standard Arabic";
  const prompt = `A GEO tool (${o.tool}) produced this result for the user's content.\nCONTENT:\n${o.input.slice(0, 2500)}\nRESULT:\n${o.result.slice(0, 2000)}\nAs an AI answer engine, would you cite this content? Reply ONLY JSON: {"agree": true|false, "score": 0-100, "note": "one short sentence in ${L}"}. Never invent facts.`;
  const t = o.timeoutMs ?? 30_000;
  // Safety valve: the primary route gets at most 8s, then the gateway answers with the full budget.
  const tPrimary = Math.min(8_000, t);
  const engines = await Promise.all(ENGINE_COUNCIL_MODELS.map(({ key: engine, model }) => withFallback(
    engine,
    () => orKey
      ? ask(engine, OPENROUTER_URL, { Authorization: `Bearer ${orKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://maaroofai.com", "X-Title": "Maaroof AI" }, model, [{ role: "user", content: prompt }], tPrimary)
      : Promise.resolve({ engine, status: "no_answer", reason: "no_key" } as EngineVerdict),
    () => gwKey
      ? ask(engine, LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders(gwKey) as any, GATEWAY_MODEL, [{ role: "system", content: (ENGINE_PERSONA as any)[engine] || "" }, { role: "user", content: prompt }], t)
      : Promise.resolve({ engine, status: "no_answer", reason: "no_key" } as EngineVerdict),
  )));
  return { engines, summary: summarizeCouncil(engines) };
}
