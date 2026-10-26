// Pure rules: which chat requests run tools directly in the chat, and which become an approved task.
export const DIRECT_TOOL_LIMIT = 2;

/** 1-2 tools run directly in the chat; 3 or more need an explicit approved task. */
export function chatRoute(toolCount: number): "chat" | "direct" | "task" {
  if (toolCount <= 0) return "chat";
  return toolCount <= DIRECT_TOOL_LIMIT ? "direct" : "task";
}

const GEO_SCORE_RE = /(درج[ةه]|تقييم|نقاط|قيّم|قيم|score|rate|grade|نمر[ەه])\s*(?:ال)?\s*(geo|جيو)|(geo|جيو)\s*(score|درج[ةه])/i;

/** Detects "GEO score for this text/post" and returns the text to score (>= 25 chars), else null. */
export function detectGeoScoreRequest(message: string): { tool: "analyze"; text: string } | null {
  const m = String(message || "");
  if (!GEO_SCORE_RE.test(m)) return null;
  // Content is whatever follows a colon/newline, or the whole message minus the request phrase.
  const split = m.split(/[:：\n]/);
  const body = (split.length > 1 ? split.slice(1).join("\n") : m.replace(GEO_SCORE_RE, "")).trim();
  if (body.length < 25) return null;
  return { tool: "analyze", text: body };
}
