import { describe, expect, it } from "vitest";
import { adaptRecordedEngineAnswers, buildVisibilityQueries } from "./visibility-intelligence-adapters";

const scope = { brandName: "Acme", officialWebsite: "https://acme.example", geography: "Iraq", audienceLanguage: "ar" };

describe("buildVisibilityQueries", () => {
  it("creates stable, language-aware query categories without using language as geography", () => {
    const qs = buildVisibilityQueries(scope, "couture");
    expect(qs.map(q => q.kind)).toEqual(["blind_discovery","brand_recognition","recommendation","comparison","fact_verification","purchase_intent"]);
    expect(qs.every(q => q.geography === "Iraq" && q.audienceLanguage === "ar" && q.stable)).toBe(true);
    expect(qs[0].prompt).not.toContain("Acme");
    expect(qs[1].prompt).toContain("Acme");
  });
  it("does not guess the category", () => {
    expect(() => buildVisibilityQueries(scope, "")).toThrow(/category is required/);
  });
});

describe("adaptRecordedEngineAnswers", () => {
  it("excludes fallback answers from direct engine visibility and preserves failed states", () => {
    const result = adaptRecordedEngineAnswers([
      { market:"Iraq", engine:"A", status:"answered", answer:"Acme", urls:[], provider_path:"primary", model_used:"model-a" },
      { market:"Iraq", engine:"B", status:"answered", answer:"Acme", urls:[], provider_path:"fallback", model_used:"proxy" },
      { market:"Iraq", engine:"C", status:"timeout", answer:"", urls:[] },
    ], { planned: 3, queryIdFor: (_a,i) => "q-" + i });
    expect(result.excludedFallback).toBe(1);
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0].status).toBe("answered");
    expect(result.observations[1].status).toBe("timeout");
    expect(result.observations[1].answer).toBeNull();
  });
});
