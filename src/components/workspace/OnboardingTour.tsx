import { useEffect, useState } from "react";
import { Compass, X } from "lucide-react";

type L = "ar" | "en" | "ku";
const KEY = "ws-tour-done-v2";

const STEPS: Record<L, Array<[string, string]>> = {
  ar: [
    ["اكتب هدفك", "مثال: «هل يذكر ChatGPT متجري للورد في بغداد؟». معروف يفهم الهدف ويقترح المهارات."],
    ["اختر المهارة", "كل مهارة تشرح هدفها ومصادرها وكلفتها قبل التشغيل. يمكنك تركها تلقائية."],
    ["النماذج العشرة", "يسأل معروف عشرة نماذج ذكاء اصطناعي افتراضياً، ويمكنك تقليلها من «اختيار النماذج»."],
    ["الكلفة والرصيد", "ترى الكلفة المتوقعة مقابل رصيدك قبل البدء، ولا يُخصم شيء إلا عند النجاح."],
    ["النطاق وطريقة العمل", "بجانب زر «ابدأ المهمة» تختار البلد والمدينة وطريقة العمل (تنفيذ، توصية، محاكاة)."],
    ["المقابلة والموافقات", "في «المقابلة» يتعرّف معروف على حسابك، وتجد فيها الموافقات على الإجراءات قبل تنفيذها."],
    ["الإضافات", "قنوات النشر والجدولة والمهام المجدولة في «الإضافات». ويمكنك كتابة «كل أسبوع…» في هدفك ليقترح معروف جدولة."],
    ["مساحة المعرفة", "ما يتعلمه معروف من مهامك ومقابلتك يظهر هنا مع مصدره، ويمكنك اعتماد الحقائق المؤكدة للبث."],
  ],
  en: [
    ["Write your goal", "Example: “Does ChatGPT mention my Baghdad flower shop?”. Maaroof understands it and suggests skills."],
    ["Pick a skill", "Each skill shows its goal, sources and cost before running. You can leave it automatic."],
    ["Ten models", "Maaroof asks ten AI models by default; you can reduce them in “Models”."],
    ["Cost and balance", "You see the expected cost against your balance first; nothing is charged unless it succeeds."],
    ["Scope and mode", "Next to “Start task” pick country/city and the mode (execute, recommend, simulate)."],
    ["Interview and approvals", "The Interview tab lets Maaroof learn your account and holds approvals before any action runs."],
    ["Add-ons", "Publishing channels, scheduling and scheduled tasks live under “Add-ons”. Write “every week…” to get a schedule proposal."],
    ["Knowledge space", "What Maaroof learns appears here with its source; you can approve verified facts for broadcast."],
  ],
  ku: [
    ["ئامانجەکەت بنووسە", "نموونە: «ئایا ChatGPT باسی دوکانەکەم دەکات؟»."],
    ["تواناییەک هەڵبژێرە", "هەر توانایەک ئامانج و تێچووەکەی پیشان دەدات."],
    ["دە مۆدێل", "معروف بە شێوەی بنەڕەت دە مۆدێل دەپرسێت."],
    ["تێچوو و باڵانس", "هیچ ناکێشرێت تەنها لە کاتی سەرکەوتن."],
    ["بوار و شێواز", "لە تەنیشت دوگمەی دەستپێکردن وڵات و شێواز هەڵبژێرە."],
    ["چاوپێکەوتن و ڕەزامەندی", "ڕەزامەندییەکان لە چاوپێکەوتندان."],
    ["زیادکراوەکان", "کەناڵ و خشتە لە «زیادکراوەکان»دان."],
    ["شوێنی زانیاری", "ئەوەی معروف فێری دەبێت لێرە دەردەکەوێت."],
  ],
};

/** Short first-visit tour; skippable and re-openable. State kept locally. */
export function OnboardingTour({ lang }: { lang: L }) {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => { try { if (!localStorage.getItem(KEY)) setStep(0); } catch {} }, []);
  const done = () => { try { localStorage.setItem(KEY, "1"); } catch {} setStep(null); };
  const steps = STEPS[lang] || STEPS.ar;
  const t = (ar: string, en: string, ku: string) => (lang === "en" ? en : lang === "ku" ? ku : ar);

  if (step === null) return (
    <button onClick={() => setStep(0)} className="fixed bottom-4 start-4 z-30 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs shadow-md [@media(max-height:760px)]:bottom-2 [@media(max-height:760px)]:px-2 [@media(max-height:760px)]:py-1" aria-label="tour">
      <Compass className="size-4 text-primary" />{t("جولة تعريفية", "Quick tour", "گەشت")}
    </button>
  );
  const [title, body] = steps[step];
  // Non-modal card: no page overlay, kept small and in a corner on short/narrow screens
  // so it never covers the goal field or the start button.
  return (
    <div className="pointer-events-auto fixed bottom-4 start-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-primary/30 bg-card p-4 shadow-xl [@media(max-height:760px)]:top-2 [@media(max-height:760px)]:bottom-auto [@media(max-height:760px)]:w-[min(17rem,calc(100vw-1rem))] [@media(max-height:760px)]:p-3" role="dialog" aria-modal="false">
      <button onClick={done} className="absolute end-3 top-3 text-muted-foreground" aria-label="close"><X className="size-4" /></button>
      <p className="text-xs text-muted-foreground">{step + 1} / {steps.length}</p>
      <h3 className="mt-1 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground [@media(max-height:760px)]:line-clamp-3">{body}</p>
      <div className="mt-4 flex justify-between gap-2">
        <button onClick={done} className="text-xs text-muted-foreground">{t("تخطَّ", "Skip", "تێپەڕاندن")}</button>
        <div className="flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-lg border border-border px-3 py-1.5 text-sm">{t("السابق", "Back", "پێشوو")}</button>}
          <button onClick={() => (step + 1 < steps.length ? setStep(step + 1) : done())} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">{step + 1 < steps.length ? t("التالي", "Next", "دواتر") : t("ابدأ", "Start", "دەستپێبکە")}</button>
        </div>
      </div>
    </div>
  );
}
