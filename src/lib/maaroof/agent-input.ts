// Architecture & Concept: Ahmed Maaroof
// Pure helpers for the Maaroof executor: fill missing tool inputs from known
// context, detect fields still missing (ask instead of failing), and turn raw
// reflection output into a plain sentence. No I/O — safe to unit-test.

export type EntityContext = {
  /** Brand explicitly named in the user's goal (highest priority). */
  goalBrand?: string | null;
  workspace?: { name?: string | null; brand_url?: string | null; keywords?: any; country?: string | null; city?: string | null } | null;
  profile?: { brand_name?: string | null; brand_keywords?: string | null; hq_country?: string | null; entity_type?: string | null; entity_links?: any; target_markets?: any } | null;
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
  competitor_monitor: ["brand"],
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
};

const ANY_BRAND = ["brand", "brand_name", "company", "business_name", "project_name"];

function str(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(", ");
  return typeof v === "string" ? v.trim() : typeof v === "object" ? "" : String(v).trim();
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
  return (REQUIRED_FIELDS[tool] || []).filter((k) => str(input[k]).length < 2);
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
export function fillFromTask(tool: string, input: Record<string, any>, results: Array<{ tool: string; ok: boolean; output: any }>): Record<string, any> {
  const out = { ...input };
  if (tool === "competitor_monitor" && !["create", "list", "recheck", "delete", "policy"].includes(String(out.action))) out.action = "create";
  if ((tool === "compare" || tool === "competitor_monitor") && !(Array.isArray(out.competitors) ? out.competitors.length : str(out.competitors))) {
    const c = priorCompetitors(results, str(out.brand));
    if (c.length) { out.competitors = c; out.competitors_source = "prior_steps"; }
  }
  return out;
}

const Q: Record<string, Record<"ar" | "en" | "ku", string>> = {
  brand: { ar: "لم نجد اسم العلامة لهذه الخطوة، ما هو؟", en: "We couldn't find the brand name for this step — what is it?", ku: "ناوی براند بۆ ئەم هەنگاوە نەدۆزرایەوە، چییە؟" },
  description: { ar: "ما موضوع المحتوى الذي تريد منشورات عنه؟", en: "What should the posts be about?", ku: "پۆستەکان دەربارەی چی بن؟" },
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
