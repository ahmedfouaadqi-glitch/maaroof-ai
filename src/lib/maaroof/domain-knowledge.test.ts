import { describe, expect, it } from "vitest";
import { DOMAIN_KNOWLEDGE, getDomainKnowledge, validateDomainKnowledge } from "./domain-knowledge";

describe("evidence-backed domain knowledge", () => {
  it("contains unique, sourced records linked to existing ontology terms", () => {
    expect(validateDomainKnowledge()).toEqual([]);
    expect(new Set(DOMAIN_KNOWLEDGE.map((x) => x.acronym.toLowerCase())).size).toBe(DOMAIN_KNOWLEDGE.length);
  });

  it("keeps scientific and industry classifications distinct", () => {
    expect(getDomainKnowledge("RAG")?.knowledge_kind).toBe("technical_method");
    expect(getDomainKnowledge("GEO")?.knowledge_kind).toBe("research_field");
    expect(getDomainKnowledge("AEO")?.knowledge_kind).toBe("industry_practice");
    expect(getDomainKnowledge("E-E-A-T")?.knowledge_kind).toBe("evaluation_framework");
    expect(getDomainKnowledge("RDF")?.knowledge_kind).toBe("standard");
  });

  it("records material limitations rather than inventing universal scores", () => {
    expect(getDomainKnowledge("GEO")?.limitations.some((x) => x.toLowerCase().includes("universal geo score"))).toBe(true);
    expect(getDomainKnowledge("E-E-A-T")?.limitations.some((x) => x.toLowerCase().includes("invented google"))).toBe(true);
  });

  it("returns no record for an unknown concept", () => {
    expect(getDomainKnowledge("not-a-real-term")).toBeUndefined();
  });
});
