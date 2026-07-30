// Single source of truth for the nine AI answer engines used across MAAROOF Ai.
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
] as const;

export type EngineKey = (typeof ENGINE_KEYS)[number];

export type EngineDef = {
  key: EngineKey;
  /** User-facing engine name. */
  name: string;
  /** Tailwind gradient tint used by the logo chips. */
  tint: string;
  /**
   * `true` when the engine cannot be probed directly on the Lovable AI Gateway
   * and we use a same-family model as a transparent stand-in.
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
    defaultModel: "openai/gpt-5-mini",
  },
  gemini: {
    key: "gemini",
    name: "Gemini",
    tint: "from-blue-400/20 to-violet-500/5",
    proxy: false,
    defaultModel: "google/gemini-2.5-flash",
  },
  claude: {
    key: "claude",
    name: "Claude",
    tint: "from-orange-400/20 to-amber-500/5",
    proxy: true,
    defaultModel: "openai/gpt-5-mini",
  },
  perplexity: {
    key: "perplexity",
    name: "Perplexity",
    tint: "from-cyan-400/20 to-teal-500/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-flash",
  },
  copilot: {
    key: "copilot",
    name: "Copilot",
    tint: "from-sky-400/20 to-blue-500/5",
    proxy: true,
    defaultModel: "openai/gpt-5-nano",
  },
  grok: {
    key: "grok",
    name: "Grok",
    tint: "from-zinc-300/20 to-zinc-500/5",
    proxy: true,
    defaultModel: "openai/gpt-5-nano",
  },
  mistral: {
    key: "mistral",
    name: "Mistral",
    tint: "from-orange-400/20 to-red-500/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-flash-lite",
  },
  deepseek: {
    key: "deepseek",
    name: "DeepSeek",
    tint: "from-indigo-400/20 to-blue-600/5",
    proxy: true,
    defaultModel: "google/gemini-2.5-flash-lite",
  },
  kimi: {
    key: "kimi",
    name: "Kimi",
    tint: "from-violet-400/20 to-cyan-500/5",
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

/* ── Plan gating: how many of the nine engines a plan may probe per run ── */

export const ENGINE_LIMIT_BY_PLAN: Record<string, number> = {
  "MARK 1": 3,
  "MARK 2": 6,
  "MARK 3": 9,
};

/** Free / trial / unknown plans get the Starter allowance. */
export const DEFAULT_ENGINE_LIMIT = 3;

export function engineLimitForPlan(plan?: string | null, isAdmin = false): number {
  if (isAdmin) return ENGINE_KEYS.length;
  const key = String(plan || "").trim();
  return ENGINE_LIMIT_BY_PLAN[key] ?? DEFAULT_ENGINE_LIMIT;
}

/** The engines a plan may use, in catalog order (direct engines come first). */
export function enginesForPlan(plan?: string | null, isAdmin = false): EngineKey[] {
  const limit = engineLimitForPlan(plan, isAdmin);
  const ordered = [...ENGINE_LIST].sort((a, b) => Number(a.proxy) - Number(b.proxy));
  return ordered.slice(0, limit).map((e) => e.key);
}
