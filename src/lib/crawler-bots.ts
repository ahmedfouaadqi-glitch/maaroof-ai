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
  // SEO / web-analysis crawlers
  { name: "SemrushBot", match: /SemrushBot|SiteAuditBot|SplitSignalBot/i },
  { name: "AhrefsBot", match: /AhrefsBot|AhrefsSiteAudit/i },
  { name: "MJ12bot", match: /MJ12bot/i },
  { name: "DotBot", match: /DotBot/i },
  { name: "YandexBot", match: /YandexBot|YandexMobileBot/i },
  { name: "PetalBot", match: /PetalBot/i },
  // Link previews (messaging / social)
  { name: "WhatsApp", match: /WhatsApp/i },
  { name: "TelegramBot", match: /TelegramBot/i },
  { name: "FacebookPreview", match: /facebookexternalhit|facebookcatalog/i },
  { name: "Twitterbot", match: /Twitterbot/i },
  { name: "LinkedInBot", match: /LinkedInBot/i },
  { name: "Slackbot", match: /Slackbot/i },
  { name: "Discordbot", match: /Discordbot/i },
];

const AI_BOTS = new Set(["GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot", "Perplexity-User", "ClaudeBot", "Google-Extended", "Applebot-Extended", "Meta-ExternalAgent", "YouBot", "Bytespider", "MistralAI-User", "DeepSeekBot", "DuckAssistBot"]);
const SEARCH_BOTS = new Set(["Googlebot", "Bingbot", "Applebot", "YandexBot", "PetalBot"]);
const SEO_BOTS = new Set(["SemrushBot", "AhrefsBot", "MJ12bot", "DotBot"]);
const PREVIEW_BOTS = new Set(["WhatsApp", "TelegramBot", "FacebookPreview", "Twitterbot", "LinkedInBot", "Slackbot", "Discordbot"]);

export type BotCategory = "ai" | "search" | "seo" | "preview" | "browser" | "unclassified";
export function botCategory(name: string | null | undefined): BotCategory {
  const n = String(name || "");
  if (AI_BOTS.has(n)) return "ai";
  if (SEARCH_BOTS.has(n)) return "search";
  if (SEO_BOTS.has(n)) return "seo";
  if (PREVIEW_BOTS.has(n)) return "preview";
  if (n === "Browser") return "browser";
  return "unclassified";
}

export function detectBot(userAgent: string): string | null {
  if (!userAgent) return null;
  for (const b of KNOWN_BOTS) if (b.match.test(userAgent)) return b.name;
  if (/bot|crawl|spider|slurp/i.test(userAgent)) return null;
  if (/Mozilla\/5\.0/.test(userAgent) && /(Chrome|Safari|Firefox|Edg)\//.test(userAgent)) return "Browser";
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
