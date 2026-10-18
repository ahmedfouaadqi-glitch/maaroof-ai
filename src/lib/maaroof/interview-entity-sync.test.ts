import { describe, expect, it } from "vitest";
import { createInterviewState, recordInterviewResponse } from "@/lib/maaroof/interview-engine";
import { deriveEntityProfileSync } from "./interview-entity-sync";

function answeredState(
  targetType: "company" | "creator" | "individual" | "agency" | "brand" = "company",
) {
  const state = createInterviewState({
    targetType,
    locale: "ar",
    domains: ["general"],
  });
  const questionId =
    targetType === "company"
      ? "company_offering"
      : targetType === "creator"
        ? "creator_channels"
        : targetType === "agency"
          ? "agency_services"
          : targetType === "individual"
            ? "individual_context"
            : "brand_offering";
  const question = {
    id: questionId,
    prompt: { ar: "سؤال", en: "Question", ku: "پرسیار" },
    required: false,
    canSkip: true,
    allowUnknown: true,
    domains: ["general" as const],
    priority: 1,
  };
  const result = recordInterviewResponse(
    state,
    [question],
    { questionId, status: "answered", value: "حلول تقنية للشركات الصغيرة", source: "user" },
    new Date(0).toISOString(),
  );
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("deriveEntityProfileSync", () => {
  it("syncs user-answered scope and a legacy entity type after completion", () => {
    expect(
      deriveEntityProfileSync(
        {
          completed: true,
          targetType: "company",
          targetName: "Maaroof",
          state: answeredState(),
          workspaceId: null,
        },
        {
          brand_name: "Maaroof",
          entity_type: "organization",
          specialty_scope: "",
          entity_locked: false,
        },
      ),
    ).toEqual({
      entity_type: "product_company",
      specialty_scope: "حلول تقنية للشركات الصغيرة",
    });
  });

  it("does not sync an incomplete interview, a workspace interview, or a locked card", () => {
    const base = {
      targetType: "company",
      targetName: "Maaroof",
      state: answeredState(),
      workspaceId: null,
    };
    const profile = {
      brand_name: "Maaroof",
      entity_type: "organization",
      specialty_scope: "",
      entity_locked: false,
    };
    expect(deriveEntityProfileSync({ ...base, completed: false }, profile)).toEqual({});
    expect(
      deriveEntityProfileSync({ ...base, completed: true, workspaceId: "workspace-1" }, profile),
    ).toEqual({});
    expect(
      deriveEntityProfileSync({ ...base, completed: true }, { ...profile, entity_locked: true }),
    ).toEqual({});
  });

  it("does not overwrite a different profile identity or existing scope", () => {
    const interview = {
      completed: true,
      targetType: "company",
      targetName: "Another Company",
      state: answeredState(),
      workspaceId: null,
    };
    expect(
      deriveEntityProfileSync(interview, {
        brand_name: "Maaroof",
        entity_type: "product_company",
        specialty_scope: "",
        entity_locked: false,
      }),
    ).toEqual({});
    expect(
      deriveEntityProfileSync(
        { ...interview, targetName: "Maaroof" },
        {
          brand_name: "Maaroof",
          entity_type: "product_company",
          specialty_scope: "Existing scope",
          entity_locked: false,
        },
      ),
    ).toEqual({});
  });
});
