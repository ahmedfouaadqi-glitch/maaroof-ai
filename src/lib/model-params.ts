// Pure: request sampling params per model family. Reasoning models (openai/*)
// reject custom temperature and reasoning_effort on the gateway, so send neither.
export const INTERVIEW_FALLBACK_MODEL = "google/gemini-2.5-flash";

export function isReasoningModel(model: string): boolean {
  return /^openai\//.test(model);
}

export function interviewSamplingParams(model: string): Record<string, number> {
  if (isReasoningModel(model)) return { max_completion_tokens: 2000 };
  return { max_tokens: 800, temperature: 0.35 };
}
