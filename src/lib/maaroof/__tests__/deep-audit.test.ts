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

import { scoreTarget, aggregateAxes, billableUnits } from "../deep-audit";
describe("deep audit scoring", () => {
  const off = auditTargets(["maaroofai.com"])[0];
  it("no content -> every axis unmeasured with null score", () => {
    const f = scoreTarget(off, null, "Maaroof");
    expect(f).toHaveLength(5);
    expect(f.every((x) => x.score === null && x.verdict === "unmeasured")).toBe(true);
  });
  it("real content yields measured scores with evidence", () => {
    const md = "# Maaroof\n\nMaaroof serves 120 brands in 9 countries with 10 engines measured weekly across the region.\n\n## FAQ\n- What? yes\n- Why? because\n- How? like this";
    const f = scoreTarget(off, { markdown: md, title: "Maaroof", description: "GEO platform" }, "Maaroof");
    expect(f.find((x) => x.axis === "seo")!.score).toBe(80);
    expect(f.find((x) => x.axis === "gseo")!.score).toBe(100);
  });
  it("aggregate ignores unmeasured axes", () => {
    expect(aggregateAxes([scoreTarget(off, null, "x")]).seo).toBeNull();
  });
  it("charges only successful targets; all failed -> 0", () => {
    expect(billableUnits([{ ok: false }, { ok: false }])).toBe(0);
    expect(billableUnits([{ ok: true }, { ok: false }, { ok: true }])).toBe(2);
  });
});
