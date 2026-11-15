import { describe, expect, it } from "vitest";
import { DOMAIN_ONTOLOGY, DOMAIN_ONTOLOGY_BY_ACRONYM, findDomainTerms } from "./domain-ontology";
import { TOOL_CATALOG } from "@/lib/tool-catalog";

describe("domain ontology", () => {
  it("has unique acronym keys and valid linked tool names", () => {
    expect(DOMAIN_ONTOLOGY_BY_ACRONYM.size).toBe(DOMAIN_ONTOLOGY.length);
    for (const item of DOMAIN_ONTOLOGY) {
      expect(item.acronym.trim()).not.toBe("");
      expect(item.full_name_en.trim()).not.toBe("");
      expect(item.full_name_ar.trim()).not.toBe("");
      expect(item.semantic_signals.length).toBeGreaterThan(0);
      for (const tool of item.linked_tools) expect(TOOL_CATALOG.some((entry) => entry.key === tool)).toBe(true);
    }
  });
  it("keeps ambiguous and variable terms explicitly labelled", () => {
    expect(DOMAIN_ONTOLOGY_BY_ACRONYM.get("aio")?.terminology_status).toBe("ambiguous");
    expect(DOMAIN_ONTOLOGY_BY_ACRONYM.get("gseo")?.terminology_status).toBe("variable");
    expect(DOMAIN_ONTOLOGY_BY_ACRONYM.get("sge")?.terminology_status).toBe("historical");
  });
  it("retrieves terminology from acronym and semantic context", () => {
    expect(findDomainTerms("GraphRAG BM25 vector search").map((x) => x.acronym)).toContain("BM25");
    expect(findDomainTerms("بيانات منظمة JSON-LD").map((x) => x.acronym)).toContain("JSON-LD");
  });
});
