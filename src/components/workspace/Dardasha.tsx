import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Send, Trash2, Paperclip, X, ListChecks, XCircle, Check, Copy, ChevronDown, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withPreviewAuth } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { validateAttachment, attachmentPath, ATTACHMENT_MIME } from "@/lib/attachments";
import { composeChatMessage, type DardashaAttachment } from "@/lib/maaroof/dardasha";
import { ShinyText } from "@/components/motion/effects";
import { ExportButtons } from "@/components/ExportButtons";
import { AssistantMessage } from "./AssistantMessage";
import { buildTaskGoalFromResult } from "@/lib/maaroof/chat-actions";
import { GeoScopeSelector, isGeoScopeConfigured, toServerGeoScope, type GeoScope } from "@/components/GeoScopeSelector";
import { FiveAxisAuditCards, type FiveAxisAuditTaskState } from "@/components/workspace/FiveAxisAuditCards";
import { buildFiveAxisAuditGoal } from "@/lib/maaroof/chat-axis-audit";
import { CouncilCards, type Council } from "./CouncilCards";
import { Plus, MessagesSquare } from "lucide-react";

type Quota = { unlimited: boolean; cap: number; remaining: number | null; resets_at: string };
type L = "ar" | "en" | "ku";
type Task = { kind: "scan" | "plan" | "recommend" | "simulate"; goal: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; needs_task?: boolean; task?: Task | null; axisAuditRequest?: boolean; council?: Council | null };
type Thread = { id: string; title: string; updated_at: string | null };
type ChatTaskDraft = { messageKey: string; goal: string };
type Att = DardashaAttachment & { busy?: boolean; failed?: boolean };
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
const token = async () => (await supabase.auth.getSession()).data.session?.access_token || "";

function isActionableAssistantReply(content: string): boolean {
  const value = String(content || "").trim();
  if (value.length < 240) return false;
  const structured = /(^|\n)\s*(?:#{1,4}\s+\S|[-*+]\s+\S|\d{1,2}[.)]\s+\S)/m.test(value)
    || value.split(/\n\s*\n/).filter((part) => part.trim()).length >= 3;
  const actionable = /\b(?:analysis|recommendations?|findings|strategy|plan|risks?|opportunities|next steps|action items|roadmap|SEO|AEO|GEO|SGE|GSEO)\b|(?:تحليل|التوصيات|توصية|التشخيص|النتائج|الخطوات|استراتيجية|مخاطر|فرص|إجراء|خارطة طريق|خطة|ننصح|أوصي|يوصى)|(?:شیکردنەوە|ڕاسپاردە|هەنگاو|پلان|ستراتیژی|مەترسی)/i.test(value);
  return structured && actionable;
}

async function call(method: string, body?: unknown, workspaceId?: string | null, threadId?: string) {
  const t = await token();
  const qs = new URLSearchParams();
  if (workspaceId) qs.set("workspace_id", workspaceId);
  if (threadId) qs.set("thread_id", threadId);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await fetch(withPreviewAuth("/api/maaroof-chat" + query), { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

/** «دردشة»: one surface for chat, files and tasks. A task starts only after the user clicks approve. */
export function Dardasha({
  lang, onPrepareTask, busyTask, workspaceId = null, geoScope, onGeoScopeChange, chatPrefill, onPrefillConsumed, axisAuditTask,
}: {
  lang: L;
  /** Prepares a task draft for review; does not start execution. */
  onPrepareTask: (goal: string) => void;
  busyTask?: boolean;
  workspaceId?: string | null;
  geoScope: GeoScope;
  onGeoScopeChange: (scope: GeoScope) => void;
  chatPrefill?: { text: string; taskId?: string } | null;
  onPrefillConsumed?: () => void;
  /** Live recorded results for a five-axis audit approved in the parent task runner. */
  axisAuditTask?: FiveAxisAuditTaskState;
}) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [drag, setDrag] = useState(false);
  const [contextTaskId, setContextTaskId] = useState("");
  const [taskDraft, setTaskDraft] = useState<ChatTaskDraft | null>(null);
  const [copiedMessageKey, setCopiedMessageKey] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const skipLoad = useRef("");
  const [threadId, setThreadId] = useState("");
  const toMsgs = (items: any[]): Msg[] => items.map((m: any) => ({ ...m, needs_task: m.grounded?.needs_task, task: m.grounded?.task || null, axisAuditRequest: m.grounded?.axis_audit_request === true, council: m.grounded?.council || null }));
  // Load conversation list for this space; open the most recent one.
  useEffect(() => { setTaskDraft(null); setMsgs([]); setThreadId(""); void call("GET", undefined, workspaceId).then((r) => { if (!r.ok) return; setQuota(r.json.quota || null); const ts: Thread[] = r.json.threads || []; setThreads(ts); if (ts[0]) setThreadId(ts[0].id); }); }, [workspaceId]);
  useEffect(() => { if (!threadId) return; if (skipLoad.current === threadId) { skipLoad.current = ""; return; } void call("GET", undefined, workspaceId, threadId).then((r) => { if (r.ok) setMsgs(toMsgs(r.json.items || [])); }); inputRef.current?.focus(); }, [threadId, workspaceId]);
  useEffect(() => {
    if (!chatPrefill) return;
    setText(chatPrefill.text);
    setContextTaskId(chatPrefill.taskId || "");
    inputRef.current?.focus();
    onPrefillConsumed?.();
    // The parent clears the one-shot prefill after it is consumed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatPrefill]);
  const boxRef = useRef<HTMLDivElement>(null);
  // Scroll only inside the message box; never move the page.
  useEffect(() => { const b = boxRef.current; if (b) b.scrollTo({ top: b.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { const t = inputRef.current; if (!t) return; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 160)}px`; }, [text]);

  const addFiles = async (files: File[]) => {
    if (!user) return;
    for (const f of files) {
      if (validateAttachment(f) !== "ok") { setErr(tr(lang, `«${f.name}» غير مدعوم (صورة، PDF أو نص حتى 10MB).`, `"${f.name}" unsupported (image, PDF or text up to 10MB).`, `«${f.name}» پشتگیری ناکرێت.`)); continue; }
      const name = f.name || "paste.png";
      setAtts((p) => [...p, { name, analysis: "", busy: true }]);
      try {
        const path = attachmentPath(user.id, name, Date.now(), workspaceId);
        const up = await supabase.storage.from("task-files").upload(path, f, { contentType: f.type });
        if (up.error) throw new Error("upload");
        const r = await fetch(withPreviewAuth("/api/attachment-analyze"), { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ path, name, mime: f.type, question: text, lang, workspace_id: workspaceId }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "failed");
        setAtts((p) => p.map((a) => (a.name === name && a.busy ? { name, analysis: String(j.analysis || "") } : a)));
      } catch {
        setAtts((p) => p.map((a) => (a.name === name && a.busy ? { name, analysis: "", failed: true } : a)));
      }
    }
  };

  const send = async () => {
    const ready = atts.filter((a) => !a.busy && !a.failed);
    const m = composeChatMessage(text, ready);
    if (!m || busy || atts.some((a) => a.busy)) return;
    if (!isGeoScopeConfigured(geoScope)) {
      setErr(tr(lang, "أكمل تحديد الدولة والمنطقة أو المدينة قبل إرسال الطلب.", "Choose the required country and region/city before sending.", "پێش ناردن وڵات و ناوچە/شار دیاری بکە."));
      return;
    }
    setText(""); setAtts([]); setErr(""); setBusy(true);
    setMsgs((p) => [...p, { role: "user", content: m }]);
    try {
      const r = await call("POST", {
        message: m, lang, workspace_id: workspaceId,
        task_id: contextTaskId || undefined,
        thread_id: threadId || undefined,
        geo_scope: toServerGeoScope(geoScope),
      }, workspaceId);
      if (!r.ok) {
        const e = r.json?.error;
        setErr(e === "chat_limit" ? tr(lang, "انتهى حد المحادثة لليوم.", "Daily chat limit reached.", "سنووری ڕۆژانە تەواو بوو.")
          : r.status === 402 ? tr(lang, "الرصيد غير كافٍ. لم يُخصم شيء.", "Not enough balance. Nothing was charged.", "باڵانس بەس نییە.")
          : tr(lang, "تعذّر الرد الآن، لم يُخصم شيء. حاول مجدداً.", "Could not reply; nothing charged. Try again.", "وەڵام نەدرایەوە. دووبارە هەوڵ بدە."));
        return;
      }
      if (r.json.quota) setQuota(r.json.quota);
      setMsgs((p) => [...p, { role: "assistant", content: r.json.text, needs_task: r.json.needs_task, task: r.json.task || null, axisAuditRequest: r.json.axis_audit_request === true, council: r.json.council || null }]);
      if (r.json.thread_id && r.json.thread_id !== threadId) {
        const nid = String(r.json.thread_id);
        setThreads((ts) => [{ id: nid, title: m.slice(0, 60), updated_at: new Date().toISOString() }, ...ts.filter((t) => t.id !== nid)]);
        skipLoad.current = nid; setThreadId(nid);
      }
    } catch {
      setErr(tr(lang, "انقطع الاتصال بالدردشة. تحقق من الاتصال وحاول مجدداً.", "Chat connection failed. Check your connection and retry.", "پەیوەندی گفتوگۆ کێشەی هەبوو. دووبارە هەوڵ بدە."));
    } finally {
      setBusy(false); inputRef.current?.focus();
    }
  };

  const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content || "";
  const kindLabel: Record<string, string> = { scan: tr(lang, "فحص", "Scan", "پشکنین"), plan: tr(lang, "خطة", "Plan", "پلان"), recommend: tr(lang, "توصية", "Recommendation", "ڕاسپاردە"), simulate: tr(lang, "محاكاة", "Simulation", "لاساییکردنەوە") };

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(Array.from(e.dataTransfer.files || [])); }}
      className={`rb-workspace-fade maaroof-chat-shell min-w-0 rounded-2xl border bg-card p-3 shadow-sm transition sm:p-4 xl:p-5 ${drag ? "border-primary ring-4 ring-primary/20" : "border-border"}`}
    >
      <div className="maaroof-chat-heading mb-3 flex shrink-0 items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{tr(lang, "دردشة", "Dardasha", "دردشە")}</h2>
          <p className="text-xs text-muted-foreground">{tr(lang, "اكتب، الصق، أو اسحب ملفاً. معروف يفهم طلبك ويختار المهارات والأدوات بنفسه، ولا يبدأ أي مهمة إلا بموافقتك.", "Type, paste or drop a file. Maaroof understands, picks skills and tools itself, and starts nothing without your approval.", "بنووسە، بلکێنە یان فایل ڕابکێشە. معروف بەبێ ڕەزامەندیت هیچ دەست پێناکات.")}</p>
        </div>
        <div className="flex items-center gap-2">
          {quota && <span className="rounded-full bg-muted px-3 py-1 text-xs tabular-nums">{(quota as any).approved ? tr(lang, "غير محدود", "Unlimited", "بێسنوور") : quota.unlimited ? tr(lang, "من رصيدك عند النجاح", "From balance on success", "لە باڵانس") : `${quota.remaining}/${quota.cap}`}</span>}
          {threadId && <button type="button" onClick={async () => { if (window.confirm(tr(lang, "حذف هذه المحادثة؟", "Delete this conversation?", "سڕینەوە؟"))) { await call("DELETE", undefined, workspaceId, threadId); setMsgs([]); setThreads((ts) => ts.filter((t) => t.id !== threadId)); setThreadId(""); } }} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="clear"><Trash2 className="size-4" /></button>}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MessagesSquare className="size-4 text-muted-foreground" />
        <select aria-label={tr(lang, "المحادثات السابقة", "Previous conversations", "گفتوگۆکانی پێشوو")} value={threadId} onChange={(e) => setThreadId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {!threadId && <option value="">{tr(lang, "محادثة جديدة", "New conversation", "گفتوگۆی نوێ")}</option>}
          {threads.map((t) => <option key={t.id} value={t.id}>{t.id === "legacy" ? tr(lang, "محادثات سابقة", "Earlier messages", "نامەکانی پێشوو") : t.title}</option>)}
        </select>
        <button type="button" onClick={() => { setThreadId(""); setMsgs([]); setTaskDraft(null); inputRef.current?.focus(); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Plus className="size-3.5" />{tr(lang, "محادثة جديدة", "New", "نوێ")}</button>
      </div>
      <div className="maaroof-chat-scope mb-3 rounded-xl border border-border bg-background/50 p-3 sm:p-3.5">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">{tr(lang, "النطاق الجغرافي الذي سيُوجّه الدردشة والبحث", "Geographic scope for chat and research", "بواری جوگرافی بۆ گفتوگۆ و گەڕان")}</div>
        <GeoScopeSelector compact value={geoScope} onChange={onGeoScopeChange} />
      </div>
      <div ref={boxRef} style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }} className="maaroof-chat-messages min-w-0 min-h-[220px] flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-xl bg-background p-3 scroll-smooth md:p-4">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">{tr(lang, "مثال: «افحص ظهور علامتي في ChatGPT» أو «عميل لديه حساب إنستغرام فقط، ماذا نفعل؟»", "Example: “Check my brand in ChatGPT”", "نموونە: «براندەکەم بپشکنە»")}</p>}
        {atts.some((a) => a.busy) && <div role="status" aria-live="polite" className="mb-3 rounded-xl border border-border p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold"><LoaderCircle className="size-3.5 animate-spin text-primary" />{tr(lang, "استخراج محتوى الملف", "Extracting file content", "دەرهێنانی ناوەڕۆکی فایل")}</div>
          <p className="mt-1 text-muted-foreground">{tr(lang, "رفع الملف ثم تحليل المحتوى وإلحاقه بسياق الدردشة قبل الإرسال.", "Uploading, analyzing, then attaching the extracted content to the chat before sending.", "بارکردن و شیکردنەوە و زیادکردنی ناوەڕۆک بۆ گفتوگۆ پێش ناردن.")}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 rounded-full bg-primary animate-[pulse_1.2s_ease-in-out_infinite]" /></div>
        </div>}
        {msgs.map((m, i) => {
          const requestContext = [...msgs.slice(0, i)].reverse().find((candidate) => candidate.role === "user")?.content || lastUser;
          const messageKey = m.id || `message-${i}`;
          const openTaskDraft = (proposedGoal?: string) => setTaskDraft({ messageKey, goal: buildTaskGoalFromResult({ language: lang, originalRequest: requestContext, answer: m.content, proposedGoal }) });
          return (
          <div key={messageKey} className={m.role === "user" ? "flex justify-end" : "min-w-0"}>
            <div
              onPointerMove={m.role === "assistant" ? (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                event.currentTarget.style.setProperty("--chat-x", `${event.clientX - rect.left}px`);
                event.currentTarget.style.setProperty("--chat-y", `${event.clientY - rect.top}px`);
              } : undefined}
              style={m.role === "assistant" ? { backgroundImage: "radial-gradient(380px circle at var(--chat-x, 50%) var(--chat-y, 50%), hsl(var(--primary) / 0.055), transparent 74%)" } : undefined}
              className={m.role === "user"
                ? "max-w-[85%] whitespace-pre-wrap rounded-2xl border border-primary/10 bg-primary/10 px-4 py-2.5 text-sm leading-6 text-foreground shadow-sm"
                : "relative max-w-full min-w-0 rounded-2xl border border-border/55 bg-card/45 p-3 text-sm leading-7 shadow-sm backdrop-blur-sm transition duration-200 hover:border-primary/20 hover:shadow-md sm:p-4"}
            >
              {m.role === "assistant" && <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-semibold tracking-wide text-primary">معروف</span>
                {isGeoScopeConfigured(geoScope) && <span className="rounded-full bg-muted/70 px-2 py-0.5">{tr(lang, "سياق جغرافي مفعّل", "Geographic context active", "پاشبنەمای جوگرافی چالاکە")}</span>}
              </div>}
              {m.role === "assistant" ? <AssistantMessage content={m.content} lang={lang} /> : m.content}
              {m.role === "assistant" && m.council && <CouncilCards council={m.council} lang={lang} />}
              {m.role === "assistant" && m.axisAuditRequest && (
                <FiveAxisAuditCards
                  lang={lang}
                  onReviewAndRun={() => onPrepareTask(buildFiveAxisAuditGoal(lang))}
                  taskState={axisAuditTask}
                />
              )}
              {m.role === "assistant" && !m.axisAuditRequest && !m.task && !m.needs_task && isActionableAssistantReply(m.content) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2 opacity-80 transition-opacity hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.clipboard?.writeText) {
                        setErr(tr(lang, "تعذّر النسخ من هذا المتصفح.", "Clipboard is unavailable in this browser.", "لەو وێبگەڕەدا کۆپی بەردەست نییە."));
                        return;
                      }
                      void navigator.clipboard.writeText(m.content)
                        .then(() => setCopiedMessageKey(messageKey))
                        .catch(() => setErr(tr(lang, "تعذّر نسخ الرد.", "Could not copy the reply.", "کۆپی وەڵام سەرکەوتوو نەبوو.")));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label={tr(lang, "نسخ الرد", "Copy reply", "کۆپی وەڵام")}
                  >
                    {copiedMessageKey === messageKey ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copiedMessageKey === messageKey ? tr(lang, "تم النسخ", "Copied", "کۆپی کرا") : tr(lang, "نسخ", "Copy", "کۆپی")}
                  </button>
                  <details className="group/export relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                      <FileDown className="size-3.5" />
                      {tr(lang, "تصدير", "Export", "هەناردە")}
                      <ChevronDown className="size-3 transition-transform group-open/export:rotate-180" />
                    </summary>
                    <div className="mt-2 rounded-xl border border-border/70 bg-popover p-2 shadow-lg">
                      <ExportButtons size="xs" build={() => ({ title: tr(lang, "استشارة معروف", "Maaroof consultation", "ڕاوێژکاری معروف"), lang, sections: [{ heading: tr(lang, "النتيجة", "Result", "ئەنجام"), kind: "text", text: m.content }] })} />
                    </div>
                  </details>
                  <button type="button" disabled={busyTask} onClick={() => openTaskDraft()} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50">
                    <ListChecks className="size-3.5" />{tr(lang, "تحويل لمهمة", "Turn into task", "بیکە بە ئەرک")}
                  </button>
                </div>
              )}
              {m.role === "assistant" && !m.axisAuditRequest && (m.task || m.needs_task) && (
                <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs">
                  <p className="font-semibold text-primary">{tr(lang, "مهمة مقترحة", "Proposed task", "ئەرکی پێشنیارکراو")}{m.task ? ` · ${kindLabel[m.task.kind] || ""}` : ""}</p>
                  <p className="mt-1 text-foreground">{m.task?.goal || lastUser}</p>
                  <p className="mt-1 text-muted-foreground">{tr(lang, "ستمر بالمراحل الست: فهم الطلب ← الخطة والأدوات ← جمع الأدلة ← النماذج العشرة ← حل التعارض ← النتيجة. لا يُخصم شيء إلا عند النجاح.", "Six stages: understand → plan & tools → evidence → ten engines → resolve conflicts → result. Charged only on success.", "شەش قۆناغ. تەنها لە سەرکەوتندا دەبڕدرێت.")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busyTask} onClick={() => openTaskDraft(m.task?.goal || requestContext)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"><ListChecks className="size-3.5" />{tr(lang, "مراجعة المهمة", "Review task", "پێداچوونەوەی ئەرک")}</button>
                  </div>
                </div>
              )}
            </div>
            {m.role === "assistant" && taskDraft?.messageKey === messageKey && (
              <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4" data-testid="chat-task-draft">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-primary"><ListChecks className="size-4" />{tr(lang, "مسودة مهمة من هذه النتيجة", "Task draft from this result", "ڕەشنووسی ئەرک لەم ئەنجامەوە")}</div>
                  <button type="button" onClick={() => setTaskDraft(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label={tr(lang, "إلغاء المسودة", "Cancel draft", "هەڵوەشاندنەوە")}><XCircle className="size-4" /></button>
                </div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`chat-task-draft-${messageKey}`}>{tr(lang, "الهدف والسياق — راجعه وعدّله قبل المتابعة", "Goal and context — review and edit before continuing", "ئامانج و پاشبنەما — پێش بەردەوامبوون پێداچوونەوە و دەستکاری بکە")}</label>
                <textarea id={`chat-task-draft-${messageKey}`} value={taskDraft.goal} onChange={(event) => setTaskDraft((draft) => draft?.messageKey === messageKey ? { ...draft, goal: event.target.value.slice(0, 1800) } : draft)} rows={5} className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" dir="auto" />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{tr(lang, "هذه مسودة فقط. لا يبدأ التنفيذ هنا؛ ستراجع نطاق المهمة وتقدير التكلفة في إعداد المهمة قبل الضغط على بدء التنفيذ.", "This is only a draft. Execution does not start here; review task scope and the cost estimate in task setup before starting.", "ئەمە تەنها ڕەشنووسە. جێبەجێکردن لێرە دەست پێناکات؛ پێش دەستپێکردن سنوور و تێچوو لە ئامادەکاری ئەرک بپشکنە.")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busyTask || !taskDraft.goal.trim()} onClick={() => { const goal = taskDraft.goal.trim(); setTaskDraft(null); onPrepareTask(goal); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"><ListChecks className="size-3.5" />{tr(lang, "متابعة إلى مراجعة التكلفة", "Continue to cost review", "بەردەوامبوون بۆ پێداچوونەوەی تێچوو")}</button>
                  <button type="button" onClick={() => setTaskDraft(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">{tr(lang, "إلغاء", "Cancel", "هەڵوەشاندنەوە")}</button>
                </div>
              </div>
            )}
          </div>
          );
        })}
        {busy && <div role="status" aria-live="polite" className="mx-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-primary/15 bg-card/55 px-4 py-3 shadow-sm backdrop-blur-sm"><span className="relative flex size-2.5 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/35 motion-reduce:animate-none" /><span className="relative inline-flex size-2.5 rounded-full bg-primary/70" /></span><div className="min-w-0 text-sm"><ShinyText>{tr(lang, "معروف يستحضر سياقك ويصيغ الرد…", "Maaroof is gathering context and shaping the reply…", "معروف پاشبنەما کۆدەکاتەوە و وەڵام ئامادە دەکات…")}</ShinyText><p className="mt-0.5 text-[11px] text-muted-foreground">{tr(lang, "يجري إعداد الرد الآن", "Preparing your reply", "ئێستا وەڵام ئامادە دەکرێت")}</p></div><LoaderCircle className="ms-auto size-4 shrink-0 animate-spin text-primary/70" /></div>}
        <div ref={endRef} />
      </div>
      {atts.length > 0 && (
        <div className="maaroof-chat-attachments mt-2 flex shrink-0 flex-wrap gap-2 text-xs">
          {atts.map((a, i) => (
            <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${a.failed ? "border-destructive text-destructive" : "border-border"}`}>
              {a.busy ? <LoaderCircle className="size-3 animate-spin" /> : <Paperclip className="size-3" />}{a.name}{a.failed ? ` · ${tr(lang, "تعذّر، لم يُخصم", "failed, not charged", "شکستی هێنا")}` : ""}
              <button type="button" onClick={() => setAtts((p) => p.filter((_, j) => j !== i))} aria-label="remove"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      {err && <p className="maaroof-chat-error mt-2 shrink-0 text-xs text-destructive">{err}</p>}
      <div className="maaroof-chat-composer mt-3 flex w-full min-w-0 shrink-0 items-center gap-2 rounded-[1.75rem] border border-border/70 bg-card/60 p-2 shadow-sm backdrop-blur-md transition focus-within:border-primary/30 focus-within:shadow-md">
        <input ref={fileRef} type="file" multiple accept={ATTACHMENT_MIME.join(",")} className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-muted-foreground transition hover:bg-muted hover:text-primary" aria-label="attach" title={tr(lang, "إرفاق ملف", "Attach file", "هاوپێچکردنی فایل")}><Paperclip className="size-4" /></button>
        <textarea id="dardasha-message-input" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const fs = Array.from(e.clipboardData.files || []); if (fs.length) { e.preventDefault(); void addFiles(fs); } }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={1} placeholder={tr(lang, "اكتب، الصق، أو اسحب ملفاً هنا…", "Type, paste or drop a file…", "بنووسە…")}
          className="maaroof-chat-input min-h-14 max-h-40 min-w-0 w-full flex-1 resize-none rounded-3xl border border-transparent bg-transparent px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-muted-foreground/75 focus:border-transparent focus:bg-transparent focus:ring-0" />
        <button type="button" onClick={() => void send()} disabled={busy || (!text.trim() && !atts.some((a) => !a.busy && !a.failed))} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:scale-[1.03] hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100" aria-label={tr(lang, "إرسال", "Send", "ناردن")}><Send className="size-5" /></button>
      </div>
    </section>
  );
}
