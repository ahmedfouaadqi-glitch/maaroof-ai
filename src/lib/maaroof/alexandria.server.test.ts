import { describe, it, expect } from "vitest";
import { normalizeAlexandriaCandidates, validateAlexandriaOptions } from "./alexandria.server";

describe("optional specialized-source connector", () => {
  it("normalizes the documented data.tools discovery response and retains private candidate IDs", () => {
    const found = normalizeAlexandriaCandidates({ data: { tools: [
      { provider: "particle", capability: "series/observations", description: "Public series observations", creditsCost: 4,
        options: { type: "object", required: ["series_id"], properties: { series_id: { type: "string" } } },
        response: { type: "object", properties: { records: { type: "array" } } } },
    ] } });
    expect(found).toHaveLength(1);
    expect(found[0].candidateId).toHaveLength(24);
    expect(found[0].estimatedCredits).toBe(4);
    expect(found[0].discoveryOnly).toBe(true);
    expect(found[0].optionsSchema?.required).toEqual(["series_id"]);
  });

  it("fails closed if the options schema is missing", () => {
    expect(validateAlexandriaOptions(null, {}).valid).toBe(false);
  });

  it("validates required keys, enums, numeric bounds and unknown options", () => {
    const schema = {
      type: "object",
      required: ["series_id", "limit"],
      properties: {
        series_id: { type: "string", minLength: 2, maxLength: 24 },
        limit: { type: "integer", minimum: 1, maximum: 10, enum: [1, 5, 10] },
      },
    };
    expect(validateAlexandriaOptions(schema, { series_id: "abc", limit: 5 })).toEqual({ valid: true, errors: [] });
    expect(validateAlexandriaOptions(schema, { series_id: "a", limit: 12, surprise: true }).valid).toBe(false);
    expect(validateAlexandriaOptions(schema, {}).errors).toContain("required:series_id");
  });

  it("accepts nested SDK-style Alexandria result blocks", () => {
    const found = normalizeAlexandriaCandidates({ data: { alexandria: [{ data: { tools: [
      { provider: "example", capability: "query", title: "Example query", credits_cost: 2,
        options_schema: { type: "object", properties: {} } },
    ] } }] } });
    expect(found[0]?.provider).toBe("example");
    expect(found[0]?.estimatedCredits).toBe(2);
  });
});
