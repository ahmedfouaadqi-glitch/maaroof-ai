import { describe, it, expect } from "vitest";
import {
  normalizeAlexandriaCandidates, normalizeAlexandriaExecutionResponse, validateAlexandriaOptions,
  decideSpecializedRunReplay,
} from "./alexandria.server";

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

  it("normalizes nested v2 capability results and provider-reported cost", () => {
    expect(normalizeAlexandriaExecutionResponse({
      success: true,
      data: { creditsCost: 4, alexandria: [
        { provider: "particle", capability: "series/observations", data: { records: [{ id: 1 }] }, creditsCost: 3 },
      ] },
    }, "particle", "series/observations")).toEqual({
      data: { records: [{ id: 1 }] },
      creditsCost: 3,
      errorCode: null,
    });
  });

  it("maps item-level terms and rate errors to neutral guarded states", () => {
    expect(normalizeAlexandriaExecutionResponse({
      success: true,
      data: { alexandria: [{ provider: "x", capability: "y", error: { code: "THIRD_PARTY_DATA_TERMS_REQUIRED" } }] },
    }, "x", "y").errorCode).toBe("specialized_source_terms_not_accepted");
    expect(normalizeAlexandriaExecutionResponse({
      success: true,
      data: { alexandria: [{ provider: "x", capability: "y", error: { code: "RATE_LIMIT_EXCEEDED" } }] },
    }, "x", "y").errorCode).toBe("specialized_source_rate_limited");
  });

  it("rejects an ambiguous multi-capability response instead of returning unrelated records", () => {
    expect(normalizeAlexandriaExecutionResponse({
      success: true,
      data: { alexandria: [
        { provider: "a", capability: "x", data: { records: [] } },
        { provider: "b", capability: "y", data: { records: [1] } },
      ] },
    }, "c", "z").errorCode).toBe("specialized_source_response_mismatch");
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

  it("replays a completed result only for the same request, candidate, and workspace", () => {
    const response = { ok: true };
    const row = { candidate_id: "candidate-123", workspace_id: "workspace-a", status: "succeeded", response };
    expect(decideSpecializedRunReplay(row, "candidate-123", "workspace-a")).toEqual({ action: "replay", response });
    expect(decideSpecializedRunReplay(row, "candidate-123", "workspace-b")).toEqual({
      action: "block", reason: "request_id_conflict", status: "succeeded",
    });
    expect(decideSpecializedRunReplay(row, "candidate-456", "workspace-a")).toEqual({
      action: "block", reason: "request_id_conflict", status: "succeeded",
    });
  });

  it("does not automatically repeat requests in an uncertain or running state", () => {
    for (const status of ["reserved", "running", "uncertain", "rejected"]) {
      expect(decideSpecializedRunReplay({
        candidate_id: "candidate-123", workspace_id: null, status,
      }, "candidate-123", null)).toEqual({
        action: "block", reason: "request_already_processed", status,
      });
    }
  });
});
