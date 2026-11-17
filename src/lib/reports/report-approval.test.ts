import { describe, expect, it } from "vitest";
import { canReleaseReport, transitionReport, type ReportLifecycle } from "./report-approval";

const base = (kind: "client" | "technical" = "client"): ReportLifecycle => ({
  status: "Generated",
  kind,
  policy: { requireApproval: true, allowTechnicalClientRelease: false },
  events: [],
});

describe("report approval lifecycle", () => {
  it("requires a review state before approval when policy requires it", () => {
    expect(transitionReport(base(), "Approved", "owner-1", "2026-11-17T10:00:00Z")).toEqual({
      ok: false, reason: "approval_required",
    });
  });

  it("records approval before release", () => {
    const review = transitionReport(base(), "Review Required", "owner-1", "2026-11-17T10:00:00Z");
    if (!review.ok) throw new Error(review.reason);
    const approved = transitionReport(review.lifecycle, "Approved", "owner-1", "2026-11-17T10:05:00Z");
    if (!approved.ok) throw new Error(approved.reason);
    expect(canReleaseReport(approved.lifecycle)).toBe(true);
    const released = transitionReport(approved.lifecycle, "Released", "owner-1", "2026-11-17T10:10:00Z");
    expect(released.ok).toBe(true);
  });

  it("blocks technical report release to clients unless policy explicitly allows it", () => {
    const technical = { ...base("technical"), status: "Approved" as const, events: [{ from: "Review Required" as const, to: "Approved" as const, actorId: "owner-1", at: "2026-11-17T10:00:00Z" }] };
    expect(canReleaseReport(technical)).toBe(false);
    expect(transitionReport(technical, "Released", "owner-1", "2026-11-17T10:01:00Z")).toEqual({
      ok: false, reason: "technical_release_forbidden",
    });
  });

  it("rejects missing actor and illegal transitions", () => {
    expect(transitionReport(base(), "Approved", "", "now")).toEqual({ ok: false, reason: "actor_required" });
    expect(transitionReport(base(), "Archived", "owner-1", "now")).toEqual({ ok: false, reason: "invalid_transition" });
  });
});
