import { describe, expect, it } from "vitest";
import {
  createInterviewState,
  getInterviewProgress,
  getNextInterviewQuestion,
  isInterviewDataComplete,
  isInterviewQuestionApplicable,
  isInterviewTraversalComplete,
  recordInterviewResponse,
  validateInterviewQuestionSet,
  type InterviewQuestion,
  type InterviewState,
} from "./interview-engine";

const prompts = { ar: "سؤال", en: "Question", ku: "پرسیار" };

function question(
  overrides: Partial<InterviewQuestion> & Pick<InterviewQuestion, "id">,
): InterviewQuestion {
  return { prompt: prompts, required: true, ...overrides };
}

function answered(
  state: InterviewState,
  questions: InterviewQuestion[],
  questionId: string,
  value: string,
) {
  const result = recordInterviewResponse(
    state,
    questions,
    { questionId, status: "answered", value },
    "2026-10-17T00:00:00.000Z",
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const baseState = () =>
  createInterviewState({ targetType: "agency", domains: ["geo", "gseo"], locale: "ar" });

describe("Maaroof interview engine", () => {
  it("asks required questions before optional questions", () => {
    const questions = [
      question({ id: "optional", required: false, priority: 1 }),
      question({ id: "required", required: true, priority: 99 }),
    ];
    const state = baseState();

    expect(getNextInterviewQuestion(questions, state)?.id).toBe("required");
    const withAnswer = answered(state, questions, "required", "نمو");
    expect(getNextInterviewQuestion(questions, withAnswer)).toBeNull();
    expect(getNextInterviewQuestion(questions, withAnswer, { includeOptional: true })?.id).toBe(
      "optional",
    );
  });

  it("filters questions by target type", () => {
    const questions = [
      question({ id: "agency_only", targetTypes: ["agency"] }),
      question({ id: "individual_only", targetTypes: ["individual"] }),
    ];
    expect(getNextInterviewQuestion(questions, baseState())?.id).toBe("agency_only");
    expect(isInterviewQuestionApplicable(questions[1], baseState())).toBe(false);
  });

  it("unlocks conditional questions after the controlling answer", () => {
    const questions = [
      question({ id: "business_type", prompt: prompts }),
      question({
        id: "client_count",
        targetTypes: ["agency"],
        when: [{ questionId: "business_type", operator: "equals", value: "agency" }],
      }),
    ];
    let state = baseState();
    expect(getNextInterviewQuestion(questions, state)?.id).toBe("business_type");
    state = answered(state, questions, "business_type", "agency");
    expect(getNextInterviewQuestion(questions, state)?.id).toBe("client_count");
  });

  it("filters domain-specific questions", () => {
    const questions = [
      question({ id: "seo", domains: ["seo"] }),
      question({ id: "geo", domains: ["geo"] }),
      question({ id: "general", domains: ["general"] }),
    ];
    const state = baseState();
    expect(isInterviewQuestionApplicable(questions[0], state)).toBe(false);
    expect(isInterviewQuestionApplicable(questions[1], state)).toBe(true);
    expect(isInterviewQuestionApplicable(questions[2], state)).toBe(true);
  });

  it("does not repeat a skipped question but still reports the missing required answer", () => {
    const questions = [question({ id: "critical", canSkip: true }), question({ id: "next" })];
    let state = baseState();
    const skipped = recordInterviewResponse(state, questions, {
      questionId: "critical",
      status: "skipped",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) throw new Error(skipped.error);
    state = skipped.state;
    expect(getNextInterviewQuestion(questions, state)?.id).toBe("next");
    expect(getInterviewProgress(questions, state).requiredSkipped).toBe(1);
    expect(getInterviewProgress(questions, state).requiredMissing).toBe(2);
    expect(isInterviewTraversalComplete(questions, state)).toBe(false);
    expect(isInterviewDataComplete(questions, state)).toBe(false);
  });

  it("allows a required question to be skipped while preserving the incomplete-data signal", () => {
    const questions = [
      question({ id: "required_one", canSkip: false }),
      question({ id: "required_two", canSkip: true, allowUnknown: true }),
    ];
    let state = answered(baseState(), questions, "required_one", "known");
    const skipped = recordInterviewResponse(state, questions, {
      questionId: "required_two",
      status: "skipped",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) throw new Error(skipped.error);
    state = skipped.state;
    expect(isInterviewTraversalComplete(questions, state)).toBe(true);
    expect(isInterviewDataComplete(questions, state)).toBe(false);
    expect(getInterviewProgress(questions, state).requiredSkipped).toBe(1);
  });

  it("records unknown answers without asking the same question forever", () => {
    const questions = [question({ id: "unknown", allowUnknown: true }), question({ id: "next" })];
    const result = recordInterviewResponse(baseState(), questions, {
      questionId: "unknown",
      status: "unknown",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(getNextInterviewQuestion(questions, result.state)?.id).toBe("next");
    expect(getInterviewProgress(questions, result.state).requiredUnknown).toBe(1);
    expect(isInterviewDataComplete(questions, result.state)).toBe(false);
  });

  it("rejects blank answers", () => {
    const result = recordInterviewResponse(baseState(), [question({ id: "brand" })], {
      questionId: "brand",
      status: "answered",
      value: "  ",
    });
    expect(result).toEqual({ ok: false, error: "empty_answer" });
  });

  it("respects a non-skippable question", () => {
    const result = recordInterviewResponse(
      baseState(),
      [question({ id: "critical", canSkip: false })],
      {
        questionId: "critical",
        status: "skipped",
      },
    );
    expect(result).toEqual({ ok: false, error: "skip_not_allowed" });
  });

  it("rejects answers to context-inapplicable questions", () => {
    const questions = [question({ id: "only_seo", domains: ["seo"] })];
    const result = recordInterviewResponse(baseState(), questions, {
      questionId: "only_seo",
      status: "answered",
      value: "answer",
    });
    expect(result).toEqual({ ok: false, error: "question_not_applicable" });
  });

  it("reports completion only when required answers exist", () => {
    const questions = [question({ id: "one" }), question({ id: "two" })];
    let state = baseState();
    state = answered(state, questions, "one", "answer one");
    expect(isInterviewDataComplete(questions, state)).toBe(false);
    state = answered(state, questions, "two", "answer two");
    expect(isInterviewDataComplete(questions, state)).toBe(true);
    expect(getInterviewProgress(questions, state).completionPercent).toBe(100);
  });

  it("does not apply text contains conditions to numeric answers", () => {
    const questions = [
      question({ id: "client_count" }),
      question({
        id: "text_followup",
        when: [{ questionId: "client_count", operator: "not_contains", value: "agency" }],
      }),
    ];
    const response = recordInterviewResponse(baseState(), questions, {
      questionId: "client_count",
      status: "answered",
      value: 42,
    });
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error(response.error);
    expect(getNextInterviewQuestion(questions, response.state)).toBeNull();
  });

  it("validates and normalizes a safe versioned question snapshot", () => {
    const result = validateInterviewQuestionSet([
      {
        id: "audience",
        prompt: { ar: "الجمهور", en: "Audience", ku: "جەماوەر" },
        required: true,
        domains: ["geo"],
      },
      {
        id: "followup",
        prompt: { ar: "متابعة", en: "Follow-up", ku: "پرسیاری بەدواداچوون" },
        required: false,
        when: [{ questionId: "audience", operator: "answered" }],
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.questions[0].prompt.ar).toBe("الجمهور");
    expect(result.questions[1].when?.[0].questionId).toBe("audience");
  });

  it("rejects duplicate ids and unknown dependencies in question snapshots", () => {
    const duplicate = validateInterviewQuestionSet([
      { id: "q", prompt: prompts, required: true },
      { id: "q", prompt: prompts, required: false },
    ]);
    expect(duplicate).toEqual({ ok: false, error: "invalid_or_duplicate_question_id" });

    const missingDependency = validateInterviewQuestionSet([
      {
        id: "q",
        prompt: prompts,
        required: true,
        when: [{ questionId: "missing", operator: "answered" }],
      },
    ]);
    expect(missingDependency).toEqual({ ok: false, error: "invalid_question_dependency" });
  });

  it("rejects cyclic question dependencies that could prevent an interview from starting", () => {
    const result = validateInterviewQuestionSet([
      {
        id: "one",
        prompt: prompts,
        required: true,
        when: [{ questionId: "two", operator: "answered" }],
      },
      {
        id: "two",
        prompt: prompts,
        required: true,
        when: [{ questionId: "one", operator: "answered" }],
      },
    ]);
    expect(result).toEqual({ ok: false, error: "question_dependency_cycle" });
  });

  it("supports array-valued answers and contains conditions", () => {
    const questions = [
      question({ id: "channels" }),
      question({
        id: "social_followup",
        when: [{ questionId: "channels", operator: "contains", value: "linkedin" }],
      }),
    ];
    let state = baseState();
    const result = recordInterviewResponse(state, questions, {
      questionId: "channels",
      status: "answered",
      value: [" LinkedIn ", "YouTube"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.answers.channels.value).toEqual(["LinkedIn", "YouTube"]);
    expect(getNextInterviewQuestion(questions, state)?.id).toBe("social_followup");
  });
});
