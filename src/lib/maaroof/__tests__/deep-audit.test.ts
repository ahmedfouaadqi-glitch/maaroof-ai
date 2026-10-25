import { describe, it, expect } from "vitest";
import { auditTargets, isDeepAuditRequired, axisWeights, axisPriority, weightedScore, workspaceAuditLinks, MAX_AUDIT_TARGETS } from "../deep-audit";

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


describe("workspace account audit isolation", () => {
  it("extracts and normalizes links from the selected workspace identity", () => {
    expect(workspaceAuditLinks({
      id: "client-a",
      brand_url: "https://client-a.example",
      entity_truth_card: {
        website_url: "https://client-a.example",
        links: [{ url: "https://instagram.com/client-a" }, { href: "https://linkedin.com/company/client-a" }],
      },
    })).toEqual([
      "https://instagram.com/client-a",
      "https://linkedin.com/company/client-a",
      "https://client-a.example",
    ]);
  });

  it("does not borrow the owner's profile links when the workspace has no links", () => {
    expect(workspaceAuditLinks({ id: "client-empty", brand_url: null, entity_truth_card: {} })).toEqual([]);
  });
});

describe("multi-source audit routing", () => {
  it("normalizes and deduplicates URLs before enforcing the target cap", () => {
    expect(auditTargets(["maaroofai.com", "https://www.maaroofai.com/#top"])).toHaveLength(1);
    expect(auditTargets(Array.from({ length: MAX_AUDIT_TARGETS + 5 }, (_, i) => `https://brand-${i}.example/about`))).toHaveLength(MAX_AUDIT_TARGETS);
  });

  it("routes social profiles to relevant discovery axes, not technical SEO axes", () => {
    const instagram = auditTargets(["https://instagram.com/example"])[0];
    expect(instagram.kind).toBe("social");
    expect(instagram.axes).toEqual(["geo", "gseo", "sge"]);
    expect(instagram.axes).not.toContain("seo");
  });

  it("routes local directories and app listings according to their source type", () => {
    const maps = auditTargets(["https://google.com/maps/place/example"])[0];
    const app = auditTargets(["https://play.google.com/store/apps/details?id=com.example"])[0];
    expect(maps.kind).toBe("directory");
    expect(maps.axes).toEqual(["geo", "gseo", "aeo"]);
    expect(app.kind).toBe("app_store");
    expect(app.axes).toEqual(["seo", "aeo", "geo", "gseo"]);
  });

  it("extracts more than fifteen distinct links from the selected workspace", () => {
    const links = Array.from({ length: 25 }, (_, i) => ({ url: `https://source-${i}.example/profile` }));
    expect(workspaceAuditLinks({ id: "client-many", entity_truth_card: { links } })).toHaveLength(25);
  });

  it("never returns more than the supported audit target count", () => {
    const links = Array.from({ length: 80 }, (_, i) => `https://brand-${i}.example/`);
    expect(workspaceAuditLinks({ entity_truth_card: { links } })).toHaveLength(MAX_AUDIT_TARGETS);
    expect(auditTargets(links)).toHaveLength(MAX_AUDIT_TARGETS);
  });
});

describe("metadata-only social profile measurement", () => {
  it("measures identity signals from public profile metadata but does not invent SGE content depth", () => {
    const instagram = auditTargets(["https://instagram.com/mengotti.couture"])[0];
    const findings = scoreTarget(instagram, {
      markdown: "",
      title: "Mengotti Couture (@mengotti.couture) · Instagram photos and videos",
      description: "See Instagram photos and videos from Mengotti Couture (@mengotti.couture). Official fashion profile and latest public posts.",
    }, "Mengotti Couture");
    expect(findings.find((f) => f.axis === "geo")?.score).not.toBeNull();
    expect(findings.find((f) => f.axis === "gseo")?.score).not.toBeNull();
    expect(findings.find((f) => f.axis === "sge")?.score).toBeNull();
    expect(findings.find((f) => f.axis === "sge")?.reason).toBe("insufficient_content_for_axis");
  });

  it("keeps a blocked or metadata-empty social profile unmeasured", () => {
    const instagram = auditTargets(["https://instagram.com/example"])[0];
    const findings = scoreTarget(instagram, { markdown: "", title: "Instagram", description: "" }, "Example");
    expect(findings.every((f) => f.score === null)).toBe(true);
    expect(findings.every((f) => f.reason === "no_public_content")).toBe(true);
  });
});

