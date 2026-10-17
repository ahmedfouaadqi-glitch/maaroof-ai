import type { InterviewTargetType } from "@/lib/maaroof/interview-engine";

/**
 * Resolve the initial target for a saved-context interview.
 * Explicit client/brand workspaces are a target override. Otherwise, use the
 * account's explicit interview preference before falling back to its identity.
 * The verified entity type is not mutated or reinterpreted as an agency flag.
 */
export function defaultInterviewTargetType(
  profileInterviewPersona: unknown,
  profileEntityType: unknown,
  workspaceKind?: unknown,
): InterviewTargetType | "" {
  if (workspaceKind === "client") return "client";
  if (workspaceKind === "brand") return "brand";

  if (
    profileInterviewPersona === "individual" ||
    profileInterviewPersona === "creator" ||
    profileInterviewPersona === "company" ||
    profileInterviewPersona === "agency"
  ) {
    return profileInterviewPersona;
  }

  if (typeof workspaceKind === "string") {
    if (workspaceKind === "agency") return "agency";
    if (workspaceKind === "company" || workspaceKind === "organization") return "company";
    if (workspaceKind === "creator") return "creator";
  }

  if (profileEntityType === "organization") return "company";
  if (profileEntityType === "person") return "creator";
  if (profileEntityType === "individual") return "individual";

  return "";
}
