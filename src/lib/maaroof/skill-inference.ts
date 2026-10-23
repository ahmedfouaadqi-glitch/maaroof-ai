// Pure: decide skills from the task text when the user picked none.
// Evidence-only — every chosen skill carries the exact words that triggered it.
// No match => clarify (never guess).
import { MAAROOF_SKILLS, recommendMaaroofSkills } from "./skill-catalog";

/** Tools that have a real executable route in the orchestrator. */
export const EXECUTABLE_TOOLS = new Set([
  "suggest", "geo_rewrite", "analyze", "research", "feasibility", "bizdev", "brand_boost", "what_if",
  "applied_ranking", "visibility", "social_analysis", "compare", "company_email", "geo_strategist",
  "competitor_monitor", "brand_authority", "known", "translate", "teach_space",
]);

export type SkillInference =
  | { kind: "selected"; skills: string[]; reasons: Record<string, string> }
  | { kind: "inferred"; skills: string[]; reasons: Record<string, string> }
  | { kind: "clarify"; skills: []; reasons: Record<string, never> };

const URL_RE = /https?:\/\/[^\s]+|\b[a-z0-9-]+\.(com|net|org|io|ai|iq|sa|ae)\b/i;

export function inferSkills(goal: string, selected: string[] = [], limit = 3): SkillInference {
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

/** Executable tools for the given skills (drops tools without a route). */
export function executableToolsFor(skills: string[]): string[] {
  const out: string[] = [];
  for (const k of skills) for (const t of MAAROOF_SKILLS.find((s) => s.key === k)?.tools || []) if (EXECUTABLE_TOOLS.has(t) && !out.includes(t)) out.push(t);
  return out;
}
