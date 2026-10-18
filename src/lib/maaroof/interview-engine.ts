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
  | { questionId: string; operator: "equals"; value: string | number | boolean }
  | { questionId: string; operator: "not_equals"; value: string | number | boolean }
  | { questionId: string; operator: "contains"; value: string }
  | { questionId: string; operator: "not_contains"; value: string };

export type InterviewLocalizedText = Record<InterviewLocale, string>;

export type InterviewQuestion = {
  id: string;
  /** Optional localized guidance and illustrative example; never user-provided facts. */
  guidance?: InterviewLocalizedText;
  example?: InterviewLocalizedText;
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

export type InterviewQuestionSetValidation =
  | { ok: true; questions: InterviewQuestion[] }
  | { ok: false; error: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrimitiveConditionValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/** Validate a question snapshot before it is stored for later resume. */
export function validateInterviewQuestionSet(input: unknown): InterviewQuestionSetValidation {
  if (!Array.isArray(input) || input.length === 0 || input.length > 80) {
    return { ok: false, error: "question_set_size" };
  }

  const questions: InterviewQuestion[] = [];
  const ids = new Set<string>();
  const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,79}$/;

  for (const item of input) {
    if (!isPlainRecord(item)) return { ok: false, error: "invalid_question" };

    const id = item.id;
    const prompt = item.prompt;
    if (typeof id !== "string" || !idPattern.test(id) || ids.has(id)) {
      return { ok: false, error: "invalid_or_duplicate_question_id" };
    }
    if (!isPlainRecord(prompt)) return { ok: false, error: "invalid_question_prompt" };

    const localizedPrompt = {} as Record<InterviewLocale, string>;
    for (const locale of INTERVIEW_LOCALES) {
      const localized = prompt[locale];
      if (
        typeof localized !== "string" ||
        localized.trim().length === 0 ||
        localized.length > 1200
      ) {
        return { ok: false, error: "invalid_question_prompt" };
      }
      localizedPrompt[locale] = localized.trim();
    }

    if (typeof item.required !== "boolean") {
      return { ok: false, error: "invalid_question_required" };
    }
    if (item.canSkip !== undefined && typeof item.canSkip !== "boolean") {
      return { ok: false, error: "invalid_question_skip_policy" };
    }
    if (item.allowUnknown !== undefined && typeof item.allowUnknown !== "boolean") {
      return { ok: false, error: "invalid_question_unknown_policy" };
    }
    if (
      item.priority !== undefined &&
      (typeof item.priority !== "number" ||
        !Number.isFinite(item.priority) ||
        item.priority < 0 ||
        item.priority > 10000)
    ) {
      return { ok: false, error: "invalid_question_priority" };
    }

    let targetTypes: InterviewTargetType[] | undefined;
    if (item.targetTypes !== undefined) {
      if (
        !Array.isArray(item.targetTypes) ||
        item.targetTypes.some(
          (value) =>
            typeof value !== "string" ||
            !(INTERVIEW_TARGET_TYPES as readonly string[]).includes(value),
        )
      ) {
        return { ok: false, error: "invalid_question_target_types" };
      }
      targetTypes = [...new Set(item.targetTypes as InterviewTargetType[])];
    }

    let domains: InterviewDomain[] | undefined;
    if (item.domains !== undefined) {
      if (
        !Array.isArray(item.domains) ||
        item.domains.some(
          (value) =>
            typeof value !== "string" || !(INTERVIEW_DOMAINS as readonly string[]).includes(value),
        )
      ) {
        return { ok: false, error: "invalid_question_domains" };
      }
      domains = [...new Set(item.domains as InterviewDomain[])];
    }

    let when: InterviewCondition[] | undefined;
    if (item.when !== undefined) {
      if (!Array.isArray(item.when) || item.when.length > 10) {
        return { ok: false, error: "invalid_question_conditions" };
      }
      const conditions: InterviewCondition[] = [];
      for (const rawCondition of item.when) {
        if (!isPlainRecord(rawCondition) || typeof rawCondition.questionId !== "string") {
          return { ok: false, error: "invalid_question_condition" };
        }
        const questionId = rawCondition.questionId;
        if (!idPattern.test(questionId)) return { ok: false, error: "invalid_question_condition" };

        switch (rawCondition.operator) {
          case "answered":
            if ("value" in rawCondition) return { ok: false, error: "invalid_question_condition" };
            conditions.push({ questionId, operator: "answered" });
            break;
          case "equals":
          case "not_equals":
            if (!isPrimitiveConditionValue(rawCondition.value)) {
              return { ok: false, error: "invalid_question_condition" };
            }
            conditions.push({
              questionId,
              operator: rawCondition.operator,
              value: rawCondition.value,
            });
            break;
          case "contains":
          case "not_contains":
            if (typeof rawCondition.value !== "string" || rawCondition.value.trim().length === 0) {
              return { ok: false, error: "invalid_question_condition" };
            }
            conditions.push({
              questionId,
              operator: rawCondition.operator,
              value: rawCondition.value.trim(),
            });
            break;
          default:
            return { ok: false, error: "invalid_question_condition" };
        }
      }
      when = conditions;
    }

    ids.add(id);
    questions.push({
      id,
      prompt: localizedPrompt,
      required: item.required,
      ...(targetTypes ? { targetTypes } : {}),
      ...(domains ? { domains } : {}),
      ...(item.canSkip !== undefined ? { canSkip: item.canSkip } : {}),
      ...(item.allowUnknown !== undefined ? { allowUnknown: item.allowUnknown } : {}),
      ...(item.priority !== undefined ? { priority: item.priority as number } : {}),
      ...(when ? { when } : {}),
    });
  }

  for (const question of questions) {
    for (const condition of question.when || []) {
      if (!ids.has(condition.questionId) || condition.questionId === question.id) {
        return { ok: false, error: "invalid_question_dependency" };
      }
    }
  }

  const byId = new Map(questions.map((question) => [question.id, question]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function hasCycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const condition of byId.get(id)?.when || []) {
      if (hasCycle(condition.questionId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  if (questions.some((question) => hasCycle(question.id))) {
    return { ok: false, error: "question_dependency_cycle" };
  }

  return { ok: true, questions };
}

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
  if (Array.isArray(value)) {
    return value.map((part) => part.trim().toLocaleLowerCase()).join("\u0000");
  }
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : value;
}

function conditionMatches(condition: InterviewCondition, state: InterviewState): boolean {
  const answer = state.answers[condition.questionId];
  const hasAnswer = Boolean(
    answer && answer.status === "answered" && hasMeaningfulInterviewValue(answer.value),
  );

  if (condition.operator === "answered") return hasAnswer;
  if (!answer || answer.status !== "answered" || !hasMeaningfulInterviewValue(answer.value)) {
    return false;
  }

  const actual = answer.value;
  if (condition.operator === "equals") {
    return comparable(actual) === comparable(condition.value);
  }
  if (condition.operator === "not_equals") {
    return comparable(actual) !== comparable(condition.value);
  }

  if (typeof condition.value !== "string") return false;
  const needle = condition.value.trim().toLocaleLowerCase();
  let found: boolean;

  if (Array.isArray(actual)) {
    found = actual.some((part) => part.trim().toLocaleLowerCase() === needle);
  } else if (typeof actual === "string") {
    found = actual.toLocaleLowerCase().includes(needle);
  } else {
    return false;
  }

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

/**
 * Detects a stale persisted pointer before the UI renders a question the API
 * would reject. Optional-question behavior must use the same depth at read and write time.
 */
export function isInterviewQuestionCursorConsistent(
  questions: InterviewQuestion[],
  state: InterviewState,
  currentQuestionId: string | null,
  options: { includeOptional?: boolean } = {},
): boolean {
  return (getNextInterviewQuestion(questions, state, options)?.id ?? null) === currentQuestionId;
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
        : (input.value as number | boolean);
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

  const requiredSkipped = required.filter(
    (question) => state.answers[question.id]?.status === "skipped",
  ).length;
  const requiredUnknown = required.filter(
    (question) => state.answers[question.id]?.status === "unknown",
  ).length;
  const requiredNotYetAsked = required.filter((question) => !state.answers[question.id]).length;
  const optionalRemaining = applicable.filter(
    (question) => !question.required && !state.answers[question.id],
  ).length;

  return {
    requiredTotal: required.length,
    requiredAnswered,
    requiredMissing: required.length - requiredAnswered,
    requiredSkipped,
    requiredUnknown,
    requiredNotYetAsked,
    optionalRemaining,
    completionPercent:
      required.length === 0 ? 100 : Math.round((requiredAnswered / required.length) * 100),
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
