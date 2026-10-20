import { describe, it, expect } from "vitest";
import { auditTargets, isDeepAuditRequired, axisWeights, axisPriority, weightedScore } from "../deep-audit";

describe("deep audit rules", () => {
  it("account with links requires a deep audit", () => {
    expect(isDeepAuditRequired(["maaroofai.com"])).toBe(true);
  });
  it("account without links does not require one and yields no targets", () => {
    expect(isDeepAuditRequired([])).toBe(false);
    expect(auditTargets(["", "  ", "notalink"])).toEqual([]);
  });
  it("classifies official, social and page links", () => {
    const t = auditTargets(["https://www.maaroofai.com", "instagram.com/maaroof", "maaroofai.com/guide"]);
    expect(t.map((x) => x.kind)).toEqual(["official", "social", "page"]);
    expect(t[0].axes).toHaveLength(5);
    expect(t[1].platform).toBe("instagram");
  });
  it("dedupes the same link", () => {
    expect(auditTargets(["maaroofai.com", "https://www.maaroofai.com/"])).toHaveLength(1);
  });
  it("weights sum to 1 for each of the seven kinds", () => {
    for (const k of ["product_company", "marketing_company", "news_agency", "content_creator", "public_figure", "individual", "agency_with_clients"] as const) {
      const w = axisWeights(k);
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
  });
  it("priority follows the account kind", () => {
    expect(axisPriority("news_agency").slice(0, 2).sort()).toEqual(["geo", "sge"]);
    expect(axisPriority("content_creator")[0]).toBe("gseo");
    expect(axisPriority("product_company").slice(0, 2).sort()).toEqual(["aeo", "seo"]);
  });
  it("unmeasured axes give null, never a guessed number", () => {
    expect(weightedScore({ seo: null, aeo: null }, "individual")).toBeNull();
    expect(weightedScore({ seo: 80 }, "product_company")).toBe(80);
  });
});
