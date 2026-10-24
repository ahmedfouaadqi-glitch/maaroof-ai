// Pure: short, plain-language lines Maaroof says while working. Built only from real event data.
type L = "ar" | "en" | "ku";

const TOOL_NAMES: Record<string, Record<L, string>> = {
  visibility: { ar: "فحص الظهور لدى النماذج العشرة", en: "the ten-model visibility check", ku: "پشکنینی دەرکەوتن لە دە مۆدێل" },
  known: { ar: "البحث عمّن يعرفه الذكاء الاصطناعي في سوقك", en: "finding who AI knows in your market", ku: "دۆزینەوەی ئەوانەی AI دەیانناسێت" },
  compare: { ar: "مقارنة المنافسين", en: "competitor comparison", ku: "بەراوردی ڕکابەران" },
  analyze: { ar: "تحليل الموقع", en: "site analysis", ku: "شیکاری ماڵپەڕ" },
  research: { ar: "البحث المعمّق", en: "deep research", ku: "توێژینەوەی قووڵ" },
  brand_authority: { ar: "بطاقة سلطة العلامة", en: "the brand authority card", ku: "کارتی دەسەڵاتی براند" },
};

export function toolLabel(tool: string, lang: L = "ar"): string {
  return TOOL_NAMES[tool]?.[lang] || tool;
}

export function narrateToolStart(tool: string, lang: L = "ar", engines = 0): string {
  const name = toolLabel(tool, lang);
  if (tool === "visibility" && engines) {
    return lang === "en" ? `Asking ${engines} AI models right now, in parallel…` : lang === "ku" ? `ئێستا پرسیار لە ${engines} مۆدێل دەکەم…` : `أسأل الآن ${engines} نماذج ذكاء اصطناعي بالتوازي…`;
  }
  return lang === "en" ? `Running ${name}…` : lang === "ku" ? `${name} دەستی پێکرد…` : `أبدأ ${name}…`;
}

export function narrateToolDone(tool: string, ok: boolean, output: any, lang: L = "ar"): string {
  const name = toolLabel(tool, lang);
  if (!ok) return lang === "en" ? `${name} did not finish — I'll continue with what I have.` : lang === "ku" ? `${name} تەواو نەبوو — بەردەوام دەبم.` : `لم يكتمل ${name} — سأكمل بما توفر.`;
  const probe = output?.probe;
  if (tool === "visibility" && probe && Array.isArray(probe.asked)) {
    const answered = Array.isArray(probe.answers) ? probe.answers.length : 0;
    const mentioned = Array.isArray(probe.answers) ? probe.answers.filter((a: any) => a?.mentioned).length : 0;
    const links = Array.isArray(probe.evidence) ? probe.evidence.length : 0;
    return lang === "en"
      ? `${answered} of ${probe.asked.length} models answered; ${mentioned} mentioned your brand${links ? `; ${links} real sources linked` : ""}.`
      : lang === "ku"
        ? `${answered} لە ${probe.asked.length} مۆدێل وەڵامیان دایەوە؛ ${mentioned} ناوی براندەکەیان هێنا${links ? `؛ ${links} سەرچاوەی ڕاستەقینە` : ""}.`
        : `أجاب ${answered} من ${probe.asked.length} نماذج، وذكر ${mentioned} منها علامتك${links ? `، وربطتُ ${links} مصادر حقيقية` : ""}.`;
  }
  const src = Array.isArray(output?.sources) ? output.sources.length : 0;
  return lang === "en" ? `${name} finished${src ? ` with ${src} sources` : ""}.` : lang === "ku" ? `${name} تەواو بوو${src ? ` بە ${src} سەرچاوە` : ""}.` : `انتهى ${name}${src ? ` ووجدتُ ${src} مصادر` : ""}.`;
}

export function narratePhase(phase: string, lang: L = "ar"): string | null {
  const m: Record<string, Record<L, string>> = {
    envision: { ar: "أفهم هدفك وأقرأ ملفك ومعرفتك…", en: "Understanding your goal and reading your profile and knowledge…", ku: "ئامانجەکەت تێدەگەم…" },
    planning: { ar: "أختار الأدوات المناسبة وأحسب الكلفة…", en: "Choosing the right tools and estimating cost…", ku: "ئامرازە گونجاوەکان هەڵدەبژێرم…" },
    council: { ar: "أعرض الخطة على الخبراء لمراجعتها…", en: "Having experts review the plan…", ku: "پلانەکە بۆ پسپۆڕان دەنێرم…" },
    conflict: { ar: "أوازن بين الآراء المختلفة…", en: "Weighing differing opinions…", ku: "بیرۆکە جیاوازەکان هەڵدەسەنگێنم…" },
    summarizing: { ar: "أكتب النتيجة من الأدلة التي جمعتها…", en: "Writing the result from the evidence gathered…", ku: "ئەنجامەکە دەنووسم…" },
  };
  return m[phase]?.[lang] || null;
}
