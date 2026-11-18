import { MAAROOF_SKILLS, type MaaroofSkill } from "./skill-catalog";
import { getToolContract, type ToolExecutionContract } from "@/lib/tool-contracts";

export const SKILL_FRAMEWORK_SECTIONS = [
  "goal",
  "sources",
  "plan",
  "cost",
  "evidence",
  "output",
  "nextStep",
] as const;

export type SkillToolExecutionContract = {
  key: string;
  declaredOrder: number;
  contract: ToolExecutionContract | null;
};

export type SkillExecutionContract = {
  key: string;
  labels: MaaroofSkill["label"];
  goal: MaaroofSkill["description"];
  /** Order declared in MAAROOF_SKILLS; the planner may add earlier steps. */
  toolOrder: string[];
  orderSemantics: "planner_steps_first_then_append_missing_tools_in_catalog_order";
  tools: SkillToolExecutionContract[];
  output: {
    toolResults: "per_tool_status_and_output";
    finalReport: "orchestrator_finalizer";
    frameworkSections: typeof SKILL_FRAMEWORK_SECTIONS;
  };
  successCriteria: [
    "all_referenced_tools_are_skill_executable",
    "every_tool_has_input_metadata",
    "every_tool_has_output_contract",
    "declared_tool_order_is_preserved",
  ];
};

function buildSkillContract(skill: MaaroofSkill): SkillExecutionContract {
  return {
    key: skill.key,
    labels: skill.label,
    goal: skill.description,
    toolOrder: [...skill.tools],
    orderSemantics: "planner_steps_first_then_append_missing_tools_in_catalog_order",
    tools: skill.tools.map((key, index) => ({
      key,
      declaredOrder: index + 1,
      contract: getToolContract(key),
    })),
    output: {
      toolResults: "per_tool_status_and_output",
      finalReport: "orchestrator_finalizer",
      frameworkSections: SKILL_FRAMEWORK_SECTIONS,
    },
    successCriteria: [
      "all_referenced_tools_are_skill_executable",
      "every_tool_has_input_metadata",
      "every_tool_has_output_contract",
      "declared_tool_order_is_preserved",
    ],
  };
}

export const SKILL_CONTRACTS: Record<string, SkillExecutionContract> = Object.fromEntries(
  MAAROOF_SKILLS.map((skill) => [skill.key, buildSkillContract(skill)]),
) as Record<string, SkillExecutionContract>;

export function getSkillExecutionContract(key: string): SkillExecutionContract | null {
  return SKILL_CONTRACTS[key] || null;
}
