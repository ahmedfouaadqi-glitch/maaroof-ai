import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { inferSkills } from "@/lib/maaroof/skill-inference";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";

type L = "ar" | "en" | "ku";

/** Live skill badges while typing (250ms pause), using the same pure inference as execution. */
export function LiveSkillHints({ text, lang, onPick }: { text: string; lang: L; onPick?: (key: string) => void }) {
  const [hits, setHits] = useState<Array<{ key: string; label: string; why: string }>>([]);
  useEffect(() => {
    const t = setTimeout(() => {
      const r = text.trim().length < 3 ? null : inferSkills(text);
      if (!r || r.kind !== "inferred") return setHits([]);
      setHits(r.skills.map((k) => ({ key: k, label: MAAROOF_SKILLS.find((s) => s.key === k)?.label[lang] || k, why: r.reasons[k] })));
    }, 250);
    return () => clearTimeout(t);
  }, [text, lang]);
  if (!hits.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
      <span className="inline-flex items-center gap-1 text-muted-foreground"><Sparkles className="size-3.5 text-primary" />{lang === "en" ? "Maaroof will likely use:" : lang === "ku" ? "معروف بەکاری دەهێنێت:" : "سيستخدم معروف غالباً:"}</span>
      {hits.map((h) => (
        <button key={h.key} type="button" onClick={() => onPick?.(h.key)} title={h.why}
          className="animate-in fade-in zoom-in-95 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-semibold text-primary transition hover:bg-primary/20 motion-reduce:animate-none">
          {h.label}<span className="ms-1 font-normal text-muted-foreground">«{h.why}»</span>
        </button>
      ))}
    </div>
  );
}
