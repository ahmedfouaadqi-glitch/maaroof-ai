import { describe, expect, it } from "vitest";
import {
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
    expect(INTERVIEW_QUESTION_SET_VERSION).toBe("2026-10-v1");
  });

  it("only includes target-specific questions for the selected target", () => {
    const agencyQuestions = buildInterviewQuestionSet("agency", ["general"]);
    expect(agencyQuestions.some((question) => question.id === "agency_services")).toBe(true);
    expect(agencyQuestions.some((question) => question.id === "company_offering")).toBe(false);
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
