// Architecture & Concept: Ahmed Maaroof
// Pure helpers for the Maaroof executor: fill missing tool inputs from known
// context, detect fields still missing (ask instead of failing), and turn raw
// reflection output into a plain sentence. No I/O — safe to unit-test.

export type EntityContext = {
  /** Brand explicitly named in the user's goal (highest priority). */
  goalBrand?: string | null;
  workspace?: { name?: string | null; brand_url?: string | null; keywords?: any; country?: string | null; city?: string | null } | null;
  profile?: { brand_name?: string | null; brand_keywords?: string | null; hq_country?: string | null } | null;
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
  if (tool === "research" && !str(out.query) && ctx.goal) out.query = ctx.goal.slice(0, 300);
  // Planning tools receive the user's own horizon (any unit), never a fixed one.
  if (["geo_strategist", "what_if", "brand_boost"].includes(tool) && !out.timeframe && ctx.goal) out.timeframe = ctx.goal.slice(0, 300);
  return out;
}

/** Required fields still empty after filling. */
export function missingFields(tool: string, input: Record<string, any>): string[] {
  return (REQUIRED_FIELDS[tool] || []).filter((k) => str(input[k]).length < 2);
}

const Q: Record<string, Record<"ar" | "en" | "ku", string>> = {
  brand: { ar: "لم نجد اسم العلامة لهذه الخطوة، ما هو؟", en: "We couldn't find the brand name for this step — what is it?", ku: "ناوی براند بۆ ئەم هەنگاوە نەدۆزرایەوە، چییە؟" },
  query: { ar: "ما الموضوع الذي تريد البحث عنه بالضبط؟", en: "What exactly should we research?", ku: "چی بە وردی لێکۆڵینەوەی بۆ بکەین؟" },
};

export function clarifyQuestion(field: string, lang: "ar" | "en" | "ku"): string {
  const k = ANY_BRAND.includes(field) ? "brand" : field === "query" ? "query" : "brand";
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
