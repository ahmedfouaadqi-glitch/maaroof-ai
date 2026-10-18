import { describe, expect, it } from "vitest";
import {
  formatInterviewHistory,
  normalizeInterviewQuestion,
  uniqueInterviewQuestionDetails,
  uniqueInterviewQuestions,
} from "../maaroof/interview-questions";

describe("knowledge-space interview questions", () => {
  it("normalizes whitespace, Unicode forms, case, and terminal punctuation", () => {
    expect(normalizeInterviewQuestion("  WHAT   matters?  ")).toBe("what matters");
    expect(normalizeInterviewQuestion("ما سياسة الإرجاع؟")).toBe("ما سياسة الإرجاع");
    expect(normalizeInterviewQuestion(null)).toBe("");
  });

  it("removes exact duplicates against old questions and the same model response", () => {
    const result = uniqueInterviewQuestions(
      [
        "What is the refund policy?",
        "  WHAT   IS THE REFUND POLICY?! ",
        "How are exceptions approved?",
        "",
        null,
        { question: "not a string" },
      ],
      ["What is the refund policy"],
    );
    expect(result).toEqual(["How are exceptions approved?"]);
  });

  it("preserves readable text, truncates long questions, and respects the limit", () => {
    const result = uniqueInterviewQuestions(
      [" A question about support ", "Second useful question", "Third useful question"],
      [],
      2,
    );
    expect(result).toEqual(["A question about support", "Second useful question"]);
    expect(uniqueInterviewQuestions(["x".repeat(1200)], [])[0]).toHaveLength(1000);
  });

  it("retains question rationale and answer examples from structured model output", () => {
    const result = uniqueInterviewQuestionDetails(
      [
        {
          question: "What is the refund policy?",
          reason: "The sources do not define how exceptions are approved.",
          answer_example: "State the policy, then describe one documented exception.",
        },
        {
          question: " WHAT IS THE REFUND POLICY?! ",
          reason: "Duplicate question.",
          answer_example: "Duplicate example.",
        },
        {
          question: "Which markets are in scope?",
          reason: "The target market is unclear.",
          answer_example: "List only the confirmed countries.",
        },
        42,
      ],
      ["Already asked question"],
      2,
    );

    expect(result).toEqual([
      {
        question: "What is the refund policy?",
        reason: "The sources do not define how exceptions are approved.",
        answer_example: "State the policy, then describe one documented exception.",
      },
      {
        question: "Which markets are in scope?",
        reason: "The target market is unclear.",
        answer_example: "List only the confirmed countries.",
      },
    ]);
  });

  it("supports legacy text-only questions without fabricated explanation", () => {
    expect(uniqueInterviewQuestionDetails(["A legacy question"])).toEqual([
      { question: "A legacy question", reason: null, answer_example: null },
    ]);
  });

  it("does not generate model context from malformed history and keeps context bounded", () => {
    expect(formatInterviewHistory(null)).toBe("No previous interview questions.");
    const history = formatInterviewHistory([
      { question: "Which markets matter?", answer: "Iraq and the Gulf" },
      { question: "What is still unknown?", answer: null },
    ]);
    expect(history).toContain("Q: Which markets matter?\nA: Iraq and the Gulf");
    expect(history).toContain("A: Unanswered");
    expect(
      formatInterviewHistory([{ question: "q", answer: "a".repeat(1000) }], 20),
    ).toHaveLength(20);
  });
});
