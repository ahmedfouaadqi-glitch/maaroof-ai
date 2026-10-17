import type { InterviewTargetType } from "@/lib/maaroof/interview-engine";

/**
 * The account's saved entity type is the stable default for new interviews.
 * A selected workspace can override that default when it represents a client
 * or brand. Unknown account/workspace types are never silently coerced.
 */
export function defaultInterviewTargetType(
  profileEntityType: unknown,
  workspaceKind?: unknown,
): InterviewTargetType | "" {
  if (typeof workspaceKind === "string") {
    if (workspaceKind === "agency") return "agency";
    if (workspaceKind === "client") return "client";
    if (workspaceKind === "brand") return "brand";
    if (workspaceKind === "company" || workspaceKind === "organization") return "company";
    if (workspaceKind === "creator") return "creator";
  }

  if (profileEntityType === "organization") return "company";
  if (profileEntityType === "person") return "creator";
  if (profileEntityType === "individual") return "individual";

  return "";
}
