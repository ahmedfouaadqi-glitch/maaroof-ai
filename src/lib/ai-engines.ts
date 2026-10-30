// Architecture & Concept: Ahmed Maaroof
// Single source of truth for the ten AI answer engines used across MAAROOF Ai.
//
// Evolution, not duplication: the engine ⇄ model map used to live only inside
// `src/routes/api/brand-boost.ts` and the display list only inside
// `src/components/engine-logos.tsx`. Both now read from this client-safe module,
// so a change here propagates to every tool, UI surface and admin panel.

export const ENGINE_KEYS = [
  "chatgpt",
  "gemini",
  "claude",
  "perplexity",
  "copilot",
  "grok",
  "mistral",
  "deepseek",
  "kimi",
  "qwen",
] as const;

export type EngineKey = (typeof ENGINE_KEYS)[number];

export type EngineDef = {
  key: EngineKey;
  /** User-facing engine name. */
  name: string;
  /** Tailwind gradient tint used by the logo chips. */
  tint: string;
  /**
   * `true` when the configured integration sends this engine's request through
   * a proxy route. This is connection metadata only: it does not indicate
   * simulation, a replacement engine, or reduced engine functionality.
   */
  proxy: boolean;
  /** Fallback gateway model when governance is OFF or the registry is empty. */
  defaultModel: string;
};

export const ENGINE_CATALOG: Record<EngineKey, EngineDef> = {
  chatgpt: {
    key: "chatgpt",
    name: "ChatGPT",
    tint: "from-emerald-400/20 to-emerald-500/5",
    proxy: false,
    defaultModel: "openai/gpt-5",
  },
  gemini: {
    key: "gemini",
    name: "Gemini",
    tint: "from-blue-400/20 to-violet-500/5",
    proxy: false,
    defaultModel: "google/gemini-2.5-pro",
  },
  claude: {
    key: "claude",
    name: "Claude",
    tint: "from-orange-400/20 to-amber-500/5",
    proxy: true,
    defaultModel: "openai/gpt-5",
  },
  perplexity: {
    key: "perplexity",
    name: "Perplexity",
    tint: "from-cyan-400/20 to-teal-500/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-pro",
  },
  copilot: {
    key: "copilot",
    name: "Copilot",
    tint: "from-sky-400/20 to-blue-500/5",
    proxy: true,
    defaultModel: "openai/gpt-5",
  },
  grok: {
    key: "grok",
    name: "Grok",
    tint: "from-zinc-300/20 to-zinc-500/5",
    proxy: true,
    defaultModel: "openai/gpt-5",
  },
  mistral: {
    key: "mistral",
    name: "Mistral",
    tint: "from-orange-400/20 to-red-500/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-pro",
  },
  deepseek: {
    key: "deepseek",
    name: "DeepSeek",
    tint: "from-indigo-400/20 to-blue-600/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-pro",
  },
  kimi: {
    key: "kimi",
    name: "Kimi",
    tint: "from-violet-400/20 to-cyan-500/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-pro",
  },
  qwen: {
    key: "qwen",
    name: "Qwen",
    tint: "from-violet-500/20 to-indigo-500/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-pro",
  },
};

export const ENGINE_LIST: EngineDef[] = ENGINE_KEYS.map((k) => ENGINE_CATALOG[k]);

export function isEngineKey(v: unknown): v is EngineKey {
  return typeof v === "string" && (ENGINE_KEYS as readonly string[]).includes(v);
}

export function normalizeEngines(input: unknown): EngineKey[] {
  if (!Array.isArray(input)) return [];
  const out: EngineKey[] = [];
  for (const v of input) {
    const k = String(v || "").toLowerCase();
    if (isEngineKey(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

/* ── Plan gating: how many of the ten engines a plan may probe per run ── */

export const ENGINE_LIMIT_BY_PLAN: Record<string, number> = {
  "MARK 1": 3,
  "MARK 2": 6,
  "MARK 3": 10,
};

/** Free / trial / unknown plans get the Starter allowance. */
export const DEFAULT_ENGINE_LIMIT = 3;

/** The full ten-engine council is asked for every account (owner decision). */
export function engineLimitForPlan(_plan?: string | null, _isAdmin = false): number {
  return ENGINE_KEYS.length;
}

/** The engines a plan may use, in catalog order (direct engines come first). */
export function enginesForPlan(plan?: string | null, isAdmin = false): EngineKey[] {
  const limit = engineLimitForPlan(plan, isAdmin);
  const ordered = [...ENGINE_LIST].sort((a, b) => Number(a.proxy) - Number(b.proxy));
  return ordered.slice(0, limit).map((e) => e.key);
}

/**
 * Per-engine answering style for live probes. Derived from the scoring rules in
 * platform-probe.server.ts so proxied engines answer with their real bias
 * instead of one generic voice. Labelled transparent stand-ins elsewhere.
 */
export const ENGINE_PERSONA: Record<EngineKey, string> = {
  chatgpt: "You are ChatGPT (OpenAI). Favor well-known brands with Wikipedia/official presence and clear structured info.",
  gemini: "You are Gemini (Google). Favor brands with strong Google Search/Maps/Business presence and schema markup.",
  claude: "You are Claude (Anthropic). Be careful and balanced; favor authoritative, well-documented, official sources.",
  perplexity: "You are Perplexity. Favor brands that appear in recent, citable web sources and news.",
  copilot: "You are Microsoft Copilot. Favor brands visible on Bing, LinkedIn and professional/official sites.",
  grok: "You are Grok (xAI). Favor brands that are currently discussed on X/social media and trending now.",
  mistral: "You are Mistral (EU). Favor brands with clear multilingual (esp. European) official content.",
  deepseek: "You are DeepSeek. Favor brands with technical depth, documentation and factual specifics.",
  kimi: "You are Kimi (Moonshot AI). Favor brands with long-form, research-style, well-structured content and wiki presence.",
  qwen: "You are Qwen (Alibaba). Favor brands with multilingual (Arabic/Chinese) pages, JSON-LD structure and MENA/Asian market signals.",
};
