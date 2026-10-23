// Live stage cards (React Bits AnimatedList + SpotlightCard + StarBorder style), driven only by recorded events.
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Brain, ListChecks, Users, Search, Scale, FileCheck2, Timer } from "lucide-react";
import { pipelineCards, taskDuration, formatDuration, councilEngines, stageOf, type StageKey, type StageState, type EngineView } from "@/lib/maaroof/pipeline-cards";
import { ENGINE_KEYS, ENGINE_CATALOG } from "@/lib/ai-engines";
import { ENGINE_LOGOS } from "@/components/engine-logos";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  stopped: ["توقفت قبل الإكمال", "Stopped before completion", "پێش تەواوبوون وەستا"],
};
const idx = (l: L) => (l === "en" ? 1 : l === "ku" ? 2 : 0);

export function LivePipeline({ events, running, lang }: { events: Array<{ type: string; data?: any; at?: number }>; running: boolean; lang: L }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!running) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [running]);
  const cards = pipelineCards(events, running, now);
  const total = taskDuration(events, running, now);
  const i = idx(lang);
  const [open, setOpen] = useState<StageKey | null>(null);
  const [eng, setEng] = useState<string | null>(null);
  const engines = councilEngines(events, ENGINE_KEYS, running);
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
          <motion.li key={c.key} initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: c.state === "waiting" || c.state === "skipped" || c.state === "stopped" ? 0.55 : 1, y: 0, scale: 1 }} transition={{ delay: reduced ? 0 : n * 0.06, duration: 0.35 }}
            className={`rounded-2xl p-px ${active ? "star-border" : ""}`}>
            <button type="button" onClick={() => setOpen(c.key)} className="block h-full w-full rounded-2xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={tr(lang, "عرض التفاصيل", "Show details", "وردەکاری")}>
            <SpotlightCard className={`h-full p-4 ${active ? "bg-card" : ""} ${c.state === "failed" ? "border-destructive/40" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold"><Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />{M.t[i]}</span>
                <PulseBadge state={c.state === "waiting" || c.state === "stopped" ? "skipped" : c.state} label={STATE_LABEL[c.state][i]} />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{M.d[i]}</p>
              {c.key === "evidence" && c.count > 0 && <p className="mt-2 text-xs font-medium tabular-nums">{tr(lang, `${c.count} نتيجة أداة محفوظة`, `${c.count} tool results kept`, `${c.count} ئەنجام`)}</p>}
              {c.reused > 0 && <p className="mt-1 text-xs text-muted-foreground">{tr(lang, `${c.reused} نتيجة مُعاد استخدامها من المحاولة السابقة`, `${c.reused} reused from the earlier attempt`, `${c.reused} دووبارە بەکارهاتەوە`)}</p>}
              {c.failedTools.length > 0 && <p className="mt-1 text-xs font-medium text-destructive">{tr(lang, "لم تكتمل: ", "Not completed: ", "تەواو نەبوو: ")}{c.failedTools.join("، ")}</p>}
              {c.durationMs != null && <p className="mt-2 flex items-center gap-1 text-xs tabular-nums text-muted-foreground"><Timer className="size-3" />{formatDuration(c.durationMs, lang)}</p>}
              {c.key === "council" && <EngineDots engines={engines} />}
              <p className="mt-2 text-[11px] font-medium text-primary">{tr(lang, "اضغط للتفاصيل", "Tap for details", "بۆ وردەکاری کرتە بکە")}</p>
            </SpotlightCard>
            </button>
          </motion.li>
        );
      })}
    </ol>
    <Dialog open={open != null} onOpenChange={(o) => { if (!o) { setOpen(null); setEng(null); } }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {open && <>
          <DialogHeader>
            <DialogTitle>{META[open].t[i]}</DialogTitle>
            <DialogDescription>{META[open].d[i]}</DialogDescription>
          </DialogHeader>
          {open === "council"
            ? <CouncilGrid engines={engines} lang={lang} selected={eng} onSelect={setEng} />
            : <StageDetails stage={open} events={events} lang={lang} />}
        </>}
      </DialogContent>
    </Dialog>
    </div>
  );
}

const ENG_LABEL: Record<EngineView["status"], [string, string, string]> = {
  waiting: ["بانتظار", "Waiting", "چاوەڕێ"], asking: ["يُسأل الآن", "Asking", "پرسیار دەکرێت"],
  answered: ["أجاب", "Answered", "وەڵامی دایەوە"], unresponsive: ["لم يستجب", "No response", "وەڵامی نەدایەوە"],
};
const ENG_DOT: Record<EngineView["status"], string> = { waiting: "bg-muted-foreground/40", asking: "bg-primary animate-pulse", answered: "bg-success", unresponsive: "bg-destructive" };

function EngineDots({ engines }: { engines: EngineView[] }) {
  return <div className="mt-2 flex flex-wrap gap-1">{engines.map((e) => <span key={e.key} title={(ENGINE_CATALOG as any)[e.key]?.name} className={`size-2 rounded-full ${ENG_DOT[e.status]}`} />)}</div>;
}

function CouncilGrid({ engines, lang, selected, onSelect }: { engines: EngineView[]; lang: L; selected: string | null; onSelect: (k: string | null) => void }) {
  const i = idx(lang);
  const sel = engines.find((e) => e.key === selected);
  const answered = engines.filter((e) => e.status === "answered");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{answered.length
        ? tr(lang, `أجاب ${answered.length} من 10، وذكر علامتك ${answered.filter((e) => e.mentioned).length} منها.`, `${answered.length} of 10 answered; ${answered.filter((e) => e.mentioned).length} mentioned your brand.`, `${answered.length} لە 10 وەڵامیان دایەوە.`)
        : tr(lang, "لم تُسجَّل إجابات النماذج بعد في هذه المهمة.", "No model answers recorded in this task yet.", "هێشتا وەڵام تۆمار نەکراوە.")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {engines.map((e) => {
          const Logo = (ENGINE_LOGOS as any)[e.key];
          return (
            <motion.button key={e.key} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => onSelect(e.key === selected ? null : e.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition-colors ${e.key === selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}>
              {Logo ? <Logo className="size-7" /> : null}
              <span className="font-semibold">{(ENGINE_CATALOG as any)[e.key]?.name || e.key}</span>
              <span className="flex items-center gap-1 text-muted-foreground"><span className={`size-1.5 rounded-full ${ENG_DOT[e.status]}`} />{ENG_LABEL[e.status][i]}</span>
            </motion.button>
          );
        })}
      </div>
      {sel && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-semibold">{(ENGINE_CATALOG as any)[sel.key]?.name}</p>
          {sel.status !== "answered"
            ? <p className="text-muted-foreground">{sel.status === "unresponsive" ? tr(lang, "سُئل هذا النموذج لكنه لم يرد ضمن المهلة، فلم يُحتسب.", "This model was asked but did not reply in time, so it was not counted.", "وەڵامی نەدایەوە.") : tr(lang, "لا توجد إجابة مسجّلة لهذا النموذج بعد.", "No recorded answer for this model yet.", "هێشتا وەڵام نییە.")}</p>
            : <>
              <p>{sel.mentioned
                ? tr(lang, `ذكر علامتك${sel.rank ? ` في المرتبة ${sel.rank}` : ""}.`, `Mentioned your brand${sel.rank ? ` at position ${sel.rank}` : ""}.`, `ناوی هێنا${sel.rank ? ` (${sel.rank})` : ""}.`)
                : tr(lang, "لم يذكر علامتك في إجابته.", "Did not mention your brand.", "ناوی نەهێنا.")}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full bg-primary" style={{ width: `${sel.mentioned ? (sel.rank ? Math.max(20, 100 - (sel.rank - 1) * 15) : 60) : 4}%` }} /></div>
              {sel.answer && <blockquote className="border-s-2 border-primary ps-3 text-muted-foreground">«{sel.answer}»</blockquote>}
              {sel.brands.length > 0 && <p className="text-xs text-muted-foreground">{tr(lang, "الأسماء التي اقترحها: ", "Names it suggested: ", "ناوەکان: ")}{sel.brands.join("، ")}</p>}
              {sel.reason && <p className="text-xs text-muted-foreground">{sel.reason}</p>}
              <p className="text-[11px] text-muted-foreground">{tr(lang, "مقاس حي من هذه المهمة", "Measured live in this task", "پێوانەی ڕاستەوخۆ")}</p>
            </>}
        </div>
      )}
    </div>
  );
}

function StageDetails({ stage, events, lang }: { stage: StageKey; events: Array<{ type: string; data?: any }>; lang: L }) {
  const mine = events.filter((e) => stageOf(e) === stage);
  const tools = events.filter((e) => e.type === "tool_result" && e.data?.tool);
  const final = [...events].reverse().find((e) => e.type === "final")?.data?.text as string | undefined;
  const errors = events.filter((e) => e.type === "phase_error" || e.type === "error");
  if (stage === "result") return final
    ? <div className="whitespace-pre-wrap rounded-xl bg-muted/30 p-4 text-sm leading-6">{final.slice(0, 4000)}</div>
    : <p className="text-sm text-muted-foreground">{tr(lang, "لم تُكتب النتيجة بعد.", "The result is not written yet.", "ئەنجام هێشتا نەنووسراوە.")}</p>;
  if (stage === "evidence" || stage === "plan") return tools.length || mine.length
    ? <ul className="space-y-2 text-sm">{(stage === "evidence" ? tools : events.filter((e) => e.type === "tool_call")).map((e, n) => (
        <li key={n} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span>{String(e.data?.tool)}</span>
          {stage === "evidence" && <span className={e.data?.ok === false ? "text-destructive" : "text-success"}>{e.data?.ok === false ? tr(lang, "لم تكتمل", "Not completed", "تەواو نەبوو") : tr(lang, "نجحت", "Succeeded", "سەرکەوتوو")}</span>}
        </li>))}</ul>
    : <p className="text-sm text-muted-foreground">{tr(lang, "لم تُسجَّل خطوات لهذه المرحلة بعد.", "No steps recorded for this stage yet.", "هێشتا هەنگاو نییە.")}</p>;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">{mine.length ? tr(lang, "بدأت هذه المرحلة وسُجّل تقدّمها.", "This stage started and its progress was recorded.", "ئەم قۆناغە دەستی پێکرد.") : tr(lang, "لم تبدأ هذه المرحلة بعد.", "This stage has not started yet.", "هێشتا دەستی پێنەکردووە.")}</p>
      {errors.length > 0 && stage === "understand" && <p className="text-xs text-muted-foreground">{tr(lang, "تأخّر نموذج فاستُخدم بديل أو خطة أساسية، وأكملت المهمة.", "A model was slow, so a backup or basic plan was used and the task continued.", "مۆدێلێکی جێگرەوە بەکارهات.")}</p>}
    </div>
  );
}
