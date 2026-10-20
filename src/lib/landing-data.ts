// Pure helpers for the public landing page. No I/O.
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";

/** Skills the admin currently shows to users: listed in enabled_skills (or all when unset) and not disabled. */
export function visibleSkillKeys(policyRaw: unknown): string[] {
  const v = policyRaw && typeof policyRaw === "object" && !Array.isArray(policyRaw) ? (policyRaw as Record<string, any>) : {};
  const all = MAAROOF_SKILLS.map((s) => s.key);
  const enabled: string[] = Array.isArray(v.enabled_skills) ? v.enabled_skills.filter((k: unknown) => typeof k === "string" && all.includes(k as string)) : all;
  const access = v.skill_access && typeof v.skill_access === "object" ? (v.skill_access as Record<string, unknown>) : {};
  return enabled.filter((k) => access[k] !== "disabled");
}

export type PublicTruthCard = {
  name: string;
  entity_type: string | null;
  hq_country: string | null;
  website: string | null;
  links_count: number;
  markets_count: number;
  updated_at: string | null;
};

/** Share of truth-card fields that are filled (0–100). Measures completeness, never invents a score. */
export function truthCardCompleteness(card: Pick<PublicTruthCard, "name" | "entity_type" | "hq_country" | "website" | "links_count" | "markets_count">): number {
  const checks = [!!card.name?.trim(), !!card.entity_type, !!card.hq_country, !!card.website, card.links_count >= 2, card.markets_count >= 1];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
