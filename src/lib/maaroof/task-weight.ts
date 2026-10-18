export type TaskWeight = "light" | "medium" | "deep";

export type TaskWeightInput = {
  goal: string;
  selectedSkillCount?: number;
  selectedToolCount?: number;
  liveEngineCount?: number;
};

export function estimateTaskWeight(input: TaskWeightInput): TaskWeight {
  const goal = String(input.goal || "").trim();
  const words = goal ? goal.split(/\s+/).filter(Boolean).length : 0;
  const chars = goal.length;
  const skillCount = Math.max(0, Number(input.selectedSkillCount) || 0);
  const toolCount = Math.max(0, Number(input.selectedToolCount) || 0);
  const engineCount = Math.max(0, Number(input.liveEngineCount) || 0);
  const score =
    (words >= 90 ? 3 : words >= 35 ? 2 : words >= 8 ? 1 : 0) +
    (chars >= 700 ? 2 : chars >= 260 ? 1 : 0) +
    (skillCount >= 4 ? 2 : skillCount >= 2 ? 1 : 0) +
    (toolCount >= 6 ? 2 : toolCount >= 3 ? 1 : 0) +
    (engineCount >= 7 ? 2 : engineCount >= 3 ? 1 : 0);
  return score >= 5 ? "deep" : score >= 2 ? "medium" : "light";
}
