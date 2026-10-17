/**
 * Context-aware interview primitives for Maaroof.
 *
 * Pure functions only: no database, provider, network, or runtime-specific
 * dependencies. Persistence and UI flow are intentionally implemented by
 * separate adapters so interviews can be used across entities and workflows.
 */

export const INTERVIEW_LOCALES = ["ar", "en", "ku"] as const;
export type InterviewLocale = (typeof INTERVIEW_LOCALES)[number];

export const INTERVIEW_TARGET_TYPES = [
  "individual",
  "creator",
  "company",
  "agency",
  "client",
  "brand",
  "project",
  "task",
] as const;
export type InterviewTargetType = (typeof INTERVIEW_TARGET_TYPES)[number];

export const INTERVIEW_DOMAINS = ["general", "seo", "aeo", "geo", "gseo"] as const;
export type InterviewDomain = (typeof INTERVIEW_DOMAINS)[number];

export type InterviewValue = string | number | boolean | string[];
export type InterviewAnswerStatus = "answered" | "skipped" | "unknown";
export type InterviewAnswerSource = "user" | "client" | "verified_source" | "inferred";

export type InterviewCondition =
  | { questionId: string; operator: "answered" }
  | { questionId: string; operator: "equals" | "not_equals"; value: string | number | boolean }
  | { questionId: string; operator: "contains" | "not_contains"; value: string };

export type InterviewQuestion = {
  id: string;
  /** Questions are scoped to the entity being interviewed, not just the signed-in user. */
  targetTypes?: InterviewTargetType[];
  /** A question with no domains is generally applicable. */
  domains?: InterviewDomain[];
  prompt: Record<InterviewLocale, string>;
  required: boolean;
  /** Defaults to true. Set false for answers that must not be skipped. */
  canSkip?: boolean;
  /** Defaults to true. Set false when "unknown" is not a permitted response. */
  allowUnknown?: boolean;
  /** Lower numbers are asked first within the same required/optional group. */
  priority?: number;
  /** All conditions must match before the question becomes applicable. */
  when?: InterviewCondition[];
};

export type InterviewContext = {
  targetType: InterviewTargetType;
  domains: InterviewDomain[];
  locale: InterviewLocale;
  /** Optional stable identifier for the target entity (for persistence adapters). */
  targetId?: string;
  /** Optional stable identifier for the project/task that initiated the interview. */
  workflowId?: string;
};

export type InterviewAnswerRecord = {
  questionId: string;
  status: InterviewAnswerStatus;
  value: InterviewValue | null;
  source: InterviewAnswerSource;
  updatedAt: string;
};

export type InterviewState = {
  context: InterviewContext;
  answers: Record<string, InterviewAnswerRecord>;
  updatedAt?: string;
};

export type InterviewResponseInput = {
  questionId: string;
  status: InterviewAnswerStatus;
  value?: InterviewValue | null;
  source?: InterviewAnswerSource;
};

export type InterviewResponseError =
  | "unknown_question"
  | "question_not_applicable"
  | "empty_answer"
  | "skip_not_allowed"
  | "unknown_not_allowed";

export type InterviewResponseResult =
  | { ok: true; state: InterviewState }
  | { ok: false; error: InterviewResponseError };

export type InterviewProgress = {
  requiredTotal: number;
  requiredAnswered: number;
  requiredMissing: number;
  requiredSkipped: number;
  requiredUnknown: number;
  requiredNotYetAsked: number;
  optionalRemaining: number;
  completionPercent: number;
};

export function createInterviewState(context: InterviewContext): InterviewState {
  return { context: { ...context, domains: [...context.domains] }, answers: {} };
}

export function hasMeaningfulInterviewValue(value: InterviewValue | null | undefined): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return value.some((part) => part.trim().length > 0);
}

function comparable(value: InterviewValue | null | undefined): string | number | boolean | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map((part) => part.trim().toLocaleLowerCase()).join("\u0000");
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : value;
}

function conditionMatches(condition: InterviewCondition, state: InterviewState): boolean {
  const answer = state.answers[condition.questionId];
  const hasAnswer = answer?.status === "answered" && hasMeaningfulInterviewValue(answer.value);

  if (condition.operator === "answered") return Boolean(hasAnswer);
  if (!hasAnswer) return false;

  const actual = answer.value;
  if (condition.operator === "equals") return comparable(actual) === comparable(condition.value);
  if (condition.operator === "not_equals") return comparable(actual) !== comparable(condition.value);

  const needle = condition.value.trim().toLocaleLowerCase();
  const found = Array.isArray(actual)
    ? actual.some((part) => part.trim().toLocaleLowerCase() === needle)
    : typeof actual === "string" && actual.toLocaleLowerCase().includes(needle);

  return condition.operator === "contains" ? found : !found;
}

export function isInterviewQuestionApplicable(
  question: InterviewQuestion,
  state: InterviewState,
): boolean {
  const { targetType, domains } = state.context;
  if (question.targetTypes?.length && !question.targetTypes.includes(targetType)) return false;

  const questionDomains = question.domains || [];
  if (questionDomains.length && !questionDomains.includes("general")) {
    if (!domains.some((domain) => questionDomains.includes(domain))) return false;
  }

  return (question.when || []).every((condition) => conditionMatches(condition, state));
}

/**
 * Returns the next unanswered required question.
 * Optional questions are only included when the caller explicitly opts in,
 * preventing a short task from becoming an unnecessarily long questionnaire.
 */
export function getNextInterviewQuestion(
  questions: InterviewQuestion[],
  state: InterviewState,
  options: { includeOptional?: boolean } = {},
): InterviewQuestion | null {
  const ordered = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => isInterviewQuestionApplicable(question, state))
    .filter(({ question }) => !state.answers[question.id])
    .sort((a, b) => {
      const priorityDiff = (a.question.priority ?? 100) - (b.question.priority ?? 100);
      return priorityDiff || a.index - b.index;
    });

  const required = ordered.find(({ question }) => question.required);
  if (required) return required.question;

  if (options.includeOptional) {
    return ordered.find(({ question }) => !question.required)?.question ?? null;
  }

  return null;
}

export function recordInterviewResponse(
  state: InterviewState,
  questions: InterviewQuestion[],
  input: InterviewResponseInput,
  now = new Date().toISOString(),
): InterviewResponseResult {
  const question = questions.find((candidate) => candidate.id === input.questionId);
  if (!question) return { ok: false, error: "unknown_question" };
  if (!isInterviewQuestionApplicable(question, state)) {
    return { ok: false, error: "question_not_applicable" };
  }

  let value: InterviewValue | null = null;
  if (input.status === "answered") {
    if (!hasMeaningfulInterviewValue(input.value)) return { ok: false, error: "empty_answer" };
    value = Array.isArray(input.value)
      ? input.value.map((part) => part.trim()).filter(Boolean)
      : typeof input.value === "string"
        ? input.value.trim()
        : input.value as number | boolean;
  } else if (input.status === "skipped") {
    if (question.canSkip === false) return { ok: false, error: "skip_not_allowed" };
  } else if (question.allowUnknown === false) {
    return { ok: false, error: "unknown_not_allowed" };
  }

  const answer: InterviewAnswerRecord = {
    questionId: question.id,
    status: input.status,
    value,
    source: input.source || "user",
    updatedAt: now,
  };

  return {
    ok: true,
    state: {
      ...state,
      answers: { ...state.answers, [question.id]: answer },
      updatedAt: now,
    },
  };
}

export function getInterviewProgress(
  questions: InterviewQuestion[],
  state: InterviewState,
): InterviewProgress {
  const applicable = questions.filter((question) => isInterviewQuestionApplicable(question, state));
  const required = applicable.filter((question) => question.required);
  const requiredAnswered = required.filter((question) => {
    const answer = state.answers[question.id];
    return answer?.status === "answered" && hasMeaningfulInterviewValue(answer.value);
  }).length;

  const requiredSkipped = required.filter((question) => state.answers[question.id]?.status === "skipped").length;
  const requiredUnknown = required.filter((question) => state.answers[question.id]?.status === "unknown").length;
  const requiredNotYetAsked = required.filter((question) => !state.answers[question.id]).length;
  const optionalRemaining = applicable.filter((question) => !question.required && !state.answers[question.id]).length;

  return {
    requiredTotal: required.length,
    requiredAnswered,
    requiredMissing: required.length - requiredAnswered,
    requiredSkipped,
    requiredUnknown,
    requiredNotYetAsked,
    optionalRemaining,
    completionPercent: required.length === 0 ? 100 : Math.round((requiredAnswered / required.length) * 100),
  };
}

/** True means every currently applicable required question has been handled. */
export function isInterviewTraversalComplete(
  questions: InterviewQuestion[],
  state: InterviewState,
): boolean {
  return getNextInterviewQuestion(questions, state) === null;
}

/** True only when all currently applicable required questions have actual answers. */
export function isInterviewDataComplete(
  questions: InterviewQuestion[],
  state: InterviewState,
): boolean {
  return getInterviewProgress(questions, state).requiredMissing === 0;
}
