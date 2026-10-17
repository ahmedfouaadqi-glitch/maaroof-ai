// Skill access policy resolution (pure, fail-open to defaults).
// Precedence: defaults < global policy < per-plan < per-user.
import { defaultSkillAccessPolicy, MAAROOF_SKILLS, type MaaroofSkillAccessMode } from "@/lib/maaroof/skill-catalog";

const VALID_MODES: MaaroofSkillAccessMode[] = ["self_service", "contact", "disabled"];

function validMode(value: unknown): MaaroofSkillAccessMode | null {
  return typeof value === "string" && (VALID_MODES as string[]).includes(value) ? (value as MaaroofSkillAccessMode) : null;
}

function recordOf(value: unknown): Record<string, MaaroofSkillAccessMode> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, MaaroofSkillAccessMode> = {};
  for (const [key, mode] of Object.entries(value as Record<string, unknown>)) {
    const valid = validMode(mode);
    if (valid && MAAROOF_SKILLS.some((skill) => skill.key === key)) out[key] = valid;
  }
  return out;
}

/** Canonical plan key from a subscription tier ("", "pro", "premium", "business", "enterprise"). */
export function normalizePlanAccessKey(tier: string | null | undefined): string {
  const raw = String(tier || "").trim().toLowerCase();
  if (!raw || raw === "free" || raw === "trial") return "";
  if (raw === "business" || raw === "business_plan") return "business";
  if (raw === "enterprise") return "enterprise";
  if (raw === "premium" || raw === "pro_premium") return "premium";
  if (raw === "pro") return "pro";
  return raw;
}

export function resolveSkillAccessPolicy(opts: {
  globalPolicy: unknown;
  byPlan: unknown;
  byUser: unknown;
  planKey: string;
  userId?: string | null;
}): Record<string, MaaroofSkillAccessMode> {
  const merged = defaultSkillAccessPolicy();
  const layers = [recordOf(opts.globalPolicy), recordOf(opts.byPlan)?.[opts.planKey] !== undefined ? { [opts.planKey]: "" } : null];
  // byPlan is a map of planKey -> skill access map.
  const planMap = opts.byPlan && typeof opts.byPlan === "object" && !Array.isArray(opts.byPlan) ? (opts.byPlan as Record<string, unknown>) : null;
  const userMap = opts.byUser && typeof opts.byUser === "object" && !Array.isArray(opts.byUser) ? (opts.byUser as Record<string, unknown>) : null;
  for (const [key, mode] of Object.entries(recordOf(opts.globalPolicy) || {})) merged[key] = mode;
  if (planMap && opts.planKey) {
    for (const [key, mode] of Object.entries(recordOf(planMap[opts.planKey]) || {})) merged[key] = mode;
  }
  if (userMap && opts.userId) {
    for (const [key, mode] of Object.entries(recordOf(userMap[opts.userId]) || {})) merged[key] = mode;
  }
  return merged;
}
