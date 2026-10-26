export type ChatLang = "ar" | "en" | "ku";

const AXES = ["SEO", "AEO", "GEO", "SGE", "GSEO"] as const;
const AUDIT_VERB = /\b(check|inspect|audit|scan|test|measure|evaluate|assess|analy[sz]e|review|verify|examine|run)\b|افحص|فحص|افحصوا|افحصي|تدقيق|دقّق|دقق|اختبر|اختبار|قيّم|قياس|تحقق|تحقّق|راجع|راجعوا|شغّل|نفّذ|نفذ|پشکنین|پشکنینی|هەڵسەنگاندن|بپشکنە|بپشکنن|تاقی|هەڵبسەنگێن|verify/i;
const FIVE_AXIS_PHRASE = /\b(all\s+five|five\s+axes|five\s+dimensions|five\s+areas|these\s+five\s+areas|the\s+five\s+(?:axes|areas|dimensions|disciplines)|5\s+(?:axes|areas|dimensions))\b|المحاور\s+الخمس(?:ة)?|المحاور\s+الخمسة|المجالات\s+الخمس(?:ة)?|الأبعاد\s+الخمس(?:ة)?|پێنج\s+تەوەر|پێنج\s+محور/i;

function hasAllAxisCodes(text: string): boolean {
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]+/g, " ");
  return AXES.every((axis) => new RegExp("(?:^|\\s)" + axis + "(?:$|\\s)").test(normalized));
}

/** Detect an explicit request to run the full five-axis audit, not a question asking what the axes mean. */
export function detectFiveAxisAuditRequest(message: string): boolean {
  const text = String(message || "").trim();
  if (!text || !AUDIT_VERB.test(text)) return false;
  return hasAllAxisCodes(text) || FIVE_AXIS_PHRASE.test(text);
}

export function buildFiveAxisAuditGoal(lang: ChatLang): string {
  const axes = "SEO, AEO, GEO, SGE, GSEO";
  if (lang === "en") {
    return `Run a full evidence-based audit of all five Maaroof axes: ${axes}. Inspect the target entity/site and its available public evidence; use existing tools only where relevant; collect the ten-model visibility answers and actual citations when live visibility probing is enabled and approved. Return one card for each axis, distinguish measured findings from unmeasured items, include source URLs and concrete next steps, and never invent scores, facts or evidence. If a required target/site is missing, ask for it rather than guessing. This goal was requested in chat and must go through the normal scope and cost review before execution.`;
  }
  if (lang === "ku") {
    return `پشکنینی تەواو و پشتبەستوو بە بەڵگە بۆ هەموو پێنج تەوەری معروف ئەنجام بدە: ${axes}. قەوارە/ماڵپەڕ و بەڵگە گشتییە بەردەستەکان بپشکنە؛ تەنها ئامرازە پەیوەندیدارەکانی سیستەم بەکاربهێنە؛ وەڵام و سەرچاوە ڕاستەقینەکانی مۆدێلەکان تۆمار بکە کاتێک پشکنینی ڕاستەوخۆ بەردەست و پەسەندکراوە. بۆ هەر تەوەرێک کارتی جیاواز پیشان بدە، ئەنجامی پێوراو لە داتای نەبوو جیا بکەرەوە، و پلانی کرداری ڕوون بدە؛ هیچ نمرە یان بەڵگەیەک مەخەڵقێنە. ئەگەر ناوی قەوارە یان ماڵپەڕ ونە، پرسیاری بکە نەک گریمانە. پێش جێبەجێکردن پێداچوونەوەی سنوور و تێچووی ئاسایی پێویستە.`;
  }
  return `نفّذ فحصاً شاملاً قائماً على الأدلة للمحاور الخمسة في معروف: ${axes}. افحص الكيان أو الموقع والأدلة العامة المتاحة، واستخدم الأدوات الموجودة ذات الصلة فقط، وسجّل إجابات النماذج العشرة وروابط الاستشهاد الفعلية عندما يكون الفحص المباشر مفعّلاً وموافقاً عليه. أنشئ بطاقة مستقلة لكل محور، وافصل النتائج المقاسة عن البنود التي تعذر قياسها، وقدّم المصادر والخطوات التالية. لا تختلق درجات أو حقائق أو أدلة. إذا كان الكيان أو الموقع المطلوب غير معروف، فاطلبه بدلاً من التخمين. يجب أن يمر التنفيذ بمراجعة النطاق والتكلفة المعتادة قبل البدء.`;
}

export function isFiveAxisAuditGoal(goal: string): boolean {
  const text = String(goal || "");
  return hasAllAxisCodes(text) && /audit|check|inspect|scan|test|measure|evaluate|فحص|تدقيق|افحص|پشکنین|پشکنینی/i.test(text);
}

export function fiveAxisAuditReply(lang: ChatLang): string {
  if (lang === "en") {
    return "I recognized your request to inspect all five axes. The live audit has not run yet. Use the interactive cards below to review the scope, then approve the task and its cost; the same cards will show recorded evidence and clearly mark anything that could not be measured.";
  }
  if (lang === "ku") {
    return "داواکاری پشکنینی هەموو پێنج تەوەرەکەم ناسیکرد. هێشتا پشکنینی ڕاستەوخۆ ئەنجام نەدراوە. لە کارتە کارلێکپێکراوەکانی خوارەوە سنوورەکە بپشکنە، پاشان ئەرک و تێچووی پەسەند بکە؛ هەمان کارتەکان بەڵگەی تۆمارکراو پیشان دەدەن و ئەوەی نەکراوە بپێورێت بەڕوونی دیاری دەکەن.";
  }
  return "فهمت أنك تطلب فحص المحاور الخمسة. لم يبدأ الفحص المباشر بعد. استخدم البطاقات التفاعلية أدناه لمراجعة النطاق، ثم وافق على المهمة وتكلفتها؛ وستعرض البطاقات نفسها الأدلة المسجلة وتوضح صراحةً ما تعذّر قياسه.";
}
