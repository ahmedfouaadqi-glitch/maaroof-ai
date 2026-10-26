export type ChatActionLanguage = "ar" | "en" | "ku";

function plainText(value: string): string {
  return String(value || "")
    .replace(/[\u0060]{3}[\s\S]*?[\u0060]{3}/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[>#*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep chat-only replies and greetings free of report/task controls. */
export function hasUsefulAnalyticalContent(content: string): boolean {
  const raw = String(content || "").trim();
  const plain = plainText(raw);
  const words = plain.split(/\s+/u).filter(Boolean).length;
  if (plain.length < 180 || words < 28) return false;

  const greetingOnly = /^(?:السلام عليكم|وعليكم السلام|أهلاً|اهلا|أهلًا|مرحباً|مرحبا|هلا|صباح الخير|مساء الخير|شكراً|شكرًا|العفو|hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|you're welcome|salaam|slaw)[.!؟?\s،,]*$/iu;
  if (greetingOnly.test(plain)) return false;

  const hasStructure = /(?:^|\n)\s*(?:#{1,4}\s|[-*+]\s|\d{1,2}[.)]\s)/m.test(raw)
    || /\|[^\n]+\|\s*\n\s*\|?\s*:?-{3,}/.test(raw);
  const hasAnalysisSignal = /\b(?:analysis|recommend(?:ation)?s?|next steps|action plan|strategy|priorit(?:y|ies)|implement|improve|optimi[sz]e|diagnos(?:is|e)|findings|risk|solution|compare|roadmap|should|must)\b|(?:تحليل|توصي(?:ة|ات)|الخطوات القادمة|خطة عمل|استراتيجية|أولوية|نفّذ|تنفيذ|تحسين|تشخيص|النتائج|المخاطر|حلول|قارن|خارطة طريق|ينبغي|يجب|پێشنیار|هەنگاو|پلانی کار|شیکردنەوە)/iu.test(plain);
  return (words >= 28 && (hasStructure || hasAnalysisSignal)) || (plain.length >= 520 && words >= 70);
}

/** Only offer a task conversion when the answer contains an actionable signal. */
export function hasActionableRecommendations(content: string): boolean {
  if (!hasUsefulAnalyticalContent(content)) return false;
  const raw = String(content || "");
  const plain = plainText(raw);
  const listItems = (raw.match(/(?:^|\n)\s*(?:[-*+]\s|\d{1,2}[.)]\s)/gm) || []).length;
  const cues = /\b(?:recommend|recommendation|next steps|action plan|implement|fix|improve|optimi[sz]e|prioriti[sz]e|launch|measure|validate|should|must|need to|roadmap)\b|(?:أوصي|التوصيات|الخطوات القادمة|خطة العمل|نفّذ|تنفيذ|عالج|أصلح|حسّن|تحسين|أولوية|أطلق|قِس|تحقّق|ينبغي|يجب|خارطة الطريق|پێشنیار|هەنگاوەکان|چارەسەر|باشترکردن)/iu.test(plain);
  const multipleSections = (raw.match(/(?:^|\n)\s*#{1,4}\s+/gm) || []).length >= 2;
  return cues || listItems >= 2 || multipleSections;
}
