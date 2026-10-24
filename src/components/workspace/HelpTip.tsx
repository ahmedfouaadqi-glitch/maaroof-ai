import { useState } from "react";
import { HelpCircle } from "lucide-react";

type L = "ar" | "en" | "ku";
type Tip = { text: string; example: string };

/** Short explanation + simple example for each workspace card, in three languages. */
export const HELP: Record<string, Record<L, Tip>> = {
  geo: {
    ar: { text: "حدد أين تريد أن يقيس معروف ظهورك.", example: "مثال: العراق ← أربيل، ليرى ما يجيب به ChatGPT لمن يسأل من أربيل." },
    en: { text: "Choose where Maaroof measures your visibility.", example: "Example: Iraq → Erbil, to see what ChatGPT answers people asking from Erbil." },
    ku: { text: "دیاری بکە معروف لە کوێ دەرکەوتنت بپێوێت.", example: "نموونە: عێراق ← هەولێر." },
  },
  mode: {
    ar: { text: "التنفيذ يشغّل الأدوات، التوصية تقترح فقط، المحاكاة تتوقع الأثر.", example: "مثال: اختر «توصية» لتعرف ما يجب فعله دون تشغيل فحص كامل." },
    en: { text: "Execute runs tools, Recommend only advises, Simulate predicts impact.", example: "Example: pick Recommend to learn what to do without a full scan." },
    ku: { text: "جێبەجێکردن ئامرازەکان کار پێدەکات، پێشنیار تەنها ڕاوێژ دەدات.", example: "نموونە: «پێشنیار» هەڵبژێرە." },
  },
  cost: {
    ar: { text: "الكلفة التقديرية مقابل رصيدك. لا يُخصم شيء إلا بعد نجاح المهمة.", example: "مثال: مهمة «متوسطة» بـ 40 توكن ورصيدك 500 — يبقى 460 بعد النجاح." },
    en: { text: "Estimated cost against your balance. Nothing is charged unless the task succeeds.", example: "Example: a Medium task of 40 tokens with 500 balance leaves 460 after success." },
    ku: { text: "تێچووی خەمڵێنراو بەرامبەر باڵانست. تەنها دوای سەرکەوتن دەبڕدرێت.", example: "نموونە: ٤٠ تۆکن لە ٥٠٠." },
  },
  skills: {
    ar: { text: "المهارات حزم أدوات جاهزة يقترحها معروف حسب هدفك.", example: "مثال: «إصلاح الاقتباس» تحوّل فجواتك إلى تعديلات محتوى قابلة للموافقة." },
    en: { text: "Skills are ready tool bundles Maaroof suggests from your goal.", example: "Example: Citation Fix turns gaps into approvable content edits." },
    ku: { text: "تواناکان کۆمەڵە ئامرازی ئامادەن.", example: "نموونە: چاکردنی ئاماژە." },
  },
  files: {
    ar: { text: "كل الملفات والصور التي رفعتها وما استخلصه معروف منها.", example: "مثال: افتح ملف تعريف شركتك لترى التحليل أو احذفه." },
    en: { text: "All files and images you uploaded and what Maaroof extracted.", example: "Example: open your company profile PDF to view or delete its analysis." },
    ku: { text: "هەموو فایلە بارکراوەکانت.", example: "نموونە: فایلەکەت بکەرەوە." },
  },
};

export function HelpTip({ id, lang }: { id: keyof typeof HELP; lang: L }) {
  const [open, setOpen] = useState(false);
  const t = HELP[id][lang];
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label={lang === "en" ? "Help" : lang === "ku" ? "یارمەتی" : "شرح"} aria-expanded={open} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)} className="text-muted-foreground hover:text-primary">
        <HelpCircle className="size-4" />
      </button>
      {open && (
        <span role="tooltip" className="absolute top-6 z-30 w-64 rounded-xl border border-border bg-popover p-3 text-start text-xs font-normal leading-5 text-popover-foreground shadow-lg ltr:left-0 rtl:right-0">
          <span className="block">{t.text}</span>
          <span className="mt-1 block text-muted-foreground">{t.example}</span>
        </span>
      )}
    </span>
  );
}
