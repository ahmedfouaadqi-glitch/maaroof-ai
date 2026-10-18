import { describe, expect, it } from "vitest";
import {
  createInterviewState,
  getNextInterviewQuestion,
  recordInterviewResponse,
  validateInterviewQuestionSet,
  type InterviewDomain,
  type InterviewTargetType,
} from "@/lib/maaroof/interview-engine";
import {
  buildInterviewQuestionSet,
  INTERVIEW_QUESTION_SET_VERSION,
  normalizeInterviewDomains,
} from "./interview-question-bank";

describe("Maaroof interview question bank", () => {
  it("provides valid questions for all target types and domain combinations", () => {
    const targets: InterviewTargetType[] = [
      "individual",
      "creator",
      "company",
      "agency",
      "client",
      "brand",
      "project",
      "task",
    ];
    const domainSets: InterviewDomain[][] = [
      ["general"],
      ["seo"],
      ["aeo"],
      ["geo"],
      ["gseo"],
      ["seo", "aeo", "geo", "gseo"],
    ];
    for (const targetType of targets) {
      for (const domains of domainSets) {
        const questions = buildInterviewQuestionSet(targetType, domains);
        const result = validateInterviewQuestionSet(questions);
        expect(result.ok, `${targetType}: ${domains.join(",")}`).toBe(true);
        expect(questions.some((question) => question.id === "objective")).toBe(true);
      }
    }
    expect(INTERVIEW_QUESTION_SET_VERSION).toBe("2026-10-v2");
  });

  it("provides localized guidance and examples for every question in all supported locales", () => {
    const locales = ["ar", "en", "ku"] as const;
    const targets: InterviewTargetType[] = ["individual", "creator", "company", "agency", "client", "brand", "project", "task"];
    const domains: InterviewDomain[][] = [["general"], ["seo"], ["aeo"], ["geo"], ["gseo"]];
    for (const targetType of targets) for (const selectedDomains of domains) {
      for (const question of buildInterviewQuestionSet(targetType, selectedDomains)) {
        expect(question.guidance, question.id).toBeDefined();
        expect(question.example, question.id).toBeDefined();
        for (const locale of locales) {
          expect(question.guidance?.[locale].trim().length, `${question.id} guidance ${locale}`).toBeGreaterThan(0);
          expect(question.example?.[locale].trim().length, `${question.id} example ${locale}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("only includes target-specific questions for the selected target", () => {
    const agencyQuestions = buildInterviewQuestionSet("agency", ["general"]);
    expect(agencyQuestions.some((question) => question.id === "agency_services")).toBe(true);
    expect(agencyQuestions.some((question) => question.id === "company_offering")).toBe(false);
  });

  it("selects questions by entity nature and only exposes deeper optional questions when requested", () => {
    const individualQuestions = buildInterviewQuestionSet("individual", ["general"]);
    const companyQuestions = buildInterviewQuestionSet("company", ["general"]);
    const creatorQuestions = buildInterviewQuestionSet("creator", ["general"]);
    const agencyQuestions = buildInterviewQuestionSet("agency", ["general"]);

    expect(individualQuestions.some((question) => question.id === "individual_context")).toBe(true);
    expect(individualQuestions.some((question) => question.id === "company_offering")).toBe(false);
    expect(companyQuestions.some((question) => question.id === "company_offering")).toBe(true);
    expect(companyQuestions.some((question) => question.id === "creator_channels")).toBe(false);
    expect(creatorQuestions.some((question) => question.id === "creator_channels")).toBe(true);
    expect(agencyQuestions.some((question) => question.id === "agency_services")).toBe(true);

    const state = createInterviewState({
      targetType: "individual",
      domains: ["general"],
      locale: "ar",
    });
    expect(getNextInterviewQuestion(individualQuestions, state)?.id).toBe("objective");
    expect(
      getNextInterviewQuestion(individualQuestions, state, { includeOptional: true })?.id,
    ).toBe("objective");

    const objective = recordInterviewResponse(
      state,
      individualQuestions,
      {
        questionId: "objective",
        status: "answered",
        value: "Build a clear profile",
      },
      "2026-10-17T00:00:00.000Z",
    );
    expect(objective.ok).toBe(true);
    if (!objective.ok) throw new Error(objective.error);
    const audience = recordInterviewResponse(
      objective.state,
      individualQuestions,
      { questionId: "audience", status: "answered", value: "Potential customers" },
      "2026-10-17T00:01:00.000Z",
    );
    expect(audience.ok).toBe(true);
    if (!audience.ok) throw new Error(audience.error);

    expect(getNextInterviewQuestion(individualQuestions, audience.state)?.id).toBe(
      "individual_context",
    );
    const personalContext = recordInterviewResponse(
      audience.state,
      individualQuestions,
      {
        questionId: "individual_context",
        status: "answered",
        value: "Working on a personal project",
      },
      "2026-10-17T00:02:00.000Z",
    );
    expect(personalContext.ok).toBe(true);
    if (!personalContext.ok) throw new Error(personalContext.error);

    expect(getNextInterviewQuestion(individualQuestions, personalContext.state)).toBeNull();
    expect(
      getNextInterviewQuestion(individualQuestions, personalContext.state, {
        includeOptional: true,
      })?.id,
    ).toBe("success_measure");
    expect(
      individualQuestions.some(
        (question) => question.id === "success_measure" && !question.required,
      ),
    ).toBe(true);
  });

  it("adds selected domain questions without losing general questions", () => {
    const questions = buildInterviewQuestionSet("company", ["seo", "geo"]);
    expect(questions.some((question) => question.id === "audience")).toBe(true);
    expect(questions.some((question) => question.id === "seo_property")).toBe(true);
    expect(questions.some((question) => question.id === "geo_queries")).toBe(true);
    expect(questions.some((question) => question.id === "aeo_questions")).toBe(false);
  });

  it("rejects duplicate domains and invalid domain sets", () => {
    expect(normalizeInterviewDomains(["seo", "seo"])).toBeNull();
    expect(normalizeInterviewDomains(["seo", "geo"])).toEqual(["seo", "geo"]);
    expect(normalizeInterviewDomains([])).toBeNull();
  });
});
