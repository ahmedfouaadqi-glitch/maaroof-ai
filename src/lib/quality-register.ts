// Continuous Quality Register — Prompt 23.
//
// تطوير لا إنشاء: the architectural auditor (`audit.server.ts`) already computes
// live engine/readiness/gap data, and `docs/FULL-SYSTEM-AUDIT.md` holds the
// narrative audit. What was missing is a *register* that tracks each audit
// finding through root cause → fix → verification, in the three languages, and
// renders it next to the live audit instead of living only in a markdown file.

export type L3 = { ar: string; en: string; ku: string };

export type QualityFinding = {
  id: string;
  status: "resolved" | "open" | "accepted";
  severity: "high" | "medium" | "low";
  title: L3;
  /** Root cause — why it happened, not just what broke. */
  cause: L3;
  /** Business / user impact. */
  impact: L3;
  /** What was changed. */
  fix: L3;
  /** How it was verified (real test, not code reading). */
  verification: L3;
};

export const QUALITY_REGISTER: QualityFinding[] = [
  {
    id: "q1-protected-pages-blank",
    status: "resolved",
    severity: "high",
    title: {
      ar: "الصفحات المحمية تظهر بيضاء بلا عنوان أو محتوى",
      en: "Protected pages rendered blank with no heading",
      ku: "پەڕەکانی پارێزراو بەتاڵ دەردەکەوتن",
    },
    cause: {
      ar: "لوحتي والملف الشخصي والإدارة كانت تُعيد مؤشر تحميل فقط قبل إعادة التوجيه، فلا <main> ولا <h1> في الصفحة.",
      en: "Dashboard, profile and admin returned a bare spinner before redirecting, so the document had no <main> and no <h1>.",
      ku: "داشبۆرد و پرۆفایل و بەڕێوەبردن تەنها سپینەر دەگەڕاندەوە، بۆیە <main> و <h1> نەبوو.",
    },
    impact: {
      ar: "المستخدم غير المسجّل يرى شاشة فارغة بلا تفسير، والوصولية والـSEO الداخلي يتأثران.",
      en: "Signed-out visitors saw an unexplained empty screen; accessibility and internal SEO suffered.",
      ku: "بەکارهێنەری نەچووەژوورەوە شاشەیەکی بەتاڵ دەبینی؛ دەستپێگەیشتن و SEO زیان دەبینی.",
    },
    fix: {
      ar: "بوّابة دخول موحّدة (AuthGate) بعنوان <h1> ورسالة وزر تسجيل دخول، وتغليف محتوى الصفحات بـ<main> واحد.",
      en: "Unified AuthGate with an <h1>, an explanation and a sign-in button; page bodies wrapped in a single <main>.",
      ku: "دەرگای یەکخراوی چوونەژوورەوە لەگەڵ <h1> و ڕوونکردنەوە و دوگمە؛ ناوەڕۆک لە <main>ی یەکدا.",
    },
    verification: {
      ar: "مسح فعلي بالمتصفح: /dashboard /profile /admin /maaroof /tools/analyze — كلها h1 واحد وmain واحد ونص مرئي.",
      en: "Real browser sweep: /dashboard /profile /admin /maaroof /tools/analyze — each one h1, one main, visible text.",
      ku: "پشکنینی ڕاستەقینەی وێبگەڕ: هەموویان یەک h1 و یەک main و دەقی بەرچاو.",
    },
  },
  {
    id: "q2-duplicate-main",
    status: "resolved",
    severity: "medium",
    title: {
      ar: "عنصر <main> مكرر في صفحة الأداة",
      en: "Duplicate <main> landmark on the tool page",
      ku: "دووبارەبوونی <main> لە پەڕەی ئامراز",
    },
    cause: {
      ar: "ترويسة الأداة (Hero) استُخدم لها <main> بينما المحتوى الأساسي له <main> آخر.",
      en: "The tool hero used <main> while the actual content had its own <main>.",
      ku: "سەردێری ئامراز <main> بەکارهێنا لەگەڵ ئەوەی ناوەڕۆک <main>ی خۆی هەبوو.",
    },
    impact: {
      ar: "قارئ الشاشة يجد أكثر من منطقة رئيسية فيضيع ترتيب التنقل.",
      en: "Screen readers found more than one main region, breaking landmark navigation.",
      ku: "خوێنەری شاشە زیاتر لە یەک ناوچەی سەرەکی دەدۆزی.",
    },
    fix: {
      ar: "تحويل ترويسة الأداة إلى <header> وإبقاء <main> واحد للمحتوى.",
      en: "Converted the hero to <header>, keeping a single <main> for content.",
      ku: "سەردێر بۆ <header> گۆڕدرا و یەک <main> مایەوە.",
    },
    verification: {
      ar: "المتصفح: /tools/analyze يعرض mains = 1.",
      en: "Browser: /tools/analyze reports mains = 1.",
      ku: "وێبگەڕ: /tools/analyze mains = 1.",
    },
  },
  {
    id: "q3-workspaces-hardcoded-ar",
    status: "resolved",
    severity: "medium",
    title: {
      ar: "نصوص «مساحات العمل» غير مترجمة",
      en: "Workspace switcher strings were untranslated",
      ku: "دەقەکانی شوێنی کار وەرنەگێڕدرابوون",
    },
    cause: {
      ar: "ثلاثة نصوص عربية مثبّتة داخل المكوّن بدل مفاتيح الترجمة.",
      en: "Three Arabic strings were hardcoded in the component instead of i18n keys.",
      ku: "سێ دەقی عەرەبی ڕاستەوخۆ لە کۆمپۆنێنت بوون.",
    },
    impact: {
      ar: "تجربة مختلطة اللغة للمستخدم الإنجليزي والكردي في الشريط الجانبي لمعروف.",
      en: "English and Kurdish users saw mixed-language text in the Maaroof sidebar.",
      ku: "بەکارهێنەری ئینگلیزی و کوردی دەقی تێکەڵ دەبینی.",
    },
    fix: {
      ar: "استبدالها بمفاتيح ترجمة موجودة في اللغات الثلاث.",
      en: "Replaced with existing i18n keys across the three languages.",
      ku: "بە کلیلەکانی وەرگێڕان گۆڕدران.",
    },
    verification: {
      ar: "تدقيق المفاتيح: تطابق كامل بين ar/en/ku بلا مفاتيح ناقصة.",
      en: "Key audit: ar/en/ku fully matched with no missing keys.",
      ku: "پشکنینی کلیل: ar/en/ku تەواو یەکسان.",
    },
  },
  {
    id: "q4-definer-functions",
    status: "accepted",
    severity: "low",
    title: {
      ar: "تحذيرات المدقّق: دوال SECURITY DEFINER وامتداد في public",
      en: "Linter warnings: SECURITY DEFINER functions and an extension in public",
      ku: "ئاگادارکردنەوەی پشکنەر: نەخشەی SECURITY DEFINER",
    },
    cause: {
      ar: "دوال has_role / can_access_space / charge_tokens / ensure_trial_subscription مقصودة وتتحقّق من الملكية داخلياً.",
      en: "has_role / can_access_space / charge_tokens / ensure_trial_subscription are intentional and verify ownership internally.",
      ku: "ئەم نەخشانە بە ئەنقەستن و خاوەندارێتی دەپشکنن.",
    },
    impact: {
      ar: "لا أثر أمني عملي؛ لازمة لسياسات RLS بلا تكرار.",
      en: "No practical security impact; required by RLS policies to avoid recursion.",
      ku: "کاریگەری ئەمنی نییە؛ پێویستە بۆ RLS.",
    },
    fix: {
      ar: "مقبولة بوعي مع تقييد صلاحية التنفيذ على المستخدمين المسجّلين.",
      en: "Knowingly accepted, with EXECUTE limited to authenticated users.",
      ku: "بە زانیاری پەسەندکراوە.",
    },
    verification: {
      ar: "مدقّق قاعدة البيانات: تحذيرات فقط، لا أخطاء حرجة.",
      en: "Database linter: warnings only, no critical errors.",
      ku: "پشکنەری بنکەدراوە: تەنها ئاگادارکردنەوە.",
    },
  },
  {
    id: "q5-engine-data-depth",
    status: "open",
    severity: "low",
    title: {
      ar: "محركات موصولة ببيانات تشغيل قليلة",
      en: "Engines wired but with thin operational data",
      ku: "بزوێنەرەکان بەستراون بەڵام داتای کەم",
    },
    cause: {
      ar: "بعض المحركات (المختبر، المعايير) لم تُشغَّل على حالات واقعية كافية.",
      en: "Some engines (lab, benchmarks) have not run on enough real cases yet.",
      ku: "هەندێ بزوێنەر هێشتا لەسەر حالەتی ڕاستەقینە نەخولاوە.",
    },
    impact: {
      ar: "مؤشر الجاهزية يبقى أقل من سقفه حتى تتراكم الأدلة.",
      en: "The readiness index stays below its ceiling until evidence accumulates.",
      ku: "پێوەری ئامادەیی نزم دەمێنێت.",
    },
    fix: {
      ar: "خارطة الطريق التلقائية في تبويب التدقيق تقترح الحالة التالية لكل محرك خامل.",
      en: "The auto-generated roadmap in the audit tab proposes the next case per idle engine.",
      ku: "ڕێنمای خۆکار پێشنیاری حالەتی داهاتوو دەکات.",
    },
    verification: {
      ar: "تُقاس آلياً عند كل فتح لتبويب التدقيق (عدد السجلات لكل محرك).",
      en: "Measured automatically on every audit-tab load (row count per engine).",
      ku: "بە خۆکاری دەپێورێت لە هەر کردنەوەی تابی پشکنین.",
    },
  },
];

export const qualityCounts = (reg: QualityFinding[] = QUALITY_REGISTER) => ({
  resolved: reg.filter((f) => f.status === "resolved").length,
  open: reg.filter((f) => f.status === "open").length,
  accepted: reg.filter((f) => f.status === "accepted").length,
});
