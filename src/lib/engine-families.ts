import type { EngineKey } from "@/lib/ai-engines";

/**
 * How each engine retrieves and trusts content, grouped in 3 families.
 * Shared by every tool so the algorithmic advice always matches the engine.
 */
export type EngineFamily = "live_index" | "knowledge_graph" | "deep_reasoning";

export const ENGINE_FAMILY: Record<EngineKey, EngineFamily> = {
  perplexity: "live_index",
  copilot: "live_index",
  grok: "live_index",
  gemini: "knowledge_graph",
  chatgpt: "knowledge_graph",
  claude: "deep_reasoning",
  deepseek: "deep_reasoning",
  mistral: "deep_reasoning",
  kimi: "deep_reasoning",
};

type L3 = { ar: string; en: string; ku: string };

export const FAMILY_LABEL: Record<EngineFamily, L3> = {
  live_index: { ar: "فهرسة لحظية", en: "Live index", ku: "پێڕستی ڕاستەوخۆ" },
  knowledge_graph: { ar: "رسم معرفي", en: "Knowledge graph", ku: "گرافی زانیاری" },
  deep_reasoning: { ar: "استدلال عميق", en: "Deep reasoning", ku: "بیرکردنەوەی قووڵ" },
};

/** What the algorithm should strengthen for each family. */
export const FAMILY_FOCUS: Record<EngineFamily, L3> = {
  live_index: {
    ar: "يعتمد على حداثة المحتوى، روابط مرجعية موثوقة، وبنية llms.txt واضحة.",
    en: "Relies on freshness, trusted references, and a clean llms.txt structure.",
    ku: "پشت بە نوێبوون، سەرچاوەی متمانەپێکراو و llms.txt دەبەستێت.",
  },
  knowledge_graph: {
    ar: "يعتمد على JSON-LD Schema، وثبات هوية الكيان، والربط مع قواعد المعرفة.",
    en: "Relies on JSON-LD Schema, consistent entity identity, and knowledge-base links.",
    ku: "پشت بە JSON-LD، ناسنامەی جێگیری کیان و بنکەی زانیاری دەبەستێت.",
  },
  deep_reasoning: {
    ar: "يعتمد على كثافة الحقائق، وغياب الحشو، ووضع الأهم في أول 150 كلمة.",
    en: "Relies on fact density, no filler, and key facts in the first 150 words.",
    ku: "پشت بە چڕی ڕاستییەکان و گرنگترین زانیاری لە ١٥٠ وشەی یەکەم دەبەستێت.",
  },
};

/** Map any engine display name ("ChatGPT", "chatgpt") to its key. */
export function engineKeyFromName(name: string): EngineKey | null {
  const n = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  const keys: EngineKey[] = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral", "deepseek", "kimi"];
  return keys.find((k) => n.startsWith(k)) || null;
}
