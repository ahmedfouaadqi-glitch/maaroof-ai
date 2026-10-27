import { OPENROUTER_URL } from "./openrouter.server";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

export type ProviderPath = "primary" | "fallback";
export type ProviderAttemptStatus = "answered" | "http_error" | "timeout" | "error" | "empty";
export type ProviderAttempt = {
  path: ProviderPath;
  model: string;
  status: ProviderAttemptStatus;
  httpStatus?: number;
  error?: string;
};
export type CompletionFallbackResult = {
  content: string;
  status: "answered" | "no_answer" | "empty" | "http_error" | "timeout" | "error";
  providerPath: ProviderPath | null;
  modelUsed: string | null;
  attempts: ProviderAttempt[];
  error?: string;
};

export const LOVABLE_RESEARCH_MODEL_CHAIN = [
  "google/gemini-3.7-flash",
  "openai/gpt-5.5",
] as const;

type CompletionFallbackOptions = {
  primaryModel: string;
  messages: Array<{ role: string; content: string }>;
  timeoutMs?: number;
  primaryKey?: string | null;
  fallbackKey?: string | null;
  fallbackModels?: string[];
  fetchImpl?: typeof fetch;
  /** Content validation allows callers to trigger fallback on malformed model output too. */
  acceptContent?: (content: string) => boolean;
};

function responseText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map((part: any) => typeof part === "string" ? part : String(part?.text || "")).filter(Boolean).join("\n").trim();
  }
  return "";
}

function errorStatus(error: unknown): "timeout" | "error" {
  const e = error as any;
  const message = String(e?.message || error || "");
  return e?.name === "TimeoutError" || e?.name === "AbortError" || /timed?\s*out|timeout|aborted/i.test(message)
    ? "timeout"
    : "error";
}

function describeAttempts(attempts: ProviderAttempt[]): string {
  return attempts.map((attempt) => {
    const label = attempt.path === "primary" ? "primary" : "fallback";
    const detail = attempt.httpStatus ? "HTTP " + attempt.httpStatus : attempt.error || attempt.status;
    return label + " " + attempt.model + ": " + detail;
  }).join("; ").slice(0, 700);
}

/**
 * OpenRouter first, then the existing Lovable AI Gateway automatically.
 * A missing/rejected primary key never blocks research when the gateway key is available.
 * Vendor names are retained only in request routing; callers expose the neutral route path.
 */
export async function completionWithFallback(options: CompletionFallbackOptions): Promise<CompletionFallbackResult> {
  const primaryKey = options.primaryKey !== undefined ? options.primaryKey : process.env.OPENROUTER_API_KEY;
  const fallbackKey = options.fallbackKey !== undefined ? options.fallbackKey : process.env.LOVABLE_API_KEY;
  const fallbackModels = [...new Set((options.fallbackModels?.length ? options.fallbackModels : [...LOVABLE_RESEARCH_MODEL_CHAIN]).filter(Boolean))];
  const f = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Math.min(120_000, Number(options.timeoutMs) || 30_000));
  const acceptContent = options.acceptContent || ((content: string) => !!content);
  const attempts: ProviderAttempt[] = [];

  const attempt = async (path: ProviderPath, model: string, key: string): Promise<ProviderAttempt & { content: string }> => {
    try {
      const gateway = path === "fallback";
      const headers: Record<string, string> = gateway
        ? { ...lovableAiHeaders(key) }
        : {
            Authorization: "Bearer " + key,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://maaroofai.com",
            "X-Title": "Maaroof AI",
          };
      const params = gateway && /^openai\//.test(model)
        ? { max_completion_tokens: 1400 }
        : { temperature: 0.2, max_tokens: 1400 };
      const response = await f(gateway ? LOVABLE_AI_CHAT_COMPLETIONS_URL : OPENROUTER_URL, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ model, messages: options.messages, ...params }),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        return { path, model, status: "http_error", httpStatus: response.status, error: "HTTP " + response.status, content: "" };
      }
      const json: any = await response.json().catch(() => null);
      const content = responseText(json?.choices?.[0]?.message?.content);
      if (!content || !acceptContent(content)) {
        return { path, model, status: "empty", error: content ? "Unusable model response" : "Empty model response", content: "" };
      }
      return { path, model, status: "answered", content };
    } catch (error) {
      const status = errorStatus(error);
      return { path, model, status, error: String((error as any)?.message || error || status).slice(0, 150), content: "" };
    }
  };

  if (primaryKey) {
    const first = await attempt("primary", options.primaryModel, primaryKey);
    attempts.push({ path: first.path, model: first.model, status: first.status, httpStatus: first.httpStatus, error: first.error });
    if (first.status === "answered") {
      return { content: first.content, status: "answered", providerPath: "primary", modelUsed: first.model, attempts };
    }
  }

  if (fallbackKey) {
    for (const model of fallbackModels) {
      const result = await attempt("fallback", model, fallbackKey);
      attempts.push({ path: result.path, model: result.model, status: result.status, httpStatus: result.httpStatus, error: result.error });
      if (result.status === "answered") {
        return { content: result.content, status: "answered", providerPath: "fallback", modelUsed: result.model, attempts };
      }
    }
  }

  const last = attempts[attempts.length - 1];
  if (!attempts.length) {
    return {
      content: "",
      status: "no_answer",
      providerPath: null,
      modelUsed: null,
      attempts,
      error: "No provider API key is configured for either route.",
    };
  }
  return {
    content: "",
    status: last?.status === "answered" ? "empty" : last?.status || "no_answer",
    providerPath: null,
    modelUsed: null,
    attempts,
    error: describeAttempts(attempts),
  };
}
