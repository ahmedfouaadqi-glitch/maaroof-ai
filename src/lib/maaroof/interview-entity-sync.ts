import type { InterviewState } from "@/lib/maaroof/interview-engine";

type ProfileSnapshot = {
  brand_name?: string | null;
  full_name?: string | null;
  entity_type?: string | null;
  specialty_scope?: string | null;
  entity_locked?: boolean | null;
};

type InterviewSnapshot = {
  workspaceId?: string | null;
  targetType: string;
  targetName: string;
  completed: boolean;
  state: InterviewState;
};

export type EntityProfileSyncPatch = {
  entity_type?:
    | "product_company"
    | "marketing_company"
    | "news_agency"
    | "content_creator"
    | "public_figure"
    | "individual"
    | "multi_client_agency";
  specialty_scope?: string;
};

const TYPE_FROM_INTERVIEW: Record<string, EntityProfileSyncPatch["entity_type"]> = {
  company: "product_company",
  creator: "content_creator",
  individual: "individual",
  agency: "multi_client_agency",
  brand: "product_company",
};

function normalizeName(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function answerText(state: InterviewState, questionIds: string[]): string {
  for (const id of questionIds) {
    const answer = state.answers[id];
    if (!answer || answer.status !== "answered" || answer.source !== "user") continue;
    const value = answer.value;
    const text = Array.isArray(value)
      ? value
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(", ")
      : typeof value === "string"
        ? value.trim()
        : "";
    if (text) return text.slice(0, 400);
  }
  return "";
}

/** Only sync user-submitted answers from a completed personal interview, never inferred facts. */
export function deriveEntityProfileSync(
  interview: InterviewSnapshot,
  profile: ProfileSnapshot,
): EntityProfileSyncPatch {
  if (!interview.completed || interview.workspaceId || profile.entity_locked) return {};
  const targetName = normalizeName(interview.targetName);
  const profileName = normalizeName(profile.brand_name);
  const fullName = normalizeName(profile.full_name);
  const matchesBrand = !!profileName && targetName === profileName;
  const matchesIndividual =
    interview.targetType === "individual" && !!fullName && targetName === fullName;
  if (!matchesBrand && !matchesIndividual) return {};

  const patch: EntityProfileSyncPatch = {};
  const inferredType = TYPE_FROM_INTERVIEW[interview.targetType];
  const currentType = String(profile.entity_type || "").toLowerCase();
  const isLegacyType =
    !currentType ||
    ["organization", "person", "company", "creator", "agency"].includes(currentType);
  if (inferredType && isLegacyType) patch.entity_type = inferredType;

  if (!String(profile.specialty_scope || "").trim()) {
    const scope = answerText(interview.state, [
      "company_offering",
      "agency_services",
      "creator_channels",
      "individual_context",
      "brand_offering",
    ]);
    if (scope) patch.specialty_scope = scope;
  }
  return patch;
}
