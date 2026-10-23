// Live stage cards (React Bits AnimatedList + SpotlightCard + StarBorder style), driven only by recorded events.
import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { Brain, ListChecks, Users, Search, Scale, FileCheck2, Timer, ExternalLink } from "lucide-react";
import { pipelineCards, taskDuration, formatDuration, councilEngines, stageTimeline, latestNarration, type StageKey, type StageState, type EngineView, type TimelineItem } from "@/lib/maaroof/pipeline-cards";
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
    <NarrationTicker events={events} running={running} lang={lang} />
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
            ? <div className="space-y-5">
                <CouncilGrid engines={engines} lang={lang} selected={eng} onSelect={setEng} />
                <div><p className="mb-2 text-sm font-semibold">{tr(lang, "ما حدث في مراجعة الخبراء", "What happened in the expert review", "پێداچوونەوەی پسپۆڕان")}</p><StageDetails stage="council" events={events} lang={lang} /></div>
              </div>
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
  const reduced = useReducedMotion();
  const answered = engines.filter((e) => e.status === "answered").length;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-wrap gap-1">{engines.map((e, n) => (
        <motion.span key={e.key} title={(ENGINE_CATALOG as any)[e.key]?.name}
          animate={reduced ? undefined : e.status === "answered" ? { scale: [1, 1.6, 1] } : undefined}
          transition={{ duration: 0.5, delay: n * 0.05 }}
          className={`size-2 rounded-full ${ENG_DOT[e.status]}`} />
      ))}</div>
      {answered > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">{answered}/10</span>}
    </div>
  );
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
        <motion.div key={sel.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="flex items-center justify-between font-semibold">
            <span>{(ENGINE_CATALOG as any)[sel.key]?.name}</span>
            {sel.ms != null && <span className="text-xs font-normal tabular-nums text-muted-foreground">{formatDuration(sel.ms, lang)}</span>}
          </p>
          {sel.status !== "answered"
            ? <p className="text-muted-foreground">{sel.status === "unresponsive"
                ? (sel.miss === "timeout" ? tr(lang, "سُئل هذا النموذج لكنه لم يرد خلال 30 ثانية، فلم يُحتسب ولم يُخصم عنه.", "Asked, but no reply within 30 seconds — not counted or charged.", "لە 30 چرکەدا وەڵامی نەدایەوە.")
                  : sel.miss === "error" ? tr(lang, "سُئل هذا النموذج لكن الطلب تعذّر حتى بعد محاولة ثانية، فلم يُحتسب ولم يُخصم عنه.", "Asked, but the request failed even after a second try — not counted or charged.", "داواکاری سەرکەوتوو نەبوو.")
                  : tr(lang, "سُئل هذا النموذج لكنه أعاد رداً فارغاً حتى بعد محاولة ثانية، فلم يُحتسب ولم يُخصم عنه.", "Asked, but it returned an empty reply even after a second try — not counted or charged.", "وەڵامی بەتاڵ بوو."))
                : sel.status === "asking" ? tr(lang, "يُسأل الآن… ستظهر إجابته هنا فور وصولها.", "Being asked now… its answer appears here as soon as it arrives.", "ئێستا پرسیاری لێدەکرێت…")
                : tr(lang, "لم يُسأل هذا النموذج بعد في هذه المهمة.", "This model has not been asked in this task yet.", "هێشتا پرسیاری لێنەکراوە.")}</p>
            : <>
              <p>{sel.mentioned
                ? tr(lang, `ذكر علامتك${sel.rank ? ` في المرتبة ${sel.rank}` : ""}.`, `Mentioned your brand${sel.rank ? ` at position ${sel.rank}` : ""}.`, `ناوی هێنا${sel.rank ? ` (${sel.rank})` : ""}.`)
                : tr(lang, "لم يذكر علامتك في إجابته.", "Did not mention your brand.", "ناوی نەهێنا.")}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden><motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${sel.mentioned ? (sel.rank ? Math.max(20, 100 - (sel.rank - 1) * 15) : 60) : 4}%` }} transition={{ duration: 0.6 }} /></div>
              {sel.answer && <blockquote className="border-s-2 border-primary ps-3 text-muted-foreground">«{sel.answer}»</blockquote>}
              {sel.brands.length > 0 && <p className="text-xs text-muted-foreground">{tr(lang, "الأسماء التي اقترحها: ", "Names it suggested: ", "ناوەکان: ")}{sel.brands.join("، ")}</p>}
              {sel.reason && <p className="text-xs text-muted-foreground">{sel.reason}</p>}
              {sel.sources.length > 0
                ? <div><p className="text-xs font-medium">{tr(lang, "مصادر حقيقية مرتبطة بإجابته:", "Real sources linked to its answer:", "سەرچاوە ڕاستەقینەکان:")}</p><LinkList links={sel.sources} /></div>
                : <p className="text-xs text-muted-foreground">{tr(lang, "لم يستند إلى رابط من نتائج البحث الحية.", "It did not rely on a link from the live search results.", "بەستەری نەبوو.")}</p>}
              <p className="text-[11px] text-muted-foreground">{tr(lang, "مقاس حي من هذه المهمة", "Measured live in this task", "پێوانەی ڕاستەوخۆ")}</p>
            </>}
        </motion.div>
      )}
    </div>
  );
}

function LinkList({ links }: { links: { url: string; title: string }[] }) {
  if (!links.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {links.map((s) => (
        <li key={s.url} className="flex items-center gap-1.5 text-xs">
          <ExternalLink className="size-3 shrink-0 text-primary" />
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary underline-offset-2 hover:underline">{s.title || s.url}</a>
        </li>
      ))}
    </ul>
  );
}

const KIND_DOT: Record<TimelineItem["kind"], string> = { say: "bg-primary", step: "bg-primary/60", done: "bg-success", fail: "bg-destructive", info: "bg-muted-foreground/50" };

function StageDetails({ stage, events, lang }: { stage: StageKey; events: Array<{ type: string; data?: any; at?: number }>; lang: L }) {
  const reduced = useReducedMotion();
  const items = stageTimeline(events, stage, lang);
  if (!items.length) return <p className="text-sm text-muted-foreground">{tr(lang, "لم تبدأ هذه المرحلة بعد، أو لم يُسجَّل لها شيء حتى الآن.", "This stage has not started or has nothing recorded yet.", "هێشتا هیچ تۆمار نەکراوە.")}</p>;
  const clock = (t: number) => new Date(t).toLocaleTimeString(lang === "en" ? "en-GB" : "ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <ol className="relative space-y-3 border-s border-border ps-4">
      {items.map((it, n) => (
        <motion.li key={n} initial={reduced ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : Math.min(n * 0.04, 0.6) }} className="relative">
          <span className={`absolute -start-[21px] top-1.5 size-2.5 rounded-full ${KIND_DOT[it.kind]}`} />
          {it.at != null && <span className="text-[11px] tabular-nums text-muted-foreground">{clock(it.at)}</span>}
          <p className={`whitespace-pre-wrap text-sm leading-6 ${it.kind === "say" ? "font-medium" : ""} ${it.kind === "fail" ? "text-destructive" : ""}`}>{it.text}</p>
          <LinkList links={it.links} />
        </motion.li>
      ))}
    </ol>
  );
}

function NarrationTicker({ events, running, lang }: { events: Array<{ type: string; data?: any }>; running: boolean; lang: L }) {
  const text = latestNarration(events);
  const reduced = useReducedMotion();
  if (!text) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm" aria-live="polite">
      <span className={`size-2 shrink-0 rounded-full bg-primary ${running && !reduced ? "animate-pulse" : ""}`} />
      <span className="sr-only">{tr(lang, "معروف يقول:", "Maaroof says:", "معروف دەڵێت:")}</span>
      <AnimatePresence mode="wait">
        <motion.span key={text} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>{text}</motion.span>
      </AnimatePresence>
    </div>
  );
}
