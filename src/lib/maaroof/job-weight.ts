export type JobWeight = "light" | "medium" | "deep";

export type JobWeightAssessment = {
  weight: JobWeight;
  score: number;
  goal_chars: number;
  tools_count: number;
  engines_count: number;
  reasons: string[];
};

/**
 * Deterministic workload estimate. It is a scheduling hint, not a permission
 * grant or a cost quote; actual tool charges remain authoritative.
 */
export function assessJobWeight(input: {
  goal: string;
  tools?: string[];
  selectedSkills?: string[];
  liveProbe?: boolean;
  probeEngines?: string[];
}): JobWeightAssessment {
  const goal = String(input.goal || "").trim();
  const tools = [...new Set((input.tools || []).map((x) => String(x).trim()).filter(Boolean))];
  const skills = [...new Set((input.selectedSkills || []).map((x) => String(x).trim()).filter(Boolean))];
  const engines = [...new Set((input.probeEngines || []).map((x) => String(x).trim()).filter(Boolean))];
  let score = 0;
  const reasons: string[] = [];

  if (goal.length >= 700) { score += 30; reasons.push("long_goal"); }
  else if (goal.length >= 280) { score += 15; reasons.push("medium_goal"); }

  if (tools.length >= 5) { score += 30; reasons.push("many_tools"); }
  else if (tools.length >= 3) { score += 20; reasons.push("several_tools"); }
  else if (tools.length >= 2) { score += 10; reasons.push("multiple_tools"); }

  if (skills.length >= 4) { score += 20; reasons.push("many_skills"); }
  else if (skills.length >= 2) { score += 10; reasons.push("multiple_skills"); }

  if (input.liveProbe) {
    score += 15;
    reasons.push("live_probe");
    if (engines.length >= 6) { score += 15; reasons.push("many_engines"); }
    else if (engines.length >= 3) { score += 8; reasons.push("several_engines"); }
  }

  score = Math.max(0, Math.min(100, score));
  const weight: JobWeight = score >= 55 ? "deep" : score >= 25 ? "medium" : "light";
  if (!reasons.length) reasons.push("small_scope");
  return { weight, score, goal_chars: goal.length, tools_count: tools.length, engines_count: input.liveProbe ? engines.length : 0, reasons };
}
