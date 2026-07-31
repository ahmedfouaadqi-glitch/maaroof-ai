// Part 18 — Executive Task Center + Live Monitor.
// Presentation only: every number comes from the Part 18 server functions,
// and the vocabulary comes from the shared @/lib/hermes-commands source of truth.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw, FileText, Activity, ChevronDown, ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";
import {
  getHermesTasks, getHermesTask, createHermesTask, updateHermesTask,
  logHermesTaskEvent, buildHermesTaskReport,
} from "@/lib/maaroof-state-hermes.functions";
import {
  TASK_STATUSES, STATUS_LABELS_AR, TASK_CATEGORIES, RISK_LEVELS,
  EXECUTION_MODES, EXECUTION_MODE_LABELS_AR,
} from "@/lib/hermes-commands";
import { exportToPDF, exportToJSON, exportToMarkdown, exportToWord, exportToPowerPoint, type ExportPayload } from "@/lib/exports";

const money = (n: any) => `$${Number(n || 0).toFixed(4)}`;
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs";

function reportPayload(task: any, report: any): ExportPayload {
  return {
    title: `تقرير تنفيذي — ${task.title}`,
    subtitle: `هرمس · ${STATUS_LABELS_AR[task.status] || task.status}`,
    lang: "ar",
    sections: [
      { heading: "الملخص التنفيذي", kind: "text", text: report.executive_summary },
      { heading: "التقرير التفصيلي", kind: "text", text: report.detailed_report },
      {
        heading: "الأثر", kind: "kv", rows: [
          ["الأثر المعماري", report.architecture_impact],
          ["الأثر التجاري", report.business_impact],
          ["أثر المعرفة", report.knowledge_impact],
          ["أثر الثقة", report.trust_impact],
          ["الأداء", report.performance_impact],
          ["الإيراد", report.revenue_impact],
        ],
      },
      {
        heading: "تحليل الكلفة", kind: "kv", rows: [
          ["المصروف", money(report.cost_analysis.spent_usd)],
          ["الميزانية", report.cost_analysis.budget_usd ? money(report.cost_analysis.budget_usd) : "غير محددة"],
          ["المتبقي", report.cost_analysis.remaining_usd == null ? "—" : money(report.cost_analysis.remaining_usd)],
          ["التوكن المصروف", report.cost_analysis.spent_tokens],
        ],
      },
      { heading: "التوصيات", kind: "list", list: report.recommendations || [] },
      { heading: "الخطوات التالية", kind: "list", list: report.next_actions || [] },
    ],
  };
}

export function HermesTaskCenter() {
  const { t } = useI18n();
  const loadAll = useServerFn(getHermesTasks);
  const loadOne = useServerFn(getHermesTask);
  const create = useServerFn(createHermesTask);
  const update = useServerFn(updateHermesTask);
  const logEvent = useServerFn(logHermesTaskEvent);
  const report = useServerFn(buildHermesTaskReport);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [monitor, setMonitor] = useState<any>(null);
  const [filter, setFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [note, setNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({
    title: "", description: "", category: "general", priority: 3, risk_level: "low",
    execution_mode: "manual", approval_level: "founder", cost_budget_usd: "", token_budget: "",
    deadline: "", business_goal: "", expected_output: "", expert_assignment: "", required_models: "",
    required_mcp: "", required_tools: "", languages: "ar",
  });

  const refresh = async (status?: string) => {
    try {
      const r: any = await loadAll({ data: { status: status ?? filter ?? null } });
      setTasks(r.tasks || []);
      setMonitor(r.monitor || null);
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [filter]);

  const openTask = async (id: string) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null);
    try { setDetail(await loadOne({ data: { task_id: id } })); }
    catch (e: any) { toast.error(String(e?.message || e)); }
  };

  const submit = async () => {
    if (form.title.trim().length < 2) { toast.error(t("auto.address_is_required")); return; }
    setBusy("create");
    try {
      await create({
        data: {
          title: form.title.trim(),
          description: form.description || null,
          category: form.category,
          priority: Number(form.priority) || 3,
          risk_level: form.risk_level,
          execution_mode: form.execution_mode,
          approval_level: form.approval_level,
          business_goal: form.business_goal || null,
          expected_output: form.expected_output || null,
          cost_budget_usd: form.cost_budget_usd ? Number(form.cost_budget_usd) : null,
          token_budget: form.token_budget ? Number(form.token_budget) : null,
          deadline: form.deadline || null,
          expert_assignment: list(form.expert_assignment),
          required_models: list(form.required_models),
          required_mcp: list(form.required_mcp),
          required_tools: list(form.required_tools),
          languages: list(form.languages).filter((l) => ["ar", "en", "ku"].includes(l)) as any,
        },
      });
      toast.success(t("auto.executive_task_created"));
      setShowForm(false);
      setForm({ ...form, title: "", description: "" });
      await refresh();
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    try {
      await update({ data: { task_id: id, patch: { status } } });
      await refresh();
      if (openId === id) setDetail(await loadOne({ data: { task_id: id } }));
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const addNote = async (id: string) => {
    if (!note.trim()) return;
    setBusy(id);
    try {
      await logEvent({ data: { task_id: id, kind: "discussion", summary: note.trim() } });
      setNote("");
      setDetail(await loadOne({ data: { task_id: id } }));
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const makeReport = async (task: any) => {
    setBusy(task.id);
    try {
      const r: any = await report({ data: { task_id: task.id } });
      setDetail(await loadOne({ data: { task_id: task.id } }));
      toast.success(t("auto.executive_report_ready"));
      return r;
    } catch (e: any) { toast.error(String(e?.message || e)); return null; }
    finally { setBusy(null); }
  };

  const exportReport = async (task: any, fmt: "pdf" | "json" | "md" | "doc" | "pptx") => {
    const r = task.result && Object.keys(task.result).length ? task.result : await makeReport(task);
    if (!r) return;
    const payload = reportPayload(task, r);
    if (fmt === "pdf") exportToPDF(payload);
    else if (fmt === "json") exportToJSON(payload);
    else if (fmt === "md") exportToMarkdown(payload);
    else if (fmt === "doc") exportToWord(payload);
    else await exportToPowerPoint(payload);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("auto.loading")}</div>;

  const upcoming = tasks
    .filter((t) => t.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Live monitor */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t("auto.active_tasks"), monitor?.tasks?.length ?? 0, `${monitor?.runningRuns ?? 0} تشغيل جارٍ`],
          [t("auto.runs_24_hours"), monitor?.runs24h ?? 0, `${monitor?.tokens24h ?? 0} توكن`],
          [t("auto.real_cost_24h"), money(monitor?.realUsd24h), `محصّل ${money(monitor?.chargedUsd24h)}`],
          [t("auto.learning_budget_24h"), money(monitor?.learningUsd24h), `${monitor?.knowledgeUpdates24h ?? 0} تحديث معرفي`],
        ].map(([l, v, h]: any) => (
          <div key={l} className="rounded-xl border border-border/60 bg-card/60 p-3">
            <div className="text-[11px] text-muted-foreground">{l}</div>
            <div className="text-lg font-semibold">{v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{h}</div>
          </div>
        ))}
      </div>

      {(monitor?.activeExperts?.length || monitor?.activeModels?.length || monitor?.activeMcp?.length) ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-3 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-semibold"><Activity className="size-3.5" /> المراقب الحي</div>
          {monitor.activeExperts?.length ? <div className="text-muted-foreground">خبراء: {monitor.activeExperts.join("، ")}</div> : null}
          {monitor.activeModels?.length ? <div className="text-muted-foreground">نماذج: {monitor.activeModels.join("، ")}</div> : null}
          {monitor.activeMcp?.length ? <div className="text-muted-foreground">MCP: {monitor.activeMcp.join("، ")}</div> : null}
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">{t("auto.all_cases")}</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS_AR[s]}</option>)}
        </select>
        <button onClick={() => void refresh()} className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40">
          <RefreshCw className="size-3.5" /> {t("auto.update")}
        </button>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 rounded-lg bg-primary/15 text-primary px-2.5 py-1.5 text-xs">
          <Plus className="size-3.5" /> مهمة تنفيذية جديدة
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-3 grid gap-2 md:grid-cols-2">
          <Field label={t("auto.title")}><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label={t("auto.commercial_goal")}><input className={inputCls} value={form.business_goal} onChange={(e) => setForm({ ...form, business_goal: e.target.value })} /></Field>
          <Field label={t("auto.description")}>
            <textarea rows={3} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label={t("auto.expected_output")}>
            <textarea rows={3} className={inputCls} value={form.expected_output} onChange={(e) => setForm({ ...form, expected_output: e.target.value })} />
          </Field>
          <Field label={t("auto.classification")}>
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t("auto.priority_1_highest")}>
            <input type="number" min={1} max={5} className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          </Field>
          <Field label={t("auto.risk_level")}>
            <select className={inputCls} value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={t("auto.execution_style")}>
            <select className={inputCls} value={form.execution_mode} onChange={(e) => setForm({ ...form, execution_mode: e.target.value })}>
              {EXECUTION_MODES.map((m) => <option key={m} value={m}>{EXECUTION_MODE_LABELS_AR[m]}</option>)}
            </select>
          </Field>
          <Field label={t("auto.cost_budget")}><input className={inputCls} value={form.cost_budget_usd} onChange={(e) => setForm({ ...form, cost_budget_usd: e.target.value })} /></Field>
          <Field label={t("auto.token_budget")}><input className={inputCls} value={form.token_budget} onChange={(e) => setForm({ ...form, token_budget: e.target.value })} /></Field>
          <Field label={t("auto.deadline")}><input type="datetime-local" className={inputCls} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
          <Field label={t("auto.languages_ar_en_ku")}><input className={inputCls} value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} /></Field>
          <Field label={t("auto.experts_comma_separated")}><input className={inputCls} value={form.expert_assignment} onChange={(e) => setForm({ ...form, expert_assignment: e.target.value })} /></Field>
          <Field label={t("auto.required_models")}><input className={inputCls} value={form.required_models} onChange={(e) => setForm({ ...form, required_models: e.target.value })} /></Field>
          <Field label={t("auto.required_mcp")}><input className={inputCls} value={form.required_mcp} onChange={(e) => setForm({ ...form, required_mcp: e.target.value })} /></Field>
          <Field label={t("auto.required_tools")}><input className={inputCls} value={form.required_tools} onChange={(e) => setForm({ ...form, required_tools: e.target.value })} /></Field>
          <div className="md:col-span-2 flex justify-end">
            <button onClick={() => void submit()} disabled={busy === "create"} className="flex items-center gap-1.5 rounded-lg bg-primary/15 text-primary px-3 py-1.5 text-xs">
              {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إنشاء
            </button>
          </div>
        </div>
      )}

      {/* Executive calendar */}
      {upcoming.length ? (
        <div className="rounded-2xl border border-border/60 bg-card/40">
          <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold">{t("auto.executive_calendar")}</div>
          <div className="divide-y divide-border/40">
            {upcoming.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]">
                <span className="font-medium truncate">{t.title}</span>
                <span className="text-muted-foreground">{new Date(t.deadline).toLocaleString()}</span>
                <span className="rounded-full bg-muted px-2 py-0.5">{STATUS_LABELS_AR[t.status] || t.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-border/60 p-6 text-center text-xs text-muted-foreground">
          لا مهام تنفيذية بعد. أنشئ أول مهمة ليتابعها هرمس من التحضير حتى التقرير.
        </div>
      ) : tasks.map((t) => (
        <div key={t.id} className="rounded-2xl border border-border/60 bg-card/50">
          <button onClick={() => void openTask(t.id)} className="w-full flex flex-wrap items-center justify-between gap-2 p-3 text-start">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{t.title}</div>
              <div className="text-[10px] text-muted-foreground">
                {t.category} · أولوية {t.priority} · مخاطرة {t.risk_level} · {EXECUTION_MODE_LABELS_AR[t.execution_mode] || t.execution_mode}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="rounded-full bg-muted px-2 py-0.5">{STATUS_LABELS_AR[t.status] || t.status}</span>
              <span className="text-muted-foreground">{t.progress || 0}% · {money(t.spent_usd)}</span>
              {openId === t.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </div>
          </button>

          {openId === t.id && (
            <div className="border-t border-border/60 p-3 space-y-3">
              {t.description ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.description}</p> : null}

              <div className="flex flex-wrap items-center gap-1.5">
                {TASK_STATUSES.map((s) => (
                  <button key={s} disabled={busy === t.id || s === t.status} onClick={() => void setStatus(t.id, s)}
                    className={`rounded-lg px-2 py-1 text-[10px] ${s === t.status ? "bg-primary/15 text-primary" : "border border-border/60 hover:bg-muted/40"}`}>
                    {STATUS_LABELS_AR[s]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button disabled={busy === t.id} onClick={() => void makeReport(t)}
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40">
                  {busy === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />} توليد التقرير التنفيذي
                </button>
                {(["pdf", "doc", "pptx", "md", "json"] as const).map((f) => (
                  <button key={f} onClick={() => void exportReport(t, f)}
                    className="flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1.5 text-[10px] hover:bg-muted/40">
                    <Download className="size-3" /> {f.toUpperCase()}
                  </button>
                ))}
              </div>

              {t.result && Object.keys(t.result).length ? (
                <div className="rounded-xl border border-border/60 p-2 text-[11px] space-y-1">
                  <div className="font-semibold">{t("auto.executive_summary")}</div>
                  <div className="text-muted-foreground">{t.result.executive_summary}</div>
                  {(t.result.recommendations || []).map((r: string, i: number) => (
                    <div key={i} className="text-muted-foreground">• {r}</div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("auto.note_or_discussion_saved_in_task")}
                  className="flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs" />
                <button disabled={busy === t.id} onClick={() => void addNote(t.id)}
                  className="rounded-lg bg-primary/15 text-primary px-2.5 py-1.5 text-xs">{t("auto.add")}</button>
              </div>

              <div className="rounded-xl border border-border/60">
                <div className="border-b border-border/60 px-2 py-1.5 text-[11px] font-semibold">{t("auto.task_log")}</div>
                <div className="divide-y divide-border/40 max-h-56 overflow-auto">
                  {!detail ? (
                    <div className="p-3 text-[11px] text-muted-foreground">{t("auto.loading")}</div>
                  ) : (detail.events || []).length === 0 ? (
                    <div className="p-3 text-[11px] text-muted-foreground">{t("auto.no_events_yet")}</div>
                  ) : detail.events.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[10px]">
                      <span className="rounded-full bg-muted px-1.5 py-0.5">{e.kind}</span>
                      <span className="flex-1 truncate text-muted-foreground">{e.summary}</span>
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
