import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MAAROOF_SKILLS, skillFramework } from "@/lib/maaroof/skill-catalog";

type L = "ar" | "en" | "ku";

const PARTS: { k: "goal" | "sources" | "plan" | "cost" | "evidence" | "output" | "nextStep"; label: Record<L, string> }[] = [
  { k: "goal", label: { ar: "الهدف", en: "Goal", ku: "ئامانج" } },
  { k: "sources", label: { ar: "المصادر", en: "Sources", ku: "سەرچاوەکان" } },
  { k: "plan", label: { ar: "الخطة", en: "Plan", ku: "پلان" } },
  { k: "cost", label: { ar: "الكلفة", en: "Cost", ku: "تێچوو" } },
  { k: "evidence", label: { ar: "الأدلة", en: "Evidence", ku: "بەڵگە" } },
  { k: "output", label: { ar: "النتيجة", en: "Output", ku: "ئەنجام" } },
  { k: "nextStep", label: { ar: "الخطوة التالية", en: "Next step", ku: "هەنگاوی داهاتوو" } },
];

const EXAMPLE: Record<L, (name: string) => string> = {
  ar: (n) => `مثال: متجر «ورد بغداد» يختار «${n}»، فيعرض معروف الكلفة أولاً، ثم ينفّذ بعد موافقته ويعطيه النتيجة مع الأدلة والخطوة التالية.`,
  en: (n) => `Example: a flower shop picks "${n}". Maaroof Ai shows the cost first, runs it after approval, then returns the result with evidence and a next step.`,
  ku: (n) => `نموونە: فرۆشگایەکی گوڵ «${n}» هەڵدەبژێرێت؛ سەرەتا تێچوو پیشان دەدرێت، دوای ڕەزامەندی جێبەجێ دەکرێت و ئەنجام لەگەڵ بەڵگە دەدرێتەوە.`,
};

export function SkillDetailsDialog({ skillKey, l, onClose }: { skillKey: string | null; l: L; onClose: () => void }) {
  const skill = MAAROOF_SKILLS.find((s) => s.key === skillKey);
  const f = skill ? skillFramework(skill, l) : null;
  return (
    <Dialog open={!!skill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir={l === "en" ? "ltr" : "rtl"} className="max-h-[85vh] overflow-y-auto">
        {skill && f && (
          <>
            <DialogHeader>
              <DialogTitle>{skill.label[l]}</DialogTitle>
              <DialogDescription>{skill.description[l]}</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-2 text-sm">
              {PARTS.map((p) => (
                <div key={p.k} className="rounded-lg border border-border p-2">
                  <dt className="text-xs font-semibold text-primary">{p.label[l]}</dt>
                  <dd className="mt-0.5 text-muted-foreground">{f[p.k]}</dd>
                </div>
              ))}
            </dl>
            <p className="rounded-lg bg-muted p-3 text-xs">{EXAMPLE[l](skill.label[l])}</p>
            <Link to="/workspace" search={{ skill: skill.key }} className="inline-flex justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              {l === "en" ? "Try it in Maaroof Space" : l === "ku" ? "تاقیکردنەوە لە شوێنی معروف" : "جرّبها في مساحة معروف"}
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
