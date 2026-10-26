// Architecture & Concept: Ahmed Maaroof
// Pure helpers for the Maaroof executor: fill missing tool inputs from known
// context, detect fields still missing (ask instead of failing), and turn raw
// reflection output into a plain sentence. No I/O — safe to unit-test.

export type EntityContext = {
  /** Brand explicitly named in the user's goal (highest priority). */
  goalBrand?: string | null;
  workspace?: { name?: string | null; brand_url?: string | null; keywords?: any; country?: string | null; city?: string | null; brand_summary?: string | null; description?: string | null; profile?: any; entity_truth_card?: any; onboarding?: any } | null;
  profile?: { brand_name?: string | null; brand_keywords?: string | null; hq_country?: string | null; entity_type?: string | null; entity_links?: any; target_markets?: any; specialty?: string | null; description?: string | null } | null;
  goal?: string;
};

/** The brand key(s) each tool endpoint actually reads. */
const BRAND_KEYS: Record<string, string[]> = {
  visibility: ["brand"],
  compare: ["brand"],
  known: ["brand"],
  geo_strategist: ["brand"],
  social_analysis: ["brand"],
  what_if: ["brand"],
  brand_boost: ["brand_name"],
  brand_authority: ["brand_name"],
  applied_ranking: ["brand_name"],
  company_email: ["company"],
  bizdev: ["business_name"],
  feasibility: ["project_name"],
};

/** Fields a tool rejects with 400 when empty. */
export const REQUIRED_FIELDS: Record<string, string[]> = {
  ...BRAND_KEYS,
  research: ["query"],
  suggest: ["description"],
  geo_rewrite: ["text"],
};

const ANY_BRAND = ["brand", "brand_name", "company", "business_name", "project_name"];

function str(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(", ");
  return typeof v === "string" ? v.trim() : typeof v === "object" ? "" : String(v).trim();
}

const MIN_REWRITE_SOURCE_LENGTH = 25;
const MAX_REWRITE_SOURCE_LENGTH = 4000;
const REWRITE_TEXT_PATH = /(text|content|description|answer|summary|caption|post|copy|draft|article|paragraph|body|message|recommend|suggest|rewrite|intro|headline|output)/i;
const NON_CONTENT_PATH = /(^|[._\[\]])(url|href|source_url|id|status|error|provider|model|timestamp|date|brand|keyword|score|type)([._\[\]]|$)/i;

/** Select an actual source passage from successful earlier tool outputs; never invent text. */
export function extractRewriteSourceText(results: Array<{ tool: string; ok: boolean; output: any }>): string {
  const candidates: Array<{ text: string; score: number }> = [];
  const toolPriority: Record<string, number> = {
    suggest: 70, analyze: 65, geo_strategist: 58, research: 52,
    brand_authority: 48, known: 44, social_analysis: 40, visibility: 35,
  };
  const add = (tool: string, path: string, raw: unknown) => {
    if (typeof raw !== "string") return;
    const text = raw.replace(/\u0000/g, "").trim();
    if (text.length < MIN_REWRITE_SOURCE_LENGTH) return;
    if (/^https?:\/\/\S+$/i.test(text)) return;
    if (/^(?:\{[\s\S]*\}|\[[\s\S]*\])$/.test(text)) {
      try { JSON.parse(text); return; } catch { /* Narrative that resembles JSON may still be text. */ }
    }
    if (path && (!REWRITE_TEXT_PATH.test(path) || NON_CONTENT_PATH.test(path))) return;
    const keyScore = /suggest|recommend|caption|post|copy|draft|rewrite/i.test(path) ? 30
      : /description|article|paragraph|body|content|text|answer|summary/i.test(path) ? 24 : 0;
    const bounded = text.length <= MAX_REWRITE_SOURCE_LENGTH ? text : text.slice(0, MAX_REWRITE_SOURCE_LENGTH).replace(/\s+\S*$/, "").trim();
    if (bounded.length < MIN_REWRITE_SOURCE_LENGTH) return;
    candidates.push({ text: bounded, score: (toolPriority[tool] || 10) + keyScore + Math.min(bounded.length / 500, 4) });
  };
  const walk = (tool: string, value: any, path: string, depth: number) => {
    if (value == null || depth > 5) return;
    if (typeof value === "string") { add(tool, path, value); return; }
    if (Array.isArray(value)) {
      for (let index = 0; index < Math.min(value.length, 30); index++) walk(tool, value[index], path ? path + "[" + index + "]" : "", depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? path + "." + key : key;
      if (child && typeof child === "object") walk(tool, child, next, depth + 1);
      else add(tool, next, child);
    }
  };
  for (const result of results) {
    if (!result.ok || result.output == null || result.output?.skipped) continue;
    walk(result.tool, result.output, "", 0);
  }
  candidates.sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  return candidates[0]?.text || "";
}

function rewriteContextSource(ctx?: EntityContext): string {
  const candidates = [
    ctx?.workspace?.brand_summary,
    ctx?.workspace?.description,
    ctx?.workspace?.profile?.description,
    ctx?.workspace?.profile?.about,
    ctx?.workspace?.entity_truth_card?.description,
    ctx?.workspace?.onboarding?.description,
    ctx?.profile?.description,
    ctx?.profile?.specialty,
  ];
  return candidates.map(str).find((value) => value.length >= MIN_REWRITE_SOURCE_LENGTH && !/^https?:\/\/\S+$/i.test(value))?.slice(0, MAX_REWRITE_SOURCE_LENGTH) || "";
}

/** Fill missing inputs. Never overwrites a value the planner already set. */
export function fillToolInput(tool: string, input: any, ctx: EntityContext): Record<string, any> {
  const out: Record<string, any> = input && typeof input === "object" && !Array.isArray(input) ? { ...input } : {};
  const fromInput = ANY_BRAND.map((k) => str(out[k])).find(Boolean);
  const brand = fromInput || str(ctx.goalBrand) || str(ctx.workspace?.name) || str(ctx.profile?.brand_name);
  for (const k of BRAND_KEYS[tool] || []) if (!str(out[k]) && brand) out[k] = brand;
  if (!str(out.keywords)) {
    const kw = str(ctx.workspace?.keywords) || str(ctx.profile?.brand_keywords);
    if (kw) out.keywords = kw;
  }
  if (!str(out.url) && str(ctx.workspace?.brand_url) && ["analyze", "known", "brand_authority"].includes(tool)) out.url = str(ctx.workspace?.brand_url);
  // Creators / individuals without a website: use their first verified social or entity-page link.
  if (!str(out.url) && ["analyze", "known", "brand_authority"].includes(tool)) {
    const links = Array.isArray(ctx.profile?.entity_links) ? ctx.profile!.entity_links : [];
    const first = links.map((l: any) => str(typeof l === "string" ? l : l?.url)).find((u: string) => /^https?:\/\//.test(u));
    if (first) out.url = first;
  }
  if (tool === "known" && str(out.url) && !str(out.website)) out.website = str(out.url);
  if (tool === "suggest" && !str(out.description) && !str(out.sourceText)) {
    const d = ctx.goal?.trim() || [str(ctx.profile?.brand_name), str(ctx.profile?.brand_keywords)].filter(Boolean).join(" — ");
    if (d) out.description = d.slice(0, 600);
  }
  if (tool === "research" && !str(out.query) && ctx.goal) out.query = ctx.goal.slice(0, 300);
  // Planning tools receive the user's own horizon (any unit), never a fixed one.
  if (["geo_strategist", "what_if", "brand_boost"].includes(tool) && !out.timeframe && ctx.goal) out.timeframe = ctx.goal.slice(0, 300);
  // Markets come from the entity card (any country), never a fixed default.
  if (!str(out.target_markets) && str(ctx.profile?.target_markets)) out.target_markets = str(ctx.profile?.target_markets);
  if (!str(out.country) && str(ctx.workspace?.country)) out.country = str(ctx.workspace?.country);
  return out;
}

/** Required fields still empty after filling. */
export function missingFields(tool: string, input: Record<string, any>): string[] {
  return (REQUIRED_FIELDS[tool] || []).filter((k) => str(input[k]).length < (tool === "geo_rewrite" && k === "text" ? MIN_REWRITE_SOURCE_LENGTH : 2));
}

/** Competitor names recorded by earlier successful steps of the same task (never invented). */
export function priorCompetitors(results: Array<{ tool: string; ok: boolean; output: any }>, brand: string, max = 5): string[] {
  const own = brand.trim().toLowerCase();
  const seen = new Map<string, string>();
  const add = (v: unknown) => {
    const n = typeof v === "string" ? v.trim() : v && typeof v === "object" ? String((v as any).name || (v as any).brand || "").trim() : "";
    if (n.length < 2 || n.length > 60 || n.toLowerCase() === own || n.toLowerCase().includes(own) && own) return;
    if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  };
  const walk = (o: any, depth = 0) => {
    if (!o || typeof o !== "object" || depth > 4) return;
    for (const [k, v] of Object.entries(o)) {
      if (["competitors", "brands", "suggested_competitors"].includes(k) && Array.isArray(v)) v.forEach(add);
      else if (typeof v === "object") walk(v, depth + 1);
    }
  };
  for (const r of results) if (r.ok) walk(r.output);
  return [...seen.values()].slice(0, max);
}

/** Fill inputs that depend on earlier steps or tool defaults. Pure; never overwrites set values. */
export function fillFromTask(tool: string, input: Record<string, any>, results: Array<{ tool: string; ok: boolean; output: any }>, context?: EntityContext): Record<string, any> {
  const out = { ...input };
  if (tool === "compare" && !(Array.isArray(out.competitors) ? out.competitors.length : str(out.competitors))) {
    const c = priorCompetitors(results, str(out.brand));
    if (c.length) { out.competitors = c; out.competitors_source = "prior_steps"; }
  }
  if (tool === "geo_rewrite" && !str(out.text)) {
    out.text = extractRewriteSourceText(results) || rewriteContextSource(context);
  }
  return out;
}

const Q: Record<string, Record<"ar" | "en" | "ku", string>> = {
  brand: { ar: "لم نجد اسم العلامة لهذه الخطوة، ما هو؟", en: "We couldn't find the brand name for this step — what is it?", ku: "ناوی براند بۆ ئەم هەنگاوە نەدۆزرایەوە، چییە؟" },
  description: { ar: "ما موضوع المحتوى الذي تريد منشورات عنه؟", en: "What should the posts be about?", ku: "پۆستەکان دەربارەی چی بن؟" },
  text: { ar: "لم نجد نصاً كافياً لإعادة الصياغة. أرسل النص الأصلي، أو أضف وصفاً موثقاً للكيان (25 حرفاً على الأقل).", en: "No suitable source text was found. Provide the original text or a verified entity description (at least 25 characters).", ku: "دەقی گونجاو نەدۆزرایەوە؛ دەقی سەرەکی یان وەسفێکی پشتڕاستکراوی قەوارە بنێرە (لانیکەم ٢٥ پیت)." },
  query: { ar: "ما الموضوع الذي تريد البحث عنه بالضبط؟", en: "What exactly should we research?", ku: "چی بە وردی لێکۆڵینەوەی بۆ بکەین؟" },
};

export function clarifyQuestion(field: string, lang: "ar" | "en" | "ku"): string {
  const k = ANY_BRAND.includes(field) ? "brand" : field in Q ? field : "brand";
  return Q[k][lang] || Q[k].ar;
}

/** Strip code fences / JSON from a reflection and return a readable sentence. */
export function sanitizeReflection(text: unknown): string {
  let s = String(text ?? "");
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      const parts = [j.decision, j.action, j.why, j.reason, j.rationale, j.text].map(str).filter(Boolean);
      if (parts.length) return parts.join(" — ").slice(0, 500);
    } catch {}
  }
  s = s.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").replace(/[{}\[\]"]/g, " ").replace(/\s+/g, " ").trim();
  return s.slice(0, 500);
}

type StepResult = { tool: string; ok: boolean; output: any };
const ENTITY_SKIP = new Set(["research", "suggest", "security_scan"]);

/** The examined entity: name/link from the first successful tool that named one (never the account). */
export function taskEntity(results: StepResult[]): { brand: string; url?: string } | null {
  for (const r of results) {
    if (!r.ok || ENTITY_SKIP.has(r.tool) || !r.output || typeof r.output !== "object") continue;
    const o = r.output;
    const brand = [o.brand, o.brand_name, o.company, o.business_name, o.entity?.name].map(str).find((x) => x.length >= 2);
    if (!brand) continue;
    const url = [o.url, o.website, o.site, o.entity?.url].map(str).find((u) => /^https?:\/\//.test(u));
    return { brand, ...(url ? { url } : {}) };
  }
  return null;
}

/** Pre-fill a later step with the examined entity's link when the tool reads one. Pure; never overwrites. */
export function taskEntityInput(tool: string, input: any, results: StepResult[]): Record<string, any> {
  const out: Record<string, any> = input && typeof input === "object" && !Array.isArray(input) ? { ...input } : {};
  const e = taskEntity(results);
  if (e?.url && !str(out.url) && ["analyze", "known", "brand_authority", "social_analysis", "brand_boost"].includes(tool)) out.url = e.url;
  return out;
}
