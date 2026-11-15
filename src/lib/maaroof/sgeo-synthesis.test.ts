import { describe, expect, it } from "vitest";
import type { AxisFinding } from "@/lib/maaroof/deep-audit";
import { synthesizeSgeo } from "@/lib/maaroof/sgeo-synthesis";

const finding = (
  axis: AxisFinding["axis"],
  evidence: string[],
  score: number | null = evidence.length ? 80 : 0,
): AxisFinding => ({
  axis,
  score,
  verdict: score == null ? "unmeasured" : score >= 70 ? "good" : score >= 40 ? "weak" : "missing",
  evidence,
  evidence_refs: [],
  reason: score == null ? "no_public_content" : evidence.length ? "measured" : "no_signal",
  next: score != null && score >= 70 ? "keep" : `improve_${axis}`,
});

const completeEvidence = (): AxisFinding[] => [
  finding("seo", ["title:Mengotti Couture", "h1", "words:650"]),
  finding("aeo", ["questions:4", "faq", "lists"]),
  finding("geo", ["brand_in_opening", "facts_first_150:3", "structured_data"]),
  finding("sge", ["concise_lead", "sections"]),
  finding("gseo", ["brand_mentioned"]),
];

describe("SGEO shared-evidence synthesis", () => {
  it("reaches 100 only when every shared pillar overlaps across all four measured axes", () => {
    const result = synthesizeSgeo([completeEvidence()]);
    expect(result.score).toBe(100);
    expect(result.measuredTargets).toBe(1);
    expect(result.sharedPillars).toEqual([
      "entity_clarity",
      "answer_structure",
      "factual_content",
      "machine_extractability",
    ]);
    expect(result.reason).toBe("measured_overlap");
  });

  it("does not synthesize a score if any of the four core axes is unmeasured", () => {
    const target = completeEvidence().map((item) =>
      item.axis === "sge" ? finding("sge", [], null) : item,
    );
    const result = synthesizeSgeo([target]);
    expect(result.score).toBeNull();
    expect(result.measuredTargets).toBe(0);
    expect(result.reason).toBe("no_target_with_all_four_axes");
    expect(result.axisCoverage.sge).toBe(0);
  });

  it("requires same-target overlap and does not combine unrelated sources into a false common signal", () => {
    const seoTarget = [
      finding("seo", ["title:Brand", "h1", "words:500"]),
      finding("aeo", ["faq"]),
      finding("geo", ["structured_data"]),
      finding("sge", ["sections"]),
    ];
    const splitTargets = [
      [finding("seo", ["title:Brand", "h1", "words:500"])],
      [finding("aeo", ["faq", "lists", "questions:3"])],
      [finding("geo", ["brand_in_opening", "facts_first_150:2", "structured_data"])],
      [finding("sge", ["concise_lead", "sections"])],
    ];
    expect(synthesizeSgeo(splitTargets).score).toBeNull();
    expect(synthesizeSgeo([seoTarget]).score).toBeLessThan(100);
  });

  it("does not use GSEO as a substitute for any of the four synthesis inputs", () => {
    const onlyGseo = [finding("gseo", ["brand_mentioned"], 100)];
    expect(synthesizeSgeo([onlyGseo]).score).toBeNull();
  });

  it("reports axis coverage separately from SGEO overlap coverage", () => {
    const one = synthesizeSgeo([completeEvidence(), [finding("seo", ["title:Brand"])]]);
    expect(one.totalTargets).toBe(2);
    expect(one.measuredTargets).toBe(1);
    expect(one.axisCoverage.seo).toBe(2);
    expect(one.axisCoverage.aeo).toBe(1);
  });

  it("recognizes the real evidence keys produced by the deep audit scorer", async () => {
    const { scoreTarget, auditTargets } = await import("@/lib/maaroof/deep-audit");
    const t = auditTargets(["maaroofai.com"])[0];
    const md = "# MAAROOF Ai\n\nMAAROOF Ai measures 10 AI engines across 5 axes for brands in 3 languages worldwide today.\n\n## FAQ\n\n### What is it?\n\nAnswer: a platform that measures brand presence inside AI answers.\n\n## Sections\n- item";
    const html = '<h1>x</h1><script type="application/ld+json">{"@type":"Organization","@type2":"x"}</script><script type="application/ld+json">{"@type":"FAQPage"}</script>';
    const f = scoreTarget(t, { markdown: md, html, title: "MAAROOF Ai", description: "MAAROOF Ai measures brand visibility in AI engines" }, "MAAROOF Ai");
    const r = synthesizeSgeo([f]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.sharedPillars).toContain("machine_extractability");
  });
});
