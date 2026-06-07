import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { TOOL_CATALOG, type ToolKey, toolLabel } from "@/lib/tool-catalog";
import { ChevronDown, ArrowRight, FileInput, Sparkles, Cpu, CheckCircle2 } from "lucide-react";

/**
 * Textual "How it works" walkthrough for each tool — no videos, no mock data.
 * Three steps (input → engine → output) + a realistic textual example.
 * Auto-localized via useI18n.
 */
type StepSpec = {
  inputAr: string; inputEn: string; inputKu: string;
  engineAr: string; engineEn: string; engineKu: string;
  outputAr: string; outputEn: string; outputKu: string;
  exampleAr: string; exampleEn: string; exampleKu: string;
};

const GUIDES: Partial<Record<ToolKey, StepSpec>> = {
  analyze: {
    inputAr: "ألصق فقرة من موقعك أو مقالك (20+ كلمة).",
    inputEn: "Paste a paragraph from your site (20+ words).",
    inputKu: "دەقێک لە ماڵپەڕەکەت بنووسە (٢٠+ وشە).",
    engineAr: "نقيّمها كما يقيّمها 9 محركات (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi).",
    engineEn: "We score it the way 9 engines would (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi).",
    engineKu: "بە ٩ ماشێن نمرە دەدرێت.",
    outputAr: "نقاط من 100 + نقاط قوة وضعف + توصيات تطبيقية + كلمات مفتاحية مرصودة فعلياً.",
    outputEn: "Score out of 100 + strengths/weaknesses + actionable tips + entities actually present.",
    outputKu: "نمرە لە سەد + خاڵە بەهێز/لاوازەکان + پێشنیار.",
    exampleAr: "مدخل: \"مطعم بغداد للكباب في الكرادة منذ 1998…\" → مخرج: Score 72 · authority 80 · local 90 · citation 55 · توصية: \"أضف رقم هاتف وساعات العمل ليُذكر في إجابات Gemini\".",
    exampleEn: "Input: \"Baghdad Kebab in Karrada since 1998…\" → Output: Score 72 · authority 80 · local 90 · citation 55 · tip: \"Add phone + hours so Gemini can quote them\".",
    exampleKu: "نموونە: نمرە ٧٢ · پێشنیار: ژمارەی پەیوەندی زیاد بکە.",
  },
  visibility: {
    inputAr: "اختر استعلامات حقيقية يبحث فيها جمهورك (مثلاً \"أفضل مطعم كباب في بغداد\").",
    inputEn: "Pick real queries your audience asks (e.g. \"best kebab restaurant in Baghdad\").",
    inputKu: "پرسیارە ڕاستەقینەکان هەڵبژێرە.",
    engineAr: "نسأل المحركات الـ9 (مع Kimi) ونرصد إن كانت تذكرك أم لا.",
    engineEn: "We query all 9 engines (Kimi included) and record whether you appear.",
    engineKu: "هەموو ٩ ماشێنەکە دەپرسرێن.",
    outputAr: "GEO Trust Score من 100 + جدول ظهور لكل محرك + خطة رفع الظهور.",
    outputEn: "GEO Trust Score / 100 + per-engine visibility table + uplift plan.",
    outputKu: "GEO Trust Score + پلانی بەرزکردنەوە.",
    exampleAr: "نتيجة لمطعم: ChatGPT يذكره، Gemini لا، Kimi جزئياً → التوصية: نشر صفحة \"مطعم كباب في الكرادة\" بمحتوى Q&A.",
    exampleEn: "Result for a restaurant: ChatGPT cites, Gemini doesn't, Kimi partial → publish a Q&A page about Karrada kebab.",
    exampleKu: "نموونە: ChatGPT دەناسێت، Gemini نا → پێشنیار: پەڕەی Q&A زیاد بکە.",
  },
  competitor_monitor: {
    inputAr: "أضف نطاقات منافسيك ومدى رصدها (يومي/أسبوعي).",
    inputEn: "Add competitor domains and a watch frequency.",
    inputKu: "دۆمەینی ڕکابەرەکانت زیاد بکە.",
    engineAr: "نراقب التغييرات في الظهور والاستراتيجيات في 9 محركات ونرسل تنبيهات.",
    engineEn: "We watch visibility/strategy shifts across 9 engines and email alerts.",
    engineKu: "گۆڕانکارییەکان چاودێری دەکرێن.",
    outputAr: "بريد + إشعار داخلي عند كل تغيير مهم (ارتفاع/انخفاض/كلمات جديدة).",
    outputEn: "Email + in-app alert on every meaningful change.",
    outputKu: "ئیمەیڵ و ئاگاداری.",
    exampleAr: "تنبيه: \"منافسك X ارتفع 18 نقطة في GEO Trust خلال أسبوع — نشر 6 مقالات Q&A\".",
    exampleEn: "Alert: \"Competitor X jumped 18 GEO Trust points this week — published 6 Q&A articles\".",
    exampleKu: "ئاگاداری: \"ڕکابەر X ١٨ نمرە زیاتر بوو\".",
  },
  what_if: {
    inputAr: "اختر التغيير المُقترح (إضافة Q&A، تحسين بنية، حملة محتوى، ربط مصادر…).",
    inputEn: "Pick a proposed change (add Q&A, structure, content campaign, citations…).",
    inputKu: "گۆڕانێک هەڵبژێرە.",
    engineAr: "نشغّل محاكاة بنفس نموذج GEO Trust Score (9 محركات) قبل/بعد.",
    engineEn: "We simulate before/after with the same GEO Trust Score model (9 engines).",
    engineKu: "سیمولاتۆر قبل و دوای.",
    outputAr: "مخطط قبل/بعد + شرح لكل عامل تأثير + احتمال نجاح مقدّر.",
    outputEn: "Before/after chart + per-factor explanation + estimated success probability.",
    outputKu: "خشتە قبل/دوای + لێکدانەوە.",
    exampleAr: "محاكاة: إضافة 10 صفحات Q&A → +14 GEO Trust + رفع ظهور في Perplexity وKimi بنسبة 22%.",
    exampleEn: "Simulation: +10 Q&A pages → +14 GEO Trust + 22% visibility lift in Perplexity & Kimi.",
    exampleKu: "نموونە: +١٠ پەڕەی Q&A → +١٤ نمرە.",
  },
  brand_boost: {
    inputAr: "أدخل اسم العلامة، التخصص، السوق المستهدف، وروابط القنوات.",
    inputEn: "Enter brand name, niche, target market, channel links.",
    inputKu: "ناوی براند، بازار و کەناڵەکان.",
    engineAr: "الوكيل المستقل يولّد محتوى وحزم سلطة وحملات نشر مجدولة.",
    engineEn: "Autonomous agent generates content, authority packs, and scheduled campaigns.",
    engineKu: "وەکیلی ئۆتۆماتیک پلان دەکات.",
    outputAr: "خطة 30 يوم + جدول نشر + قياس أسبوعي للتقدّم في GEO Trust.",
    outputEn: "30-day plan + publishing schedule + weekly GEO Trust tracking.",
    outputKu: "پلانی ٣٠ ڕۆژ.",
    exampleAr: "خطة لمستشفى: 12 منشور تعليمي + 4 حزم سلطة + 3 حملات بريدية، النتيجة المتوقعة +21 GEO Trust خلال شهر.",
    exampleEn: "Hospital plan: 12 educational posts + 4 authority packs + 3 email campaigns, expected +21 GEO Trust in 30d.",
    exampleKu: "نموونە: پلان بۆ نەخۆشخانە.",
  },
};

export function HowItWorks({ toolKey }: { toolKey: ToolKey }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const L = (lang === "en" || lang === "ku") ? lang : "ar";
  const g = GUIDES[toolKey];
  if (!g) return null;
  const labels = {
    ar: { howTitle: "كيف تعمل هذه الأداة", step1: "ما تُدخله", step2: "ما يحدث داخلياً", step3: "ما تحصل عليه", example: "مثال واقعي" },
    en: { howTitle: "How this tool works", step1: "What you input", step2: "What happens", step3: "What you get", example: "Real example" },
    ku: { howTitle: "چۆن کار دەکات", step1: "ئەوەی تۆ دەنووسیت", step2: "ئەوەی ڕوودەدات", step3: "ئەوەی وەردەگریت", example: "نموونەی ڕاستەقینە" },
  }[L];

  const stepText = (k: "input" | "engine" | "output") => {
    const map = { input: { ar: g.inputAr, en: g.inputEn, ku: g.inputKu }, engine: { ar: g.engineAr, en: g.engineEn, ku: g.engineKu }, output: { ar: g.outputAr, en: g.outputEn, ku: g.outputKu } };
    return map[k][L];
  };
  const example = { ar: g.exampleAr, en: g.exampleEn, ku: g.exampleKu }[L];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-card"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          {labels.howTitle} — {toolLabel(toolKey, L)}
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <Step icon={<FileInput className="size-4" />} title={labels.step1} body={stepText("input")} />
            <Step icon={<Cpu className="size-4" />} title={labels.step2} body={stepText("engine")} />
            <Step icon={<CheckCircle2 className="size-4" />} title={labels.step3} body={stepText("output")} />
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
            <div className="mb-1 flex items-center gap-1 font-semibold text-primary"><ArrowRight className="size-3" /> {labels.example}</div>
            <div className="text-muted-foreground">{example}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">{icon}{title}</div>
      <div className="text-xs leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}

/** Compact tool tooltip — small inline definition + "open guide" affordance. */
export function ToolHint({ toolKey }: { toolKey: ToolKey }) {
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku") ? lang : "ar";
  const g = GUIDES[toolKey];
  if (!g) return null;
  const text = { ar: g.inputAr, en: g.inputEn, ku: g.inputKu }[L];
  return <span className="text-[11px] text-muted-foreground">{text}</span>;
}
