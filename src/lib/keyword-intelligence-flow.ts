/**
 * Detect explicit requests to run keyword intelligence from an uploaded workbook.
 * This helper has no side effects: it only decides whether the UI should start
 * the existing research flow automatically.
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
 * Auto-start costly research only when the user explicitly requested analysis
 * and a workbook export/output, and the attached workbook looks like keyword data.
 * General uploads and summary-only requests stay on the normal chat path.
 */
export function shouldAutoStartKeywordResearch(requestText: string, workbookHints: string[]): boolean {
  const request = String(requestText || "").trim();
  if (!request || !ANALYSIS_INTENT.test(request) || !WORKBOOK_OUTPUT.test(request)) return false;
  return KEYWORD_SIGNAL.test(request) || hasKeywordWorkbookSignals(workbookHints);
}
