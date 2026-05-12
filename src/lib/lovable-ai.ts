export const LOVABLE_AI_CHAT_COMPLETIONS_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function lovableAiHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "Lovable-API-Key": apiKey,
    "X-Lovable-AIG-SDK": "vercel-ai-sdk",
  } as const;
}