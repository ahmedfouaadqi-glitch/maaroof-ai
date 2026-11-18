import { describe, expect, it } from "vitest";
import { MAAROOF_SKILLS } from "./skill-catalog";
import { executableToolsFor } from "./skill-inference";
import { getSkillExecutionContract, SKILL_CONTRACTS, SKILL_FRAMEWORK_SECTIONS } from "./skill-contracts";

describe("canonical skill execution contracts", () => {
  it("defines one contract for every catalog skill", () => {
    expect(Object.keys(SKILL_CONTRACTS).sort()).toEqual(MAAROOF_SKILLS.map((skill) => skill.key).sort());
  });

  it("binds every skill to executable tools with input and output contracts", () => {
    for (const skill of MAAROOF_SKILLS) {
      const contract = getSkillExecutionContract(skill.key);
      expect(contract, skill.key).not.toBeNull();
      expect(contract?.goal).toEqual(skill.description);
      expect(contract?.toolOrder).toEqual(skill.tools);
      expect(contract?.tools.map((tool) => tool.key)).toEqual(skill.tools);
      for (const tool of contract?.tools || []) {
        expect(tool.contract?.skillExecutable, `${skill.key}: ${tool.key}`).toBe(true);
        expect(tool.contract?.options, `${skill.key}: ${tool.key} input`).not.toBeNull();
        expect(tool.contract?.output, `${skill.key}: ${tool.key} output`).not.toBeNull();
      }
    }
  });

  it("preserves declared catalog order when tools are appended to a run", () => {
    for (const skill of MAAROOF_SKILLS) {
      expect(executableToolsFor([skill.key])).toEqual(skill.tools);
    }
    expect(SKILL_CONTRACTS.search_visibility_strategy.orderSemantics)
      .toBe("planner_steps_first_then_append_missing_tools_in_catalog_order");
  });

  it("declares the seven-part skill presentation and structural acceptance criteria", () => {
    for (const contract of Object.values(SKILL_CONTRACTS)) {
      expect(contract.output.frameworkSections).toEqual([
        "goal", "sources", "plan", "cost", "evidence", "output", "nextStep",
      ]);
      expect(contract.successCriteria).toEqual([
        "all_referenced_tools_are_skill_executable",
        "every_tool_has_input_metadata",
        "every_tool_has_output_contract",
        "declared_tool_order_is_preserved",
      ]);
    }
    expect(SKILL_FRAMEWORK_SECTIONS).toHaveLength(7);
  });
});
