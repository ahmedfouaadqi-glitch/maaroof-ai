import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Activity, CheckCircle2, ChevronDown, CircleAlert, FileSearch, LoaderCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
import { buildTaskExportPayload, type TaskToolResult } from "@/lib/maaroof/task-export";

export type FiveAxisAuditEvent = { type: string; data: any; at?: number };
export type FiveAxisAuditTaskState = {
  status: "ready" | "running" | "complete" | "failed";
  goal: string;
  events: FiveAxisAuditEvent[];
  finalText?: string;
  error?: string;
};

const AXES = ["SEO", "AEO", "GEO", "SGE", "GSEO"] as const;
type AxisKey = typeof AXES[number];
type Lang = "ar" | "en" | "ku";

const COPY: Record<Lang, {
  title: string; subtitle: string; review: string; prepared: string; running: string; complete: string; failed: string;
  waiting: string; unmeasured: string; evidence: string; details: string; hide: string; show: string;
  noDetails: string; finalAnswer: string; source: string; value: string; runNotice: string; status: string;
  statusLabels: Record<string,string>;
}> = {
  ar: {
    title: "فحص المحاور الخمسة", subtitle: "بطاقات تفاعلية مبنية على الأدلة المسجلة، وليست درجات افتراضية.",
    review: "مراجعة الفحص الكامل", prepared: "أُعدّت مسودة المهمة — راجع النطاق والتكلفة أدناه",
    running: "الفحص جارٍ؛ ستظهر النتائج المسجلة تدريجياً.", complete: "اكتمل التنفيذ؛ تُعرض النتائج والأدلة المحفوظة.", failed: "تعذر إكمال الفحص. راجع تفاصيل المهمة وأعد المحاولة عند الحاجة.",
    waiting: "بانتظار الموافقة", unmeasured: "لم يُقَس بعد", evidence: "المؤشرات والأدلة المسجلة", details: "تفاصيل الأدلة", hide: "إخفاء التفاصيل", show: "عرض التفاصيل",
    noDetails: "لا توجد تفاصيل مسجلة لهذا البند حتى الآن.", finalAnswer: "الخلاصة المسجلة", source: "الحقل", value: "القيمة",
    runNotice: "لا يبدأ الفحص من الرسالة وحدها. راجع الهدف والنطاق والتكلفة ثم اضغط بدء التنفيذ في نموذج المهمة.",
    status: "الحالة", statusLabels: { measured: "توجد بيانات مسجلة", unmeasured: "لا توجد بيانات كافية", running: "جارٍ الفحص", ready: "بانتظار الموافقة", complete: "اكتمل", failed: "تحتاج مراجعة" },
  },
  en: {
    title: "Five-axis audit", subtitle: "Interactive cards built from recorded evidence, not placeholder scores.",
    review: "Review full audit", prepared: "Task draft prepared — review scope and cost below",
    running: "Audit is running; recorded findings will appear as they arrive.", complete: "Execution finished; recorded findings and evidence are shown.", failed: "The audit did not complete. Review the task details before retrying.",
    waiting: "Awaiting approval", unmeasured: "Not measured yet", evidence: "Recorded indicators and evidence", details: "Evidence details", hide: "Hide details", show: "Show details",
    noDetails: "No details have been recorded for this item yet.", finalAnswer: "Recorded summary", source: "Field", value: "Value",
    runNotice: "The audit does not start from the chat message alone. Review the goal, scope and cost, then choose Run in the task form.",
    status: "Status", statusLabels: { measured: "Recorded data available", unmeasured: "Not enough data", running: "Running", ready: "Awaiting approval", complete: "Complete", failed: "Needs review" },
  },
  ku: {
    title: "پشکنینی پێنج تەوەر", subtitle: "کارتە کارلێکپێکراوەکان لە بەڵگە تۆمارکراوەکان دروست دەبن، نەک لە نمرەی خەیاڵی.",
    review: "پێداچوونەوە بە پشکنینی تەواو", prepared: "ڕەشنووسی ئەرک ئامادەیە — سنوور و تێچوو بپشکنە",
    running: "پشکنین بەردەوامە؛ دۆزینەوە تۆمارکراوەکان بە هێواشی دەردەکەون.", complete: "جێبەجێکردن تەواو بوو؛ ئەنجام و بەڵگە تۆمارکراوەکان پیشان دەدرێن.", failed: "پشکنین تەواو نەبوو؛ وردەکاری ئەرک بپشکنە.",
    waiting: "چاوەڕێی پەسەندکردن", unmeasured: "هێشتا پێوانە نەکراوە", evidence: "پێوەر و بەڵگە تۆمارکراوەکان", details: "وردەکاری بەڵگە", hide: "شاردنەوەی وردەکاری", show: "پیشاندانی وردەکاری",
    noDetails: "هێشتا هیچ وردەکارییەک بۆ ئەم بەشە تۆمار نەکراوە.", finalAnswer: "پوختەی تۆمارکراو", source: "خانە", value: "بەها",
    runNotice: "پشکنین تەنها بە ناردنی پەیام دەست پێناکات. ئامانج و سنوور و تێچوو بپشکنە، پاشان لە فۆڕمی ئەرکدا جێبەجێکردن پەسەند بکە.",
    status: "دۆخ", statusLabels: { measured: "داتای تۆمارکراو هەیە", unmeasured: "داتا بەس نییە", running: "پشکنین بەردەوامە", ready: "چاوەڕێی پەسەندکردن", complete: "تەواو بوو", failed: "پێویستی بە پێداچوونەوە هەیە" },
  },
};

const AXIS_LABELS: Record<AxisKey, Record<Lang, string>> = {
  SEO: { ar: "SEO · الجاهزية التقنية", en: "SEO · Technical readiness", ku: "SEO · ئامادەیی تەکنیکی" },
  AEO: { ar: "AEO · جاهزية الإجابة والهوية", en: "AEO · Answer and entity readiness", ku: "AEO · ئامادەیی وەڵام و ناسنامە" },
  GEO: { ar: "GEO · الحضور في إجابات النماذج", en: "GEO · Presence in model answers", ku: "GEO · دەرکەوتن لە وەڵامی مۆدێلەکان" },
  SGE: { ar: "SGE · البحث التوليدي والبيانات المنظمة", en: "SGE · Generative search and structured data", ku: "SGE · گەڕانی زایەندراو و داتای ڕێکخراو" },
  GSEO: { ar: "GSEO · التحسين التوليدي الشامل", en: "GSEO · End-to-end generative optimization", ku: "GSEO · باشکردنی گشتگیری بۆ گەڕانی زایەندراو" },
};

function axisForHeading(heading: string): AxisKey | null {
  const normalized = String(heading || "").toUpperCase();
  return AXES.find((axis) => new RegExp("(?:^|[^A-Z])" + axis + "(?:$|[^A-Z])").test(normalized)) || null;
}

function printable(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function derivePayload(state?: FiveAxisAuditTaskState, lang: Lang = "ar") {
  const events = state?.events || [];
  const results: TaskToolResult[] = events
    .filter((event) => event.type === "tool_result")
    .map((event) => ({
      tool: String(event.data?.tool || "unknown"),
      ok: event.data?.ok !== false,
      output: event.data?.output ?? null,
    }));
  const finalEvent = [...events].reverse().find((event) => event.type === "final");
  const finalText = state?.finalText || String(finalEvent?.data?.text || finalEvent?.data?.message || "");
  return buildTaskExportPayload({
    title: state?.goal || COPY[lang].title,
    goal: state?.goal || "",
    finalText,
    results,
    lang,
  });
}

export function FiveAxisAuditCards({
  lang,
  onReviewAndRun,
  taskState,
}: {
  lang: Lang;
  onReviewAndRun: () => void;
  taskState?: FiveAxisAuditTaskState;
}) {
  const copy = COPY[lang];
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState<string[]>([]);
  const payload = useMemo(() => derivePayload(taskState, lang), [taskState?.events, taskState?.finalText, taskState?.goal, lang]);
  const sections = payload.sections.filter((section) => axisForHeading(section.heading));
  const byAxis = new Map<AxisKey, typeof sections[number]>();
  for (const section of sections) {
    const axis = axisForHeading(section.heading);
    if (axis) byAxis.set(axis, section);
  }
  const detailSections = payload.sections.filter((section) =>
    section.kind === "table" && /(model|engine|source|citation|النماذج|المصادر|وەڵام|سەرچاوە|نموذج)/i.test(section.heading)
  );
  const statusFor = (axis: AxisKey, section: typeof sections[number] | undefined) => {
    if (taskState?.status === "running") return "running";
    if (taskState?.status === "ready") return "ready";
    if (taskState?.status === "failed") return "failed";
    const rows = section?.rows || [];
    const noEvidence = (value: unknown) => /not measured|no available|no measurable|no reliable|no actual|no long-form|no model answers|no answers|no entity|not recorded|لم تُسجّل|لا توجد بيانات|لم يُعثر|لا يتوفر|لا توجد إجابات|نەپێوراو|بەردەست نییە|نەدۆزرایەوە|هیچ ئەنجامێک|هیچ وەڵام|تۆمار نەکراوە|ناوی قەوارەی متمانەپێکراو/i.test(String(value ?? ""));
    const statusRow = rows.find((row) => /status|حالة|دۆخ|نتيجة الأدلة|result/i.test(String(row[0] ?? "")));
    if (statusRow && noEvidence(statusRow[1]) && taskState?.status === "complete") return "unmeasured";
    const hasEvidence = !!section && (
      rows.some((row) => {
        const label = String(row[0] ?? "");
        const raw = row[1];
        const val = String(raw ?? "").trim();
        if (!val || (typeof raw === "number" && Number(raw) === 0) || (/count|number of fields|الحقول|عدد|ژمارە/i.test(label) && Number(raw) === 0)) return false;
        if (/not deployed|does not prove|لا يثبت|بڵاوکراوەتەوە|ڕەتکردنەوە/i.test(label)) return false;
        return !noEvidence(val);
      }) || !!section.text?.trim() || !!section.table?.data?.length
    );
    if (taskState?.status === "complete") return hasEvidence ? "measured" : "unmeasured";
    return "ready";
  };

  const statusLabel = (status: string) => copy.statusLabels[status] || copy.unmeasured;
  const statusIcon = (status: string) => status === "running" ? <LoaderCircle className="size-3.5 animate-spin" />
    : status === "measured" || status === "complete" ? <CheckCircle2 className="size-3.5" />
      : status === "failed" ? <CircleAlert className="size-3.5" /> : <Activity className="size-3.5" />;

  const onMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  };

  return (
    <section className="mt-4 space-y-3" aria-label={copy.title} data-testid="five-axis-audit-cards" lang={lang}>
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold">{copy.title}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-border/80 bg-background/75 px-3 py-2 text-xs leading-5 text-muted-foreground">{copy.runNotice}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {taskState && <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold">
            {statusIcon(taskState.status)}
            {taskState.status === "ready" ? copy.prepared : taskState.status === "running" ? copy.running : taskState.status === "complete" ? copy.complete : copy.failed}
          </span>}
          <button
            type="button"
            onClick={onReviewAndRun}
            disabled={taskState?.status === "running" || taskState?.status === "ready" || taskState?.status === "complete"}
            className="ms-auto inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition duration-200 hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSearch className="size-3.5" />
            {taskState?.status === "ready" ? copy.prepared : copy.review}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {AXES.map((axis, index) => {
          const section = byAxis.get(axis);
          const status = statusFor(axis, section);
          const rows = section?.rows || [];
          const isExpanded = expanded.includes(axis);
          const shownRows = isExpanded ? rows : rows.slice(0, 3);
          return (
            <motion.article
              key={axis}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: reduceMotion ? 0 : index * 0.035 }}
              whileHover={reduceMotion ? undefined : { y: -2, scale: 1.005 }}
              onMouseMove={onMouseMove}
              className="group relative min-w-0 overflow-hidden rounded-2xl border border-primary/15 bg-card p-4 shadow-sm transition-colors duration-200 hover:border-primary/35 hover:shadow-md"
              style={{ backgroundImage: "radial-gradient(360px circle at var(--pointer-x, 50%) var(--pointer-y, 0px), color-mix(in srgb, hsl(var(--primary)) 10%, transparent), transparent 68%)" }}
              dir="auto"
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 via-primary/30 to-transparent" />
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  {axis === "SEO" ? <Search className="size-4" /> : axis === "AEO" ? <ShieldCheck className="size-4" /> : axis === "GEO" ? <Sparkles className="size-4" /> : axis === "SGE" ? <FileSearch className="size-4" /> : <Activity className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold leading-5">{AXIS_LABELS[axis][lang]}</h4>
                  <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                    {statusIcon(status)}
                    <span>{statusLabel(status)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {!section && <p className="text-xs leading-5 text-muted-foreground">{taskState?.status === "running" ? copy.running : copy.waiting}</p>}
                {shownRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="rounded-lg border border-border/70 bg-background/60 px-2.5 py-2">
                    <p className="text-[10px] font-semibold leading-4 text-muted-foreground">{printable(row[0])}</p>
                    <p className="mt-0.5 break-words text-xs leading-5 text-foreground" dir="auto">{printable(row[1])}</p>
                  </div>
                ))}
                {section?.text && <p className="text-xs leading-5 text-muted-foreground">{section.text}</p>}
                {section?.table && <p className="text-xs text-muted-foreground">{section.table.data.length} {lang === "en" ? "recorded table rows" : lang === "ku" ? "ڕیزی خشتەی تۆمارکراو" : "صفوف جدول مسجلة"}</p>}
              </div>
              {rows.length > 3 && (
                <button type="button" onClick={() => setExpanded((current) => current.includes(axis) ? current.filter((item) => item !== axis) : [...current, axis])} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline" aria-expanded={isExpanded}>
                  <ChevronDown className={`size-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  {isExpanded ? copy.hide : copy.show}
                </button>
              )}
              {section && rows.length === 0 && !section.text && !section.table && <p className="mt-3 text-xs text-muted-foreground">{copy.unmeasured}</p>}
            </motion.article>
          );
        })}
      </div>

      {detailSections.map((section, index) => {
        const key = "detail-" + index;
        const open = expanded.includes(key);
        return (
          <section key={key} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button type="button" aria-expanded={open} onClick={() => setExpanded((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition hover:bg-muted/35">
              <span className="text-sm font-semibold">{section.heading}</span>
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">{section.table?.data.length || 0}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></span>
            </button>
            {open && section.table && (
              <div className="max-w-full overflow-x-auto border-t border-border">
                <table className="w-full min-w-[520px] border-collapse text-start text-xs">
                  <thead className="bg-muted/60"><tr>{section.table.columns.map((column, i) => <th key={i} scope="col" className="border-b border-border px-3 py-2 font-semibold">{column}</th>)}</tr></thead>
                  <tbody>{section.table.data.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border/70 last:border-0 hover:bg-muted/25">{section.table!.columns.map((_, columnIndex) => <td key={columnIndex} className="max-w-[320px] whitespace-pre-wrap break-words px-3 py-2 align-top" dir="auto">{printable(row[columnIndex])}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {open && !section.table && <p className="px-4 py-3 text-xs text-muted-foreground">{copy.noDetails}</p>}
          </section>
        );
      })}

      {taskState?.status === "failed" && taskState.error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{taskState.error}</p>}
      {taskState?.status === "complete" && taskState.finalText && (
        <details className="rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold">{copy.finalAnswer}</summary>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-foreground/90" dir="auto">{taskState.finalText}</p>
        </details>
      )}
    </section>
  );
}
