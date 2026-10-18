/**
 * Pure helpers for the knowledge-space interview flow.
 * Keeps model output validation and duplicate prevention independent of server I/O.
 */
export type InterviewHistoryItem = {
  question?: unknown;
  answer?: unknown;
};

export function normalizeInterviewQuestion(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[؟?!.،,؛;:。]+$/u, "")
    .trim();
}

/**
 * Keep only usable, distinct model-generated questions.
 * Existing questions and duplicates in the same response are both excluded.
 */
export function uniqueInterviewQuestions(
  proposed: unknown,
  existingQuestions: readonly unknown[] = [],
  maximum = 8,
): string[] {
  if (!Array.isArray(proposed) || !Number.isSafeInteger(maximum) || maximum <= 0) return [];

  const seen = new Set(existingQuestions.map(normalizeInterviewQuestion).filter(Boolean));
  const result: string[] = [];

  for (const value of proposed) {
    if (typeof value !== "string") continue;
    const question = value.replace(/\s+/gu, " ").trim().slice(0, 1000);
    const key = normalizeInterviewQuestion(question);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(question);
    if (result.length >= maximum) break;
  }

  return result;
}

/** Format a bounded history for the model so it can avoid repeating old questions. */
export function formatInterviewHistory(
  records: unknown,
  maximumCharacters = 5000,
): string {
  if (!Array.isArray(records) || maximumCharacters <= 0) return "No previous interview questions.";

  const entries: string[] = [];
  for (const item of records.slice(0, 40) as InterviewHistoryItem[]) {
    const question = typeof item?.question === "string"
      ? item.question.replace(/\s+/gu, " ").trim().slice(0, 300)
      : "";
    if (!question) continue;

    const answer = typeof item.answer === "string" && item.answer.trim()
      ? item.answer.replace(/\s+/gu, " ").trim().slice(0, 400)
      : "Unanswered";
    entries.push(`Q: ${question}\nA: ${answer}`);
  }

  const formatted = entries.join("\n\n");
  return formatted ? formatted.slice(0, maximumCharacters) : "No previous interview questions.";
}
