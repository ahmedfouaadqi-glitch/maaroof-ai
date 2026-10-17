import { defaultSkillAccessPolicy, type SkillAccessPolicy } from "@/lib/maaroof/skill-catalog";

export type SkillAccessOverrideMap = Record<string, SkillAccessPolicy>;

export function normalizePlanAccessKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

/** Access precedence: individual user > active plan > global default. */
export function resolveSkillAccessPolicy(args: {
  globalPolicy?: Partial<SkillAccessPolicy> | null;
  byPlan?: SkillAccessOverrideMap | null;
  byUser?: SkillAccessOverrideMap | null;
  planKey?: string | null;
  userId?: string | null;
}): SkillAccessPolicy {
  const planKey = normalizePlanAccessKey(args.planKey);
  return {
    ...defaultSkillAccessPolicy(),
    ...(args.globalPolicy || {}),
    ...(planKey ? args.byPlan?.[planKey] || {} : {}),
    ...(args.userId ? args.byUser?.[args.userId] || {} : {}),
  };
}
