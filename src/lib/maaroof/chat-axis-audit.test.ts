import { describe, expect, it } from "vitest";
import { buildFiveAxisAuditGoal, detectFiveAxisAuditRequest, fiveAxisAuditReply, isFiveAxisAuditGoal } from "./chat-axis-audit";

describe("five-axis chat audit intent", () => {
  it("detects explicit English requests for all five axes", () => {
    expect(detectFiveAxisAuditRequest("Please audit all five axes: SEO, AEO, GEO, SGE and GSEO.")).toBe(true);
  });

  it("detects explicit Arabic requests for the five axes", () => {
    expect(detectFiveAxisAuditRequest("افحص المحاور الخمسة SEO وAEO وGEO وSGE وGSEO")).toBe(true);
  });

  it("detects Kurdish requests for the five axes", () => {
    expect(detectFiveAxisAuditRequest("تکایە پێنج تەوەرەکان بپشکنە SEO AEO GEO SGE GSEO")).toBe(true);
  });

  it("does not turn a general question into a live audit", () => {
    expect(detectFiveAxisAuditRequest("What are the five axes SEO, AEO, GEO, SGE and GSEO?")).toBe(false);
    expect(detectFiveAxisAuditRequest("ما هي المحاور الخمسة SEO وAEO وGEO وSGE وGSEO؟")).toBe(false);
  });

  it("builds a real five-axis audit goal and localized response", () => {
    const goal = buildFiveAxisAuditGoal("en");
    expect(goal).toContain("SEO, AEO, GEO, SGE, GSEO");
    expect(goal).toContain("normal scope and cost review");
    expect(fiveAxisAuditReply("ar")).toContain("لم يبدأ الفحص المباشر بعد");
    expect(isFiveAxisAuditGoal(goal)).toBe(true);
  });
});
