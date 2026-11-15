/** Pure bot checks for the free audit. */
export const BLOCKED_UA = /(curl|wget|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java\/|node-fetch|axios|headlesschrome|playwright|puppeteer|selenium|phantomjs|scrapy|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic|perplexitybot|ccbot|google-extended|amazonbot|facebookbot|meta-externalagent|cohere-ai|diffbot|bytespider|applebot-extended|bot\b|crawler|spider)/i;

export function isBlockedUserAgent(ua: string | null | undefined): boolean {
  const v = (ua || "").trim();
  if (!v) return true;
  return BLOCKED_UA.test(v);
}

export const MIN_FILL_MS = 3000;

/** True when the submission looks automated (honeypot filled or form filled too fast). */
export function isSuspiciousSubmission(input: { honeypot?: unknown; fill_ms?: unknown }): boolean {
  if (typeof input.honeypot === "string" && input.honeypot.trim() !== "") return true;
  const ms = Number(input.fill_ms);
  if (!Number.isFinite(ms) || ms < MIN_FILL_MS) return true;
  return false;
}
