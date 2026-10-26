// OpenRouter chat runner (primary for Maaroof chat). Returns "" on any failure so callers fall back.
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_CHAT_CHAIN = ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-2.5-flash", "deepseek/deepseek-chat"];

export async function openRouterChat(
  messages: { role: string; content: string }[],
  opts: { fetchImpl?: typeof fetch; apiKey?: string; timeoutMs?: number } = {},
): Promise<string> {
  const key = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) return "";
  const f = opts.fetchImpl ?? fetch;
  for (const model of OPENROUTER_CHAT_CHAIN) {
    try {
      const res = await f(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://maaroofai.com", "X-Title": "Maaroof AI" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
        body: JSON.stringify({ model, messages, temperature: 0.4 }),
      });
      if (!res.ok) continue;
      const j: any = await res.json().catch(() => null);
      const text = String(j?.choices?.[0]?.message?.content || "").trim();
      if (text) return text;
    } catch { /* next model */ }
  }
  return "";
}

/** True when the user explicitly asks for the ten engines' opinion. */
export function detectCouncilRequest(message: string): boolean {
  return /(النماذج|المحركات)\s*(ال)?(10|عشر)|مجلس\s*(النماذج|المحركات)|ten (ai )?(engines|models)|10 (ai )?(engines|models)|council/i.test(message);
}
