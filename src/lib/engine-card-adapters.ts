import { cleanCouncilText } from "@/lib/maaroof/report-sections";
// Architecture & Concept: Ahmed Maaroof
// Pure adapters: turn an existing tool result into nine-engine card data.
// Read-only — never changes how a tool computes its result, never calls a model.
import { ENGINE_FAMILY, engineKeyFromName, type EngineFamily } from "@/lib/engine-families";
import type { EngineKey } from "@/lib/ai-engines";

export type CardBasis = "measured" | "estimated" | "recommended";
export type EngineCard = { key: EngineKey; score?: number | null; verdict?: string; text?: string; action?: string; basis?: CardBasis; items?: string[] };

const ALL: EngineKey[] = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral", "deepseek", "kimi", "qwen"];
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** GEO Strategist: priority_platforms → recommendation cards (only engines the plan named). */
export function fromStrategist(res: any): EngineCard[] {
  const list = Array.isArray(res?.priority_platforms) ? res.priority_platforms : [];
  const out: EngineCard[] = [];
  for (const p of list) {
    const key = engineKeyFromName(String(p?.engine || ""));
    if (key && !out.some((o) => o.key === key)) out.push({ key, text: String(p?.reason || ""), basis: "recommended" });
  }
  return out;
}

/** What-If: engine_projections → estimated after-score per engine. */
export function fromWhatIf(res: any): EngineCard[] {
  const list = Array.isArray(res?.engine_projections) ? res.engine_projections : [];
  const out: EngineCard[] = [];
  for (const p of list) {
    const key = engineKeyFromName(String(p?.engine || ""));
    if (!key || out.some((o) => o.key === key)) continue;
    const before = typeof p?.baseline_score === "number" ? p.baseline_score : null;
    const m = String(p?.projected_delta || "").match(/([+-]?\d+(?:\.\d+)?)\s*%?\s*(?:to|إلى|الى|-)\s*([+-]?\d+(?:\.\d+)?)/);
    const mid = m ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : null;
    const after = before !== null && mid !== null ? clamp(before * (1 + mid / 100)) : before;
    out.push({ key, score: after, verdict: p?.projected_delta ? String(p.projected_delta) : undefined, text: p?.reason ? String(p.reason) : undefined, basis: "estimated" });
  }
  return out;
}

/** Smart Research: sources → which engine family benefits (freshness/authority/depth). */
export function fromResearch(res: any): EngineCard[] {
  const src = Array.isArray(res?.sources) ? res.sources : [];
  if (src.length === 0) return [];
  const withDate = src.filter((s: any) => /20\d\d/.test(JSON.stringify(s ?? ""))).length;
  const domains = new Set(src.map((s: any) => { try { return new URL(String(s?.url || "")).hostname; } catch { return ""; } }).filter(Boolean));
  const avgLen = src.reduce((a: number, s: any) => a + String(s?.snippet || s?.description || s?.content || "").length, 0) / src.length;
  const fam: Record<EngineFamily, number> = {
    live_index: clamp(30 + (withDate / src.length) * 50 + Math.min(20, src.length * 2)),
    knowledge_graph: clamp(30 + Math.min(50, domains.size * 8) + Math.min(20, src.length)),
    deep_reasoning: clamp(30 + Math.min(60, avgLen / 10)),
  };
  return ALL.map((key) => ({ key, score: fam[ENGINE_FAMILY[key]], basis: "estimated" as const, items: [...domains].slice(0, 4) as string[] }));
}

/** Post suggester: score each variant's likely citation per family from its text. */
export function fromSuggestion(res: any): EngineCard[] {
  // Prefer the real ten-engine council answers; only engines that answered get a score.
  const ce = Array.isArray(res?.council?.engines) ? res.council.engines : [];
  if (ce.length) {
    return ce
      .filter((v: any) => v?.status === "answered" && (ALL as readonly string[]).includes(v.engine))
      .map((v: any) => ({ key: v.engine, score: v.score, items: v.note ? [String(v.note)] : [], basis: "live" as any }));
  }
  const vs = Array.isArray(res?.variants) ? res.variants : [];
  if (vs.length === 0) return [];
  const best: Record<EngineFamily, { s: number; p: string }> = { live_index: { s: -1, p: "" }, knowledge_graph: { s: -1, p: "" }, deep_reasoning: { s: -1, p: "" } };
  for (const v of vs) {
    const c = String(v?.content || "");
    const words = Math.max(1, c.split(/\s+/).filter(Boolean).length);
    const facts = (c.match(/\d+/g) || []).length;
    const structure = (c.match(/\n|•|-\s|\d\./g) || []).length;
    const fresh = /20\d\d|اليوم|today|هذا العام|this year/i.test(c) ? 1 : 0;
    const first = c.split(/\s+/).slice(0, 150).join(" ");
    const firstFacts = (first.match(/\d+/g) || []).length;
    const g = Number(v?.geo_score) || 50;
    const sc: Record<EngineFamily, number> = {
      live_index: clamp(g * 0.6 + fresh * 25 + Math.min(15, structure * 2)),
      knowledge_graph: clamp(g * 0.6 + Math.min(25, structure * 3) + Math.min(15, facts * 2)),
      deep_reasoning: clamp(g * 0.6 + Math.min(30, (firstFacts / words) * 600) + (words > 40 ? 10 : 0)),
    };
    (Object.keys(sc) as EngineFamily[]).forEach((f) => { if (sc[f] > best[f].s) best[f] = { s: sc[f], p: String(v?.platform || "") }; });
  }
  return ALL.map((key) => { const b = best[ENGINE_FAMILY[key]]; return { key, score: b.s, items: b.p ? [b.p] : [], basis: "estimated" as const }; });
}

/** Agent stage: pick the right adapter for a finished tool step. Empty when data is insufficient. */
export function cardsForStep(tool: string, out: any): EngineCard[] {
  try {
    if (!out || typeof out !== "object") return [];
    if (tool === "geo_strategist") return fromStrategist(out);
    if (tool === "what_if") return fromWhatIf(out);
    if (tool === "research") return fromResearch(out);
    if (tool === "suggest") return fromSuggestion(out);
    if (tool === "visibility") return fromVisibility(out);
    if (tool === "analyze" && Array.isArray(out.platform_views)) {
      const res: EngineCard[] = [];
      for (const p of out.platform_views) {
        const key = engineKeyFromName(String(p?.name || ""));
        if (key && !res.some((r) => r.key === key)) res.push({ key, score: typeof p?.score === "number" ? p.score : null, verdict: p?.verdict, text: p?.benefit, basis: "estimated" });
      }
      return res;
    }
    return [];
  } catch { return []; }
}

/** Visibility: live probe answers are "measured"; per-platform scores from the report are "estimated". Never invents a score. */
export function fromVisibility(res: any): EngineCard[] {
  const out: EngineCard[] = [];
  const answers = Array.isArray(res?.probe?.answers) ? res.probe.answers : [];
  for (const a of answers) {
    const key = engineKeyFromName(String(a?.engine || ""));
    if (!key || out.some((o) => o.key === key)) continue;
    out.push({ key, score: null, verdict: a?.mentioned ? (a?.rank ? `#${a.rank}` : "✓") : "✗", text: (cleanCouncilText(String(a?.answer || "")).slice(0, 400) || undefined), action: !a?.mentioned && a?.reason ? cleanCouncilText(String(a.reason)) : undefined, items: Array.isArray(a?.brands) ? a.brands.slice(0, 5) : [], basis: "measured" });
  }
  const plats = Array.isArray(res?.platforms) ? res.platforms : [];
  for (const p of plats) {
    const key = engineKeyFromName(String(p?.name || ""));
    if (!key || out.some((o) => o.key === key)) continue;
    out.push({ key, score: typeof p?.score === "number" ? clamp(p.score) : null, verdict: p?.citation_likelihood ? String(p.citation_likelihood) : undefined, text: p?.why ? String(p.why) : undefined, action: p?.action ? String(p.action) : undefined, items: Array.isArray(p?.authority_factors) ? p.authority_factors.slice(0, 3).map(String) : [], basis: "estimated" });
  }
  return out;
}
