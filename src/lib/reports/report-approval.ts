export type ReportStatus =
  | "Draft"
  | "Generating"
  | "Generated"
  | "Review Required"
  | "Changes Requested"
  | "Approved"
  | "Released"
  | "Archived";

export type ReportKind = "client" | "technical";

export type ReportApprovalPolicy = {
  requireApproval: boolean;
  allowTechnicalClientRelease: boolean;
};

export type ReportApprovalEvent = {
  from: ReportStatus;
  to: ReportStatus;
  actorId: string;
  at: string;
  comment?: string;
};

export type ReportLifecycle = {
  status: ReportStatus;
  kind: ReportKind;
  policy: ReportApprovalPolicy;
  events: ReportApprovalEvent[];
};

const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  Draft: ["Generating"],
  Generating: ["Generated", "Draft"],
  Generated: ["Review Required", "Approved"],
  "Review Required": ["Changes Requested", "Approved"],
  "Changes Requested": ["Generating"],
  Approved: ["Released", "Changes Requested"],
  Released: ["Archived"],
  Archived: [],
};

export type TransitionResult =
  | { ok: true; lifecycle: ReportLifecycle }
  | { ok: false; reason: "actor_required" | "invalid_transition" | "approval_required" | "technical_release_forbidden" };

export function canReleaseReport(lifecycle: ReportLifecycle): boolean {
  if (lifecycle.status !== "Approved") return false;
  if (lifecycle.policy.requireApproval && !lifecycle.events.some((event) => event.to === "Approved")) return false;
  if (lifecycle.kind === "technical" && !lifecycle.policy.allowTechnicalClientRelease) return false;
  return true;
}

export function transitionReport(
  lifecycle: ReportLifecycle,
  next: ReportStatus,
  actorId: string,
  at: string,
  comment?: string,
): TransitionResult {
  if (!actorId.trim()) return { ok: false, reason: "actor_required" };
  if (!TRANSITIONS[lifecycle.status].includes(next)) return { ok: false, reason: "invalid_transition" };
  if (next === "Approved" && lifecycle.policy.requireApproval && lifecycle.status !== "Review Required") {
    return { ok: false, reason: "approval_required" };
  }
  if (next === "Released") {
    if (lifecycle.status !== "Approved" || !canReleaseReport(lifecycle)) {
      return {
        ok: false,
        reason: lifecycle.kind === "technical" && !lifecycle.policy.allowTechnicalClientRelease
          ? "technical_release_forbidden"
          : "approval_required",
      };
    }
  }
  const event: ReportApprovalEvent = {
    from: lifecycle.status,
    to: next,
    actorId: actorId.trim(),
    at,
    ...(comment?.trim() ? { comment: comment.trim().slice(0, 2000) } : {}),
  };
  return { ok: true, lifecycle: { ...lifecycle, status: next, events: [...lifecycle.events, event] } };
}
