// Known AI / search crawler User-Agents we want to track.
// Server-safe (no browser imports).
export const KNOWN_BOTS: { name: string; match: RegExp }[] = [
  { name: "GPTBot", match: /GPTBot/i },
  { name: "ChatGPT-User", match: /ChatGPT-User/i },
  { name: "OAI-SearchBot", match: /OAI-SearchBot/i },
  { name: "PerplexityBot", match: /PerplexityBot/i },
  { name: "Perplexity-User", match: /Perplexity-User/i },
  { name: "ClaudeBot", match: /ClaudeBot|anthropic-ai|Claude-Web/i },
  { name: "Google-Extended", match: /Google-Extended/i },
  { name: "Googlebot", match: /Googlebot/i },
  { name: "Bingbot", match: /bingbot/i },
  { name: "Applebot-Extended", match: /Applebot-Extended/i },
  { name: "Applebot", match: /Applebot/i },
  { name: "Meta-ExternalAgent", match: /Meta-ExternalAgent|FacebookBot/i },
  { name: "YouBot", match: /YouBot/i },
  { name: "Bytespider", match: /Bytespider/i },
  { name: "MistralAI-User", match: /MistralAI/i },
  { name: "DeepSeekBot", match: /DeepSeek/i },
  { name: "DuckAssistBot", match: /DuckAssistBot/i },
];

export function detectBot(userAgent: string): string | null {
  if (!userAgent) return null;
  for (const b of KNOWN_BOTS) if (b.match.test(userAgent)) return b.name;
  return null;
}

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF\u0750-\u077F-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
