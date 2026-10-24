// Pure: request sampling params per model family. Reasoning models (openai/*)
// reject custom temperature and reasoning_effort on the gateway, so send neither.
export const INTERVIEW_FALLBACK_MODEL = "google/gemini-2.5-flash";

/** Dardasha core: strongest first, automatic fallback on failure. */
export const CHAT_MODEL_CHAIN = ["google/gemini-2.5-pro", "openai/gpt-5", "google/gemini-2.5-flash"] as const;

export function isReasoningModel(model: string): boolean {
  return /^openai\//.test(model);
}

export function interviewSamplingParams(model: string): Record<string, number> {
  if (isReasoningModel(model)) return { max_completion_tokens: 2000 };
  return { max_tokens: 800, temperature: 0.35 };
}

/** Chat has no artificial output cap: Gemini gets its max output, reasoning models get no cap at all. */
export function chatSamplingParams(model: string): Record<string, number> {
  if (isReasoningModel(model)) return {};
  return { max_tokens: 65536, temperature: 0.3 };
}
