/**
 * Decide whether a user request should launch the existing keyword research flow.
 * This helper has no side effects; it only controls UI auto-start behavior.
 */
const KEYWORD_SIGNAL = /keyword|search term|query|seo|geo|aeo|sge|keyword research|كلمات? مفتاحية|الكلمات|مصطلحات البحث|عبارات البحث|تحسين محركات البحث|ظهور العلامة|ظهور العلامة التجارية/i;
const ANALYSIS_INTENT = /\b(analy[sz]e|analysis|audit|research|review|classify|extract|optimi[sz]e)\b|حلل|تحليل|تحليله|دقق|تدقيق|راجع|مراجعة|استخرج|استخراج|صنف|تصنيف|حسن|تحسين/i;
const WORKBOOK_OUTPUT = /\b(excel|xlsx|spreadsheet|workbook|csv|export)\b|إكسل|اكسل|مصنف|ملف(?:\s+إكسل|\s+اكسل)?|تصدير|صدّر|انتج|أنتج|إنشاء ملف/i;
const KEYWORD_COLUMN = /keyword|search term|query|كلمة مفتاحية|الكلمات المفتاحية|عبارة البحث|مصطلح البحث|وشەی کلیل/i;

/** True only when a real spreadsheet contains keyword-like column/sheet signals. */
export function hasKeywordWorkbookSignals(workbookHints: string[]): boolean {
  return workbookHints.some((hint) => KEYWORD_COLUMN.test(String(hint || "")));
}

/**
 * Auto-start the keyword workflow when the user explicitly requests keyword
 * research, with or without a workbook. Other workbook tasks still require a
 * clear keyword signal plus an explicit analysis/export intent.
 */
export function shouldAutoStartKeywordResearch(requestText: string, workbookHints: string[]): boolean {
  const request = String(requestText || "").trim();
  if (!request) return false;
  // An explicit request for keyword research should run the keyword workflow even
  // when the user did not separately say "export to Excel".
  if (shouldStartKeywordStrategyWithoutWorkbook(request)) return true;
  if (!ANALYSIS_INTENT.test(request) || !WORKBOOK_OUTPUT.test(request)) return false;
  return KEYWORD_SIGNAL.test(request) || hasKeywordWorkbookSignals(workbookHints);
}

/**
 * Detect an explicit keyword-research request when no workbook is attached.
 * This deliberately does not trigger for general questions that merely mention SEO/GEO.
 */
export function shouldStartKeywordStrategyWithoutWorkbook(requestText: string): boolean {
  const request = String(requestText || "").trim();
  if (!request) return false;
  const asksForKeywords = /keyword research|keyword ideas|keyword list|keywords for|discover keywords|find keywords|generate keywords|keywords?|الكلمات المفتاحية|كلمات مفتاحية|كلمات بحث|كلمات للبحث|عبارات البحث|مصطلحات البحث|اكتشف الكلمات|استخرج الكلمات|اعطني كلمات|أعطني كلمات|اعطني الكلم|أعطني الكلم|توليد الكلمات|بحث الكلمات|تحليل الكلمات/i.test(request);
  const action = /\b(find|discover|generate|research|analy[sz]e|audit|list|give|suggest|recommend|create|get|extract|compare|review)\b|ابحث|اكتشف|استخرج|حلل|تحليل|اعطني|أعطني|اقترح|قارن|راجع|دقق|ولد|ولّد|أنشئ|انشئ|اعمل/i.test(request);
  return asksForKeywords && action;
}
export type EvidenceState = "available" | "partial" | "none";

/** Evidence presence is separate from whether every requested source succeeded. */
export function deriveEvidenceState(input: {
  answeredMarketCalls: number;
  answeredClusterCalls: number;
  /** Answers returned by the gateway stand-in; helpful but not direct engine observations. */
  proxyAnswerCalls?: number;
  readablePages: number;
  socialResults: number;
  structuredEvidence: number;
  failedProbes: number;
}): EvidenceState {
  const evidenceCount = [
    input.answeredMarketCalls,
    input.answeredClusterCalls,
    input.readablePages,
    input.socialResults,
    input.structuredEvidence,
  ].reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  const proxyAnswers = Math.max(0, Number(input.proxyAnswerCalls) || 0);
  if (!evidenceCount) return proxyAnswers > 0 ? "partial" : "none";
  return input.failedProbes > 0 || proxyAnswers > 0 ? "partial" : "available";
}

export function hasChargeableMarketEvidence(answeredMarkets: number, hasReadablePage: boolean): boolean {
  return Number(answeredMarkets) > 0 || Boolean(hasReadablePage);
}
