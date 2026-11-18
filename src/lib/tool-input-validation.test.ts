import { describe, expect, it } from "vitest";
import { TOOL_OPTIONS } from "./tool-options";
import { coerceToolInput, normalizeToolInput } from "./tool-input-validation";

describe("typed tool input normalization", () => {
  it("uses per-tool types when a shared field has different endpoint shapes", () => {
    const feasibility = normalizeToolInput("feasibility", {
      competitors: ["Alpha", "Beta"],
      budget_iqd: 125000,
    });
    expect(feasibility).toEqual({ competitors: "Alpha, Beta", budget_iqd: 125000 });

    const compare = normalizeToolInput("compare", { competitors: "Alpha\nBeta" });
    expect(compare).toEqual({ competitors: ["Alpha", "Beta"] });

    const bizdev = normalizeToolInput("bizdev", { goals: ["retain customers", "grow revenue"] });
    expect(bizdev).toEqual({ goals: "retain customers, grow revenue" });
    const invalidBudget = coerceToolInput("feasibility", normalizeToolInput("feasibility", {
      budget_iqd: { amount: 125000 },
    }));
    expect(invalidBudget).toEqual({
      input: {},
      issues: [{ field: "budget_iqd", expected: "string|number" }],
    });
  });

  it("coerces explicitly typed numeric, boolean, and list fields", () => {
    expect(coerceToolInput("keyword_intelligence", {
      live_search: "false",
      live_search_limit: "45",
      markets: "Iraq\nUAE",
      request_text: "keep this undeclared field",
    })).toEqual({
      input: {
        live_search: false,
        live_search_limit: 45,
        markets: ["Iraq", "UAE"],
        request_text: "keep this undeclared field",
      },
      issues: [],
    });
  });

  it("rejects objects supplied for declared text fields", () => {
    const normalized = normalizeToolInput("suggest", { description: { headline: "not a string" } });
    expect(coerceToolInput("suggest", normalized)).toEqual({
      input: {},
      issues: [{ field: "description", expected: "string" }],
    });
  });

  it("preserves false and zero as valid values", () => {
    expect(coerceToolInput("keyword_intelligence", {
      live_search: false,
      live_search_limit: 0,
    })).toEqual({
      input: { live_search: false, live_search_limit: 0 },
      issues: [],
    });
  });

  it("omits invalid declared values and reports the field without rejecting unknown fields", () => {
    expect(coerceToolInput("research", {
      include_channels: "sometimes",
      channel_types: 42,
      query: "market research",
      force: "route-specific",
    })).toEqual({
      input: { query: "market research", force: "route-specific" },
      issues: [
        { field: "include_channels", expected: "boolean" },
        { field: "channel_types", expected: "string[]" },
      ],
    });
  });

  it("preserves structured objects only for fields declared as objects", () => {
    const structured = { region: "MENA", horizon: 12 };
    expect(coerceToolInput("what_if", { changes: structured, axes: structured })).toEqual({
      input: { changes: structured, axes: structured },
      issues: [],
    });
    expect(coerceToolInput("what_if", { changes: "not-an-object" })).toEqual({
      input: {},
      issues: [{ field: "changes", expected: "object" }],
    });
  });

  it("keeps field type declarations within known tool input layers", () => {
    for (const [tool, options] of Object.entries(TOOL_OPTIONS)) {
      const known = new Set([
        ...options.fields,
        ...(options.uiFields || []),
        ...(options.contextFields || []),
      ]);
      for (const field of Object.keys(options.fieldTypes || {})) {
        expect(known.has(field), `${tool}.${field}`).toBe(true);
      }
    }
  });
});
