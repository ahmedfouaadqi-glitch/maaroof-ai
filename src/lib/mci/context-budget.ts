// Dynamic context budget. Base values are initial defaults only.
import type { CognitiveStage, TaskComplexity, RiskLevel } from "./types";

export const DEFAULT_STAGE_BUDGET: Record<CognitiveStage, number> = {
  perception: 600, understanding: 1200, envision: 1200, planning: 1500, council: 1500,
  conflict: 1500, tool_execution: 1200, reality: 2000, verification: 2000, final: 1500, learning: 600,
};

export type BudgetConfig = {
  stage: CognitiveStage;
  complexity?: TaskComplexity;
  risk?: RiskLevel;
  modelContextWindow?: number;
  overrides?: Partial<Record<CognitiveStage, number>>;
};

const CX = { low: 0.75, medium: 1, high: 1.5 } as const;
const RK = { low: 1, medium: 1.1, high: 1.3 } as const;

export function computeContextBudget(c: BudgetConfig): number {
  const base = c.overrides?.[c.stage] ?? DEFAULT_STAGE_BUDGET[c.stage];
  let b = base * CX[c.complexity || "medium"] * RK[c.risk || "low"];
  if (c.modelContextWindow && c.modelContextWindow > 0) b = Math.min(b, c.modelContextWindow * 0.25);
  return Math.max(200, Math.round(b));
}

export const estimateTokens = (s: string) => Math.ceil(String(s || "").length / 4);
