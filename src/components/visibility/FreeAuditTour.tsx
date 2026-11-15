import { useEffect, useState } from "react";
import { Compass, X } from "lucide-react";

type L = "ar" | "en" | "ku";
const KEY = "free-audit-tour-done-v1";

const STEPS: Record<L, Array<[string, string]>> = {
  ar: [
    ["اكتب الاسم", "اكتب اسم العلامة أو الشخص كما يعرفه الناس."],
    ["التخصص", "أضف الفئة (اختياري) لنسأل النماذج دون ذكر اسمك ونرى هل تقترحك."],
    ["النطاق الجغرافي", "اختر العالم أو دولة أو مدينة. اختياري، والافتراضي عالمي."],
    ["لغة التقرير", "التقرير يصدر بلغة الواجهة فقط. غيّر اللغة من الأعلى قبل الفحص."],
    ["ثلاثة نماذج حقيقية", "نسأل ثلاثة نماذج ذكاء اصطناعي مستقلة مباشرة، دون تقدير."],
    ["استرجاع التقرير", "يبقى التقرير 72 ساعة، ويمكنك استرجاعه بعد تحديث الصفحة متى شئت."],
  ],
  en: [
    ["Enter the name", "Type the brand or person name the way people know it."],
    ["Category", "Add a category (optional) so we ask models without your name and see if they suggest you."],
    ["Geographic scope", "Pick worldwide, a country or a city. Optional; worldwide by default."],
    ["Report language", "The report comes only in the page language. Switch language at the top before running."],
    ["Three real models", "We ask three independent AI models live — no estimates."],
    ["Retrieve the report", "The report stays for 72 hours; retrieve it any time after refreshing."],
  ],
  ku: [
    ["ناو بنووسە", "ناوی براند یان کەس بنووسە وەک خەڵک دەیناسن."],
    ["پسپۆڕی", "پۆلێک زیاد بکە (ئارەزوومەندانە) بۆ ئەوەی بزانین مۆدێلەکان پێشنیارت دەکەن."],
    ["بواری جوگرافی", "جیهان، وڵات یان شار هەڵبژێرە. ئارەزوومەندانەیە؛ بنەڕەت جیهانییە."],
    ["زمانی ڕاپۆرت", "ڕاپۆرت تەنها بە زمانی پەڕەکە دەردەچێت. پێش پشکنین زمان لە سەرەوە بگۆڕە."],
    ["سێ مۆدێلی ڕاستەقینە", "ڕاستەوخۆ سێ مۆدێلی سەربەخۆ دەپرسین، بەبێ خەمڵاندن."],
    ["وەرگرتنەوەی ڕاپۆرت", "ڕاپۆرت 72 کاتژمێر دەمێنێت و دوای نوێکردنەوە دەتوانیت وەریبگریتەوە."],
  ],
};

/** First-visit tour for the free audit; skippable and re-openable, stored locally. */
export function FreeAuditTour({ lang }: { lang: L }) {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => { try { if (!localStorage.getItem(KEY)) setStep(0); } catch { /* ignore */ } }, []);
  const done = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setStep(null); };
  const steps = STEPS[lang] || STEPS.en;
  const t = (ar: string, en: string, ku: string) => (lang === "ar" ? ar : lang === "ku" ? ku : en);

  if (step === null) return (
    <button type="button" onClick={() => setStep(0)} className="fixed bottom-4 start-4 z-30 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs shadow-md">
      <Compass className="size-4 text-primary" />{t("جولة تعريفية", "Quick tour", "گەشتی ناساندن")}
    </button>
  );
  const [title, body] = steps[step];
  return (
    <div role="dialog" aria-modal="false" className="fixed bottom-4 start-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-primary/30 bg-card p-4 shadow-xl">
      <button type="button" onClick={done} className="absolute end-3 top-3 text-muted-foreground" aria-label="close"><X className="size-4" /></button>
      <p className="text-xs text-muted-foreground">{step + 1} / {steps.length}</p>
      <h3 className="mt-1 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>
      <div className="mt-3 flex justify-between gap-2">
        <button type="button" onClick={done} className="text-xs text-muted-foreground">{t("تخطي", "Skip", "تێپەڕاندن")}</button>
        <div className="flex gap-2">
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-border px-3 py-1 text-xs">{t("السابق", "Back", "پێشوو")}</button>}
          <button type="button" onClick={() => (step + 1 < steps.length ? setStep(step + 1) : done())} className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            {step + 1 < steps.length ? t("التالي", "Next", "دواتر") : t("إنهاء", "Done", "تەواو")}
          </button>
        </div>
      </div>
    </div>
  );
}
