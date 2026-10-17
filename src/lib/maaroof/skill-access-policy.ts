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

/** Resolve one skill or tool access mode with user > plan > global precedence. */
export function resolveScopedAccessMode(args: {
  key: string;
  globalPolicy?: Partial<SkillAccessPolicy> | null;
  byPlan?: SkillAccessOverrideMap | null;
  byUser?: SkillAccessOverrideMap | null;
  planKey?: string | null;
  userId?: string | null;
}): "self_service" | "contact" | "disabled" {
  const planKey = normalizePlanAccessKey(args.planKey);
  const candidates = [
    args.userId ? args.byUser?.[args.userId]?.[args.key] : undefined,
    planKey ? args.byPlan?.[planKey]?.[args.key] : undefined,
    args.globalPolicy?.[args.key],
  ];
  return candidates.find((mode): mode is "self_service" | "contact" | "disabled" =>
    mode === "self_service" || mode === "contact" || mode === "disabled"
  ) || "self_service";
}
