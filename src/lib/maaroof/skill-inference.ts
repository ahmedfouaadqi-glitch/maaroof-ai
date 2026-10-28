// Pure: decide skills from the task text when the user picked none.
// Evidence-only — every chosen skill carries the exact words that triggered it.
// No match => clarify (never guess).
import { MAAROOF_SKILLS, recommendMaaroofSkills } from "./skill-catalog";

/** Tools that have a real executable route in the orchestrator. */
export const EXECUTABLE_TOOLS = new Set([
  "suggest", "geo_rewrite", "analyze", "research", "feasibility", "bizdev", "brand_boost", "what_if",
  "applied_ranking", "visibility", "social_analysis", "compare", "company_email", "geo_strategist",
  "brand_authority", "keyword_strategy", "known", "translate", "teach_space,
]);

export type SkillInference =
  | { kind: "selected"; skills: string[]; reasons: Record<string, string> }
  | { kind: "inferred"; skills: string[]; reasons: Record<string, string> }
  | { kind: "clarify"; skills: []; reasons: Record<string, never> };

const URL_RE = /https?:\/\/[^\s]+|\b[a-z0-9-]+\.(com|net|org|io|ai|iq|sa|ae)\b/i;

export function inferSkills(goal: string, selected: string[] = [], limit = 50): SkillInference {
  const valid = selected.filter((k) => MAAROOF_SKILLS.some((s) => s.key === k));
  if (valid.length) return { kind: "selected", skills: valid, reasons: Object.fromEntries(valid.map((k) => [k, "user_selected"])) };
  const text = String(goal || "").toLowerCase();
  const reasons: Record<string, string> = {};
  const skills: string[] = [];
  for (const s of recommendMaaroofSkills(text, limit)) {
    const hits = s.keywords.filter((k) => text.includes(k.toLowerCase())).slice(0, 3);
    if (!hits.length) continue;
    skills.push(s.key);
    reasons[s.key] = hits.join("، ");
  }
  const url = text.match(URL_RE)?.[0];
  if (url && !skills.includes("entity_readiness") && skills.length < limit) {
    skills.push("entity_readiness");
    reasons.entity_readiness = url;
  }
  if (!skills.length) return { kind: "clarify", skills: [], reasons: {} };
  return { kind: "inferred", skills, reasons };
}

export type OwnContext = {
  /** Brand name from the Entity Truth Card (or the task). */
  brand?: string | null;
  /** Profile keywords, specialty, target markets — free text. */
  profileText?: string;
  /** Saved knowledge facts and interview answers. */
  knowledgeText?: string[];
};

/**
 * Maaroof chooses by itself when the task text has no keywords: it reads the
 * user's own profile, knowledge and interview text. If that still names nothing,
 * it runs the core presence audit for the known brand. It only asks when the
 * brand itself is unknown (a required fact it cannot discover).
 */
export function chooseSkillsAutonomously(goal: string, selected: string[], own: OwnContext, limit = 50): SkillInference {
  const first = inferSkills(goal, selected, limit);
  if (first.kind !== "clarify") return first;
  const brand = String(own.brand || "").trim();
  if (brand.length < 2) return first;
  const ownText = [own.profileText || "", ...(own.knowledgeText || [])].join(" \n ").slice(0, 6000);
  const fromOwn = inferSkills(ownText, [], limit);
  if (fromOwn.kind === "inferred") {
    const reasons: Record<string, string> = {};
    for (const k of fromOwn.skills) reasons[k] = `ملفك/معرفتك: ${fromOwn.reasons[k]}`;
    if (!fromOwn.skills.includes("presence_audit") && fromOwn.skills.length < limit) {
      fromOwn.skills.unshift("presence_audit");
      reasons.presence_audit = `الهوية: ${brand}`;
    }
    return { kind: "inferred", skills: fromOwn.skills.slice(0, limit), reasons };
  }
  return { kind: "inferred", skills: ["presence_audit"], reasons: { presence_audit: `الهوية: ${brand}` } };
}

/** Executable tools for the given skills (drops tools without a route). */
export function executableToolsFor(skills: string[]): string[] {
  const out: string[] = [];
  for (const k of skills) for (const t of MAAROOF_SKILLS.find((s) => s.key === k)?.tools || []) if (EXECUTABLE_TOOLS.has(t) && !out.includes(t)) out.push(t);
  return out;
}
