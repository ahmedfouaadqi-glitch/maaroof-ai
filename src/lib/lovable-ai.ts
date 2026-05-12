export const LOVABLE_AI_CHAT_COMPLETIONS_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function lovableAiHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "Lovable-API-Key": apiKey,
    "X-Lovable-AIG-SDK": "vercel-ai-sdk",
  } as const;
}

export function extractJsonObject<T = any>(raw: unknown): T | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const candidates = [
    text,
    text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim(),
  ];

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try { return JSON.parse(candidate) as T; } catch {}
  }
  return null;
}