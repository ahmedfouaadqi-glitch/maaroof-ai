// Ten-engine review of a direct chat tool result, via OpenRouter. Fail-open: never throws.
import { OPENROUTER_URL } from "./openrouter.server";
import { scrubModelNames } from "./model-council";
import { ENGINE_COUNCIL_MODELS, summarizeCouncil, type EngineVerdict } from "./tool-council";

export async function runToolCouncil(o: { tool: string; input: string; result: string; lang: "ar" | "en" | "ku"; timeoutMs?: number }): Promise<{ engines: EngineVerdict[]; summary: ReturnType<typeof summarizeCouncil> } | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const L = o.lang === "en" ? "English" : o.lang === "ku" ? "Central Kurdish (Sorani)" : "Modern Standard Arabic";
  const prompt = `A GEO tool (${o.tool}) produced this result for the user's content.\nCONTENT:\n${o.input.slice(0, 2500)}\nRESULT:\n${o.result.slice(0, 2000)}\nAs an AI answer engine, would you cite this content? Reply ONLY JSON: {"agree": true|false, "score": 0-100, "note": "one short sentence in ${L}"}. Never invent facts.`;
  const engines = await Promise.all(ENGINE_COUNCIL_MODELS.map(async ({ key: engine, model }): Promise<EngineVerdict> => {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://maaroofai.com", "X-Title": "Maaroof AI" },
        signal: AbortSignal.timeout(o.timeoutMs ?? 35_000),
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 200 }),
      });
      if (!res.ok) return { engine, status: "no_answer", reason: `http_${res.status}` };
      const j: any = await res.json().catch(() => null);
      const txt = String(j?.choices?.[0]?.message?.content || "");
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) return { engine, status: "no_answer", reason: "unparsable" };
      const p = JSON.parse(m[0]);
      const score = Number(p.score);
      if (!Number.isFinite(score)) return { engine, status: "no_answer", reason: "unparsable" };
      return { engine, status: "answered", agree: !!p.agree, score: Math.max(0, Math.min(100, Math.round(score))), note: scrubModelNames(String(p.note || "")).slice(0, 220) };
    } catch (e: any) {
      return { engine, status: "no_answer", reason: e?.name === "TimeoutError" ? "timeout" : "error" };
    }
  }));
  return { engines, summary: summarizeCouncil(engines) };
}
