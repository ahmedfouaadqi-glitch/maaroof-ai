import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ENGINES } from "@/components/engine-logos";

type L = "ar" | "en" | "ku";

// General citation principles (not literal quotes from any model).
const INSIGHTS: Record<L, string[]> = {
  ar: [
    "المصدر الذي يضع الحقيقة الواضحة في أول سطر هو الأقرب للاقتباس.",
    "الكيان المتطابق اسمه وهويته بين الموقع والتواصل يكسب الثقة.",
    "الأرقام والتواريخ القابلة للتحقق تجعل المصدر جديراً بالذكر.",
    "الإجابة المنظمة بسؤال وجواب مباشر تُستخلص أسرع.",
    "البيانات المهيكلة تساعد على فهم من أنت وماذا تقدّم.",
    "الحضور المتكرر في مصادر موثوقة يرسّخ الاسم في الإجابة.",
    "الوضوح يتفوّق على الإطالة عند تلخيص الإجابات.",
    "المحتوى المحدّث يُفضَّل على المعلومات القديمة.",
    "السياق المحلي واللغة الصحيحة يقرّبان العلامة من سائلها.",
    "الاقتباس الموثّق برابط أصلي يرفع موثوقية المصدر.",
  ],
  en: [
    "Sources that state the clear fact in the first line get cited first.",
    "An entity whose name matches across site and social earns trust.",
    "Verifiable numbers and dates make a source worth mentioning.",
    "Structured, direct Q&A answers are extracted faster.",
    "Structured data helps explain who you are and what you offer.",
    "Repeated presence in trusted sources anchors a name in answers.",
    "Clarity beats length when answers are summarized.",
    "Fresh content is preferred over outdated information.",
    "Local context and the right language bring a brand closer to the asker.",
    "A quote backed by an original link raises source credibility.",
  ],
  ku: [
    "سەرچاوەیەک کە ڕاستییەکی ڕوون لە یەکەم دێڕدا دەنووسێت زووتر وەردەگیرێت.",
    "ناوێکی یەکگرتوو لە ماڵپەڕ و تۆڕە کۆمەڵایەتییەکان متمانە دروست دەکات.",
    "ژمارە و بەروارە پشتڕاستکراوەکان سەرچاوە شایەنی ئاماژە دەکەن.",
    "وەڵامی ڕێکخراو بە پرسیار و وەڵامی ڕاستەوخۆ خێراتر دەردەهێنرێت.",
    "داتای ڕێکخراو یارمەتی تێگەیشتن دەدات کە تۆ کێیت.",
    "ئامادەبوونی دووبارە لە سەرچاوە متمانەپێکراوەکان ناو جێگیر دەکات.",
    "ڕوونی لە درێژی باشترە لە کورتکردنەوەی وەڵامەکاندا.",
    "ناوەڕۆکی نوێ لە زانیاری کۆن باشترە.",
    "زمانی دروست و سیاقی ناوخۆیی براند نزیک دەکاتەوە.",
    "وتەیەک بە بەستەری ڕەسەن متمانەی سەرچاوە بەرز دەکاتەوە.",
  ],
};
const LABEL: Record<L, string> = { ar: "من عمق النماذج", en: "From inside the models", ku: "لە ناخی مۆدێلەکانەوە" };

export function ModelInsights({ lang }: { lang: L }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % ENGINES.length), 4000);
    return () => clearInterval(t);
  }, [reduce]);
  const e = ENGINES[i];
  const text = INSIGHTS[lang][i % INSIGHTS[lang].length];
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/50 px-5 py-4 backdrop-blur" aria-live="polite">
      <p className="mb-2 text-xs font-semibold text-primary">{LABEL[lang]}</p>
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} className="flex items-center justify-center gap-3 text-sm md:text-base">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs">
            {e.Logo && <e.Logo size={14} />} {e.name}
          </span>
          <span className="text-muted-foreground">{text}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
