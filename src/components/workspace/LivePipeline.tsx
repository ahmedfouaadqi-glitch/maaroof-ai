// Live stage cards (React Bits AnimatedList + SpotlightCard + StarBorder style), driven only by recorded events.
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Brain, ListChecks, Users, Search, Scale, FileCheck2, Timer } from "lucide-react";
import { pipelineCards, taskDuration, formatDuration, type StageKey, type StageState } from "@/lib/maaroof/pipeline-cards";
import { PulseBadge, SpotlightCard } from "@/components/motion/effects";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

const META: Record<StageKey, { icon: typeof Brain; t: [string, string, string]; d: [string, string, string] }> = {
  understand: { icon: Brain, t: ["فهم الطلب", "Understanding", "تێگەیشتن"], d: ["يقرأ معروف هدفك ومعرفتك السابقة ليحدد المطلوب.", "Maaroof reads your goal and prior knowledge.", "معروف ئامانجەکەت دەخوێنێتەوە."] },
  plan: { icon: ListChecks, t: ["الخطة والكلفة", "Plan & cost", "پلان و تێچوو"], d: ["يختار الأدوات والخطوات ضمن رصيدك وسياسة خطتك.", "Picks tools and steps within your balance and plan.", "ئامراز و هەنگاوەکان هەڵدەبژێرێت."] },
  council: { icon: Users, t: ["مجلس النماذج العشرة", "Ten-model council", "ئەنجومەنی دە مۆدێل"], d: ["تُسأل النماذج عن علامتك وتُقارن إجاباتها.", "The engines are asked about your brand and compared.", "مۆدێلەکان پرسیاریان لێدەکرێت."] },
  evidence: { icon: Search, t: ["جمع الأدلة", "Gathering evidence", "کۆکردنەوەی بەڵگە"], d: ["تُشغَّل الأدوات وتُحفظ نتائجها كأدلة.", "Tools run and their outputs are kept as evidence.", "ئامرازەکان کاردەکەن."] },
  conflict: { icon: Scale, t: ["حل التعارض", "Resolving conflicts", "چارەسەری ناکۆکی"], d: ["حين تختلف النماذج يُرجَّح الأقوى دليلاً.", "When engines disagree, the best-evidenced wins.", "کاتی ناکۆکی بەهێزترین بەڵگە."] },
  result: { icon: FileCheck2, t: ["النتيجة", "Result", "ئەنجام"], d: ["يكتب معروف الخلاصة ويميّز الدليل عن الفرضية.", "Maaroof writes the summary, separating evidence from hypothesis.", "کورتە دەنووسرێت."] },
};
const STATE_LABEL: Record<StageState, [string, string, string]> = {
  waiting: ["بانتظار دوره", "Waiting", "چاوەڕێ"], running: ["يعمل الآن", "Running", "کاردەکات"], done: ["اكتمل", "Done", "تەواو"],
  skipped: ["تخطّى (غير مطلوب)", "Skipped (not needed)", "تێپەڕێندرا"], failed: ["تعذّر", "Failed", "سەرکەوتوو نەبوو"],
};
const idx = (l: L) => (l === "en" ? 1 : l === "ku" ? 2 : 0);

export function LivePipeline({ events, running, lang }: { events: Array<{ type: string; data?: any; at?: number }>; running: boolean; lang: L }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!running) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [running]);
  const cards = pipelineCards(events, running, now);
  const total = taskDuration(events, running, now);
  const i = idx(lang);
  const clock = (t: number) => new Date(t).toLocaleTimeString(lang === "en" ? "en-GB" : "ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-muted/40 px-4 py-2 text-xs">
      <span className="flex items-center gap-1.5 font-semibold"><Timer className="size-3.5 text-primary" />{tr(lang, "المدة الكلية", "Total time", "کۆی کات")}: <span className="tabular-nums">{total ? formatDuration(total.durationMs, lang) : tr(lang, "يبدأ الآن…", "starting…", "دەستپێدەکات…")}</span></span>
      {total && <span className="text-muted-foreground tabular-nums">{tr(lang, "البدء", "Started", "دەستپێک")}: {clock(total.startedAt)}</span>}
      {total?.endedAt != null && <span className="text-muted-foreground tabular-nums">{tr(lang, "الانتهاء", "Ended", "کۆتایی")}: {clock(total.endedAt)}</span>}
    </div>
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
      {cards.map((c, n) => {
        const M = META[c.key]; const Icon = M.icon;
        const active = c.state === "running";
        return (
          <motion.li key={c.key} initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: c.state === "waiting" || c.state === "skipped" ? 0.55 : 1, y: 0, scale: 1 }} transition={{ delay: reduced ? 0 : n * 0.06, duration: 0.35 }}
            className={`rounded-2xl p-px ${active ? "star-border" : ""}`}>
            <SpotlightCard className={`h-full p-4 ${active ? "bg-card" : ""} ${c.state === "failed" ? "border-destructive/40" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold"><Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />{M.t[i]}</span>
                <PulseBadge state={c.state === "waiting" ? "skipped" : c.state} label={STATE_LABEL[c.state][i]} />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{M.d[i]}</p>
              {c.key === "evidence" && c.count > 0 && <p className="mt-2 text-xs font-medium tabular-nums">{tr(lang, `${c.count} نتيجة أداة محفوظة`, `${c.count} tool results kept`, `${c.count} ئەنجام`)}</p>}
              {c.durationMs != null && <p className="mt-2 flex items-center gap-1 text-xs tabular-nums text-muted-foreground"><Timer className="size-3" />{formatDuration(c.durationMs, lang)}</p>}
            </SpotlightCard>
          </motion.li>
        );
      })}
    </ol>
    </div>
  );
}
