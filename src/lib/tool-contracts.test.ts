import { describe, expect, it } from "vitest";
import { TOOL_CATALOG } from "./tool-catalog";
import { TOOL_OPTIONS } from "./tool-options";
import { MAAROOF_SKILLS } from "./maaroof/skill-catalog";
import {
  TOOL_CONTRACTS,
  getApiToolPaths,
  getPlannerSelectableToolKeys,
  getSkillExecutableToolKeys,
  getToolPath,
} from "./tool-contracts";
import { DIRECT_DISPATCH_PATHS } from "./maaroof/direct-tool-dispatch.server";

describe("canonical tool execution contracts", () => {
  it("classifies every catalog key exactly once", () => {
    expect(Object.keys(TOOL_CONTRACTS).sort()).toEqual(TOOL_CATALOG.map((tool) => tool.key).sort());
  });

  it("keeps API contracts, planner options, and direct dispatch loaders aligned", () => {
    const apiKeys = Object.values(TOOL_CONTRACTS)
      .filter((contract) => contract.execution === "api")
      .map((contract) => contract.key)
      .sort();
    expect(Object.keys(TOOL_OPTIONS).sort()).toEqual(apiKeys);
    expect([...getApiToolPaths()].sort()).toEqual([...DIRECT_DISPATCH_PATHS].sort());
  });

  it("defines an observed output envelope for every API contract", () => {
    for (const contract of Object.values(TOOL_CONTRACTS).filter((item) => item.execution === "api")) {
      expect(contract.output, contract.key).not.toBeNull();
      expect(contract.output?.errorField, contract.key).toBe("error");
      if (contract.availability === "active") {
        expect(contract.output?.successFields.length, contract.key).toBeGreaterThan(0);
      }
    }
    expect(TOOL_CONTRACTS.known.output?.transport).toBe("sse");
    expect(TOOL_CONTRACTS.known.output?.successKind).toBe("event_stream");
    expect(TOOL_CONTRACTS.competitor_monitor.output?.successKind).toBe("paused_response");
  });

  it("keeps special execution modes out of ordinary plan steps", () => {
    const selectable = getPlannerSelectableToolKeys();
    expect(selectable).toContain("translate");
    expect(selectable).toContain("teach_space");
    expect(selectable).toContain("keyword_intelligence");
    expect(selectable).not.toContain("maaroof");
    expect(selectable).not.toContain("competitor_monitor");
    expect(selectable).not.toContain("agent.command");
    expect(selectable).not.toContain("agent.run_targets");
    expect(selectable).not.toContain("agent.visibility");
  });

  it("ensures every skill references an executable contract", () => {
    for (const skill of MAAROOF_SKILLS) {
      for (const key of skill.tools) {
        expect(TOOL_CONTRACTS[key as keyof typeof TOOL_CONTRACTS]?.skillExecutable, `${skill.key}: ${key}`).toBe(true);
      }
    }
  });

  it("derives skill execution from the same selectable contract set", () => {
    expect(getSkillExecutableToolKeys().sort()).toEqual(getPlannerSelectableToolKeys().sort());
  });

  it("separates planner inputs from UI-only and injected context fields", () => {
    expect(TOOL_OPTIONS.keyword_intelligence.fields).toContain("brand");
    expect(TOOL_OPTIONS.keyword_intelligence.uiFields).toContain("live_search");
    expect(TOOL_OPTIONS.keyword_intelligence.uiFields).toContain("attachment_id");
    expect(TOOL_OPTIONS.keyword_intelligence.contextFields).toContain("workspace_id");
    expect(TOOL_OPTIONS.keyword_intelligence.fields).not.toContain("estimate_only");
    expect(TOOL_OPTIONS.research.uiFields).toContain("channel_types");
    expect(TOOL_OPTIONS.social_analysis.contextFields).toContain("official_website");
  });

  it("keeps required inputs and entity identity in the same tool metadata", () => {
    expect(TOOL_OPTIONS.brand_boost.brandField).toBe("brand_name");
    expect(TOOL_OPTIONS.company_email.brandField).toBe("company");
    expect(TOOL_OPTIONS.research.requiredFields).toEqual(["query"]);
    expect(TOOL_OPTIONS.geo_rewrite.minLength?.text).toBe(25);
    expect(TOOL_OPTIONS.keyword_intelligence.requiredAnyOf).toEqual([["brand", "site"]]);
  });

  it("preserves the legacy competitor_compare alias", () => {
    expect(getToolPath("competitor_compare")).toBe("/api/compare");
    expect(getToolPath("compare")).toBe("/api/compare");
  });

  it("marks competitor monitoring as paused rather than executable", () => {
    expect(TOOL_CONTRACTS.competitor_monitor.availability).toBe("paused");
    expect(TOOL_CONTRACTS.competitor_monitor.skillExecutable).toBe(false);
  });

  it("keeps Maaroof as the coordinator entry point, not a sub-tool", () => {
    expect(TOOL_CONTRACTS.maaroof.execution).toBe("coordinator");
    expect(TOOL_CONTRACTS.maaroof.entryPath).toBe("/api/maaroof");
    expect(getToolPath("maaroof")).toBeNull();
  });
});
