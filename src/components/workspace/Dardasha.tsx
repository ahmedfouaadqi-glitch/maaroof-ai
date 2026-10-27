import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Send, Trash2, Paperclip, X, ListChecks, XCircle, Check, Copy, ChevronDown, FileDown, Plus, MessagesSquare, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withPreviewAuth } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { validateAttachment, attachmentPath } from "@/lib/attachments";
import { composeChatMessage, MAX_DARDASHA_MESSAGE_CHARS, type DardashaAttachment } from "@/lib/maaroof/dardasha";
import { resolveCompetitiveContext, type CompetitiveWorkspaceContext } from "@/lib/competitive-context";
import { shouldAutoStartKeywordResearch } from "@/lib/keyword-intelligence-flow";
import type { Workspace } from "@/components/maaroof/WorkspaceSwitcher";
import { ShinyText } from "@/components/motion/effects";
import { ExportButtons } from "@/components/ExportButtons";
import { AssistantMessage } from "./AssistantMessage";
import { buildTaskGoalFromResult } from "@/lib/maaroof/chat-actions";
import { GeoScopeSelector, isGeoScopeConfigured, toServerGeoScope, type GeoScope } from "@/components/GeoScopeSelector";
import { getCompactGeoScopeDisplay } from "@/lib/geo-scope-display";
import { FiveAxisAuditCards, type FiveAxisAuditTaskState } from "@/components/workspace/FiveAxisAuditCards";
import { buildFiveAxisAuditGoal } from "@/lib/maaroof/chat-axis-audit";
import { CouncilCards, type Council } from "./CouncilCards";

type Quota = { unlimited: boolean; cap: number; remaining: number | null; resets_at: string };
type L = "ar" | "en" | "ku";
type Task = { kind: "scan" | "plan" | "recommend" | "simulate"; goal: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; needs_task?: boolean; task?: Task | null; axisAuditRequest?: boolean; council?: Council | null; sheets?: SheetCard[] };
type SheetCard = { name: string; attachment_id?: string; source?: string; totalRows: number; sheets: Array<{ name: string; totalRows: number; columns: string[]; sample: (string | number)[][] }> };
type Thread = { id: string; title: string; updated_at: string | null };
type ChatTaskDraft = { messageKey: string; goal: string };
type Att = DardashaAttachment & { busy?: boolean; failed?: boolean; id?: string; reason?: string };
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
  lang, onPrepareTask, busyTask, workspaceId = null, workspaceContext, geoScope, onGeoScopeChange, chatPrefill, onPrefillConsumed, axisAuditTask,
}: {
  lang: L;
  /** Prepares a task draft for review; does not start execution. */
  onPrepareTask: (goal: string) => void;
  busyTask?: boolean;
  workspaceId?: string | null;
  workspaceContext?: Workspace | null;
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
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scopeExpanded, setScopeExpanded] = useState(() => geoScope.scope === "auto");

  const toggleHistory = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setHistoryOpen((open) => !open);
    } else {
      setHistoryCollapsed((collapsed) => !collapsed);
    }
  };

  const startNewConversation = () => {
    setThreadId("");
    setMsgs([]);
    setTaskDraft(null);
    setErr("");
    setContextTaskId("");
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (geoScope.scope !== "auto" && isGeoScopeConfigured(geoScope)) setScopeExpanded(false);
  }, [geoScope.scope, geoScope.country, geoScope.region, geoScope.city]);
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
      if (validateAttachment(f) !== "ok") { setErr(tr(lang, `«${f.name}» فارغ أو أكبر من 10MB.`, `"${f.name}" is empty or over 10MB.`, `«${f.name}» بەتاڵە یان لە 10MB گەورەترە.`)); continue; }
      const name = f.name || "paste.png";
      setAtts((p) => [...p, { name, analysis: "", busy: true }]);
      try {
        const path = attachmentPath(user.id, name, Date.now(), workspaceId);
        const up = await supabase.storage.from("task-files").upload(path, f, { contentType: f.type || "application/octet-stream" });
        if (up.error) throw new Error("upload");
        const r = await fetch(withPreviewAuth("/api/attachment-analyze"), { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ path, name, mime: f.type || "application/octet-stream", question: text, lang, workspace_id: workspaceId }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "failed");
        setAtts((p) => p.map((a) => (a.name === name && a.busy ? { name, analysis: String(j.analysis || ""), id: j.id ? String(j.id) : undefined } : a)));
      } catch (e: any) {
        const code = String(e?.message || "");
        const reason = code === "balance" ? tr(lang, "الرصيد غير كافٍ لتحليل الملف", "Not enough balance to analyse the file", "باڵانس بەس نییە")
          : code === "unreadable_sheet" || code === "unreadable_office" ? tr(lang, "تعذّرت قراءة الجدول؛ احفظه بصيغة xlsx أو csv وأعد رفعه", "Could not read the sheet; save as xlsx or csv and re-upload", "خشتەکە نەخوێندرایەوە")
          : tr(lang, "تعذّر التحليل؛ لم يُخصم شيء", "Analysis failed; nothing charged", "شیکردنەوە سەرکەوتوو نەبوو");
        setAtts((p) => p.map((a) => (a.name === name && a.busy ? { name, analysis: "", failed: true, reason } : a)));
      }
    }
  };

  const send = async () => {
    const ready = atts.filter((a) => !a.busy && !a.failed);
    const m = composeChatMessage(text, ready);
    if (!m || busy || atts.some((a) => a.busy)) return;
    if (m.length > MAX_DARDASHA_MESSAGE_CHARS) {
      setErr(tr(lang, `الرسالة مع سياق المرفقات تتجاوز الحد ${MAX_DARDASHA_MESSAGE_CHARS.toLocaleString()} حرفًا. اختصرها أو أرسلها على أجزاء؛ لم تُرسل أي بيانات.`, `The message plus attachment context exceeds ${MAX_DARDASHA_MESSAGE_CHARS.toLocaleString()} characters. Shorten it or send it in parts; nothing was sent.`, `نامەکە لەگەڵ پاشبنەمای هاوپێچەکان لە ${MAX_DARDASHA_MESSAGE_CHARS.toLocaleString()} پیت زیاترە. بەش بەش بینێرە؛ هیچ داتایەک نەنێردرا.`));
      return;
    }
    if (!isGeoScopeConfigured(geoScope)) {
      setErr(tr(lang, "أكمل تحديد الدولة والمنطقة أو المدينة قبل إرسال الطلب.", "Choose the required country and region/city before sending.", "پێش ناردن وڵات و ناوچە/شار دیاری بکە."));
      return;
    }
    const attachmentIds = ready.map((a) => a.id).filter(Boolean) as string[];
    setText(""); setAtts([]); setErr(""); setBusy(true);
    setMsgs((p) => [...p, { role: "user", content: m }]);
    try {
      const r = await call("POST", {
        message: m, lang, workspace_id: workspaceId, attachment_ids: attachmentIds,
        task_id: contextTaskId || undefined,
        thread_id: threadId || undefined,
        geo_scope: toServerGeoScope(geoScope),
      }, workspaceId);
      if (!r.ok) {
        const e = r.json?.error;
        setErr(e === "message_too_long" ? tr(lang, "الرسالة طويلة جدًا؛ الحد 12000 حرف. اختصرها أو أرسلها على أجزاء.", "Message is too long; the limit is 12,000 characters. Shorten it or send it in parts.", "نامەکە زۆر درێژە؛ سنوور 12000 پیتە.")
          : e === "chat_limit" ? tr(lang, "انتهى حد المحادثة لليوم.", "Daily chat limit reached.", "سنووری ڕۆژانە تەواو بوو.")
          : r.status === 402 ? tr(lang, "الرصيد غير كافٍ. لم يُخصم شيء.", "Not enough balance. Nothing was charged.", "باڵانس بەس نییە.")
          : tr(lang, "تعذّر الرد الآن، لم يُخصم شيء. حاول مجدداً.", "Could not reply; nothing charged. Try again.", "وەڵام نەدرایەوە. دووبارە هەوڵ بدە."));
        return;
      }
      if (r.json.quota) setQuota(r.json.quota);
      setMsgs((p) => [...p, { role: "assistant", content: r.json.text, needs_task: r.json.needs_task, task: r.json.task || null, axisAuditRequest: r.json.axis_audit_request === true, council: r.json.council || null, sheets: Array.isArray(r.json.sheets) ? r.json.sheets : [] }]);
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
  const scopeDisplay = getCompactGeoScopeDisplay(geoScope, lang);

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
          <button type="button" onClick={toggleHistory} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={tr(lang, "إظهار أو إخفاء سجل المحادثات", "Toggle conversation history", "پیشاندان یان شاردنەوەی تۆماری گفتوگۆ")} title={tr(lang, "سجل المحادثات", "Conversation history", "تۆماری گفتوگۆ")}>
            <MessagesSquare className="size-4" />
          </button>
          {quota && <span className="rounded-full bg-muted px-3 py-1 text-xs tabular-nums">{(quota as any).approved ? tr(lang, "غير محدود", "Unlimited", "بێسنوور") : quota.unlimited ? tr(lang, "من رصيدك عند النجاح", "From balance on success", "لە باڵانس") : `${quota.remaining}/${quota.cap}`}</span>}
          {threadId && <button type="button" onClick={async () => { if (window.confirm(tr(lang, "حذف هذه المحادثة؟", "Delete this conversation?", "سڕینەوە؟"))) { await call("DELETE", undefined, workspaceId, threadId); setMsgs([]); setThreads((ts) => ts.filter((t) => t.id !== threadId)); setThreadId(""); } }} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="clear"><Trash2 className="size-4" /></button>}
        </div>
      </div>
      <div className={"maaroof-chat-layout min-w-0" + (historyCollapsed ? " is-history-collapsed" : "") + (historyOpen ? " is-history-open" : "")}>
        <aside className="maaroof-chat-history" aria-label={tr(lang, "سجل المحادثات", "Conversation history", "تۆماری گفتوگۆ")}>
          <div className="maaroof-chat-history-heading">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <MessagesSquare className="size-4 shrink-0 text-primary" />
              <span className="truncate">{tr(lang, "سجل المحادثات", "Conversations", "تۆماری گفتوگۆ")}</span>
            </div>
            <button type="button" onClick={startNewConversation} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition hover:bg-primary/15" aria-label={tr(lang, "محادثة جديدة", "New conversation", "گفتوگۆی نوێ")} title={tr(lang, "محادثة جديدة", "New conversation", "گفتوگۆی نوێ")}>
              <Plus className="size-4" />
            </button>
          </div>
          <div className="maaroof-chat-history-list">
            {threads.length === 0 && <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">{tr(lang, "ستظهر محادثاتك السابقة هنا.", "Your previous conversations will appear here.", "گفتوگۆکانی پێشووت لێرە دەردەکەون.")}</p>}
            {threads.map((thread) => (
              <button
                type="button"
                key={thread.id}
                onClick={() => { setTaskDraft(null); setThreadId(thread.id); setHistoryOpen(false); }}
                className={"maaroof-chat-thread" + (threadId === thread.id ? " is-active" : "")}
                aria-current={threadId === thread.id ? "page" : undefined}
                title={thread.title}
              >
                <span className="min-w-0 flex-1 truncate text-start">{thread.id === "legacy" ? tr(lang, "محادثات سابقة", "Earlier messages", "نامەکانی پێشوو") : thread.title}</span>
                {threadId === thread.id && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </aside>
        <div className="maaroof-chat-main min-w-0">
          <div className="maaroof-chat-scope">
            <button
              type="button"
              className="maaroof-chat-scope-toggle"
              onClick={() => setScopeExpanded((expanded) => !expanded)}
              aria-expanded={scopeExpanded}
              title={tr(lang, "تغيير النطاق الجغرافي", "Change geographic scope", "گۆڕینی بواری جوگرافی")}
            >
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="shrink-0 text-xs text-muted-foreground">{tr(lang, "أنت تعمل على نطاق", "Working in scope", "تۆ لە بواری")}</span>
              {scopeDisplay.flag && <span className="shrink-0" aria-hidden="true">{scopeDisplay.flag}</span>}
              <span className="min-w-0 truncate text-sm font-semibold">{scopeDisplay.label}</span>
              {scopeDisplay.code && <span className="shrink-0 text-xs font-medium text-muted-foreground">({scopeDisplay.code})</span>}
              <ChevronDown className={"ms-auto size-4 shrink-0 text-muted-foreground transition-transform" + (scopeExpanded ? " rotate-180" : "")} />
            </button>
            {scopeExpanded && (
              <div className="maaroof-chat-scope-editor">
                <GeoScopeSelector
                  compact
                  value={geoScope}
                  onChange={(next) => {
                    onGeoScopeChange(next);
                    if (isGeoScopeConfigured(next)) setScopeExpanded(false);
                  }}
                />
              </div>
            )}
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
                ? "max-w-[85%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl border border-primary/10 bg-primary/10 px-4 py-2.5 text-sm leading-6 text-foreground shadow-sm"
                : "relative max-w-full min-w-0 rounded-2xl border border-border/55 bg-card/45 p-3 text-sm leading-7 shadow-sm backdrop-blur-sm transition duration-200 hover:border-primary/20 hover:shadow-md sm:p-4"}
            >
              {m.role === "assistant" && <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-semibold tracking-wide text-primary">معروف</span>
                {isGeoScopeConfigured(geoScope) && <span className="rounded-full bg-muted/70 px-2 py-0.5">{tr(lang, "سياق جغرافي مفعّل", "Geographic context active", "پاشبنەمای جوگرافی چالاکە")}</span>}
              </div>}
              {m.role === "assistant" ? <AssistantMessage content={m.content} lang={lang} /> : m.content}
              {m.role === "assistant" && m.sheets && m.sheets.length > 0 && <SheetInventory sheets={m.sheets} lang={lang} reply={m.content} requestText={requestContext} workspaceContext={workspaceContext} geoScope={geoScope} workspaceId={workspaceId} />}
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
              {a.busy ? <LoaderCircle className="size-3 animate-spin" /> : <Paperclip className="size-3" />}{a.name}{a.failed ? ` · ${a.reason || tr(lang, "تعذّر، لم يُخصم", "failed, not charged", "شکستی هێنا")}` : ""}
              <button type="button" onClick={() => setAtts((p) => p.filter((_, j) => j !== i))} aria-label="remove"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      {err && <p className="maaroof-chat-error mt-2 shrink-0 text-xs text-destructive">{err}</p>}
      <div className="maaroof-chat-composer mt-3 flex w-full min-w-0 shrink-0 items-center gap-2 rounded-[1.75rem] border border-border/70 bg-card/60 p-2 shadow-sm backdrop-blur-md transition focus-within:border-primary/30 focus-within:shadow-md">
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-muted-foreground transition hover:bg-muted hover:text-primary" aria-label="attach" title={tr(lang, "إرفاق ملف", "Attach file", "هاوپێچکردنی فایل")}><Paperclip className="size-4" /></button>
        <textarea id="dardasha-message-input" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const fs = Array.from(e.clipboardData.files || []); if (fs.length) { e.preventDefault(); void addFiles(fs); } }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={1} placeholder={tr(lang, "اكتب، الصق، أو اسحب ملفاً هنا…", "Type, paste or drop a file…", "بنووسە…")}
          className="maaroof-chat-input min-h-14 max-h-40 min-w-0 w-full flex-1 resize-none rounded-3xl border border-transparent bg-transparent px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-muted-foreground/75 focus:border-transparent focus:bg-transparent focus:ring-0" />
        <button type="button" onClick={() => void send()} disabled={busy || (!text.trim() && !atts.some((a) => !a.busy && !a.failed))} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:scale-[1.03] hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100" aria-label={tr(lang, "إرسال", "Send", "ناردن")}><Send className="size-5" /></button>
      </div>
      {(text.length > 1800 || atts.length > 0) && <p className="maaroof-chat-message-counter mt-1 px-3 text-[11px] text-muted-foreground" aria-live="polite">{composeChatMessage(text, atts.filter((a) => !a.busy && !a.failed)).length.toLocaleString()} / {MAX_DARDASHA_MESSAGE_CHARS.toLocaleString()} {tr(lang, "حرفًا", "characters", "پیت")}</p>}
        </div>
      </div>
    </section>
  );
}

function sheetExportPayload(cards: SheetCard[], reply: string, lang: L) {
  const sections: any[] = [{ heading: tr(lang, "تحليل معروف", "Maaroof analysis", "شیکردنەوەی معروف"), kind: "text", text: reply }];
  for (const c of cards) {
    sections.push({ heading: `${c.name} — ${tr(lang, "جرد التبويبات", "Sheet inventory", "لیستی پەڕەکان")}`, kind: "table", table: { columns: [tr(lang, "التبويب", "Sheet", "پەڕە"), tr(lang, "الصفوف", "Rows", "ڕیز"), tr(lang, "الأعمدة", "Columns", "ستوون")], data: c.sheets.map((s) => [s.name, s.totalRows, s.columns.join(", ")]) } });
    for (const s of c.sheets) if (s.sample?.length) sections.push({ heading: `${s.name} — ${tr(lang, "عينة من الملف الأصلي", "Sample from source file", "نموونە")}`, kind: "table", table: { columns: s.columns, data: s.sample.map((r) => s.columns.map((_, i) => r[i] ?? "")) } });
  }
  return { title: tr(lang, "تحليل الملف — معروف", "File analysis — Maaroof", "شیکردنەوەی فایل"), lang, sections };
}

function SheetInventory({
  sheets, lang, reply, requestText, workspaceContext, geoScope, workspaceId,
}: {
  sheets: SheetCard[];
  lang: L;
  reply: string;
  requestText: string;
  workspaceContext?: Workspace | null;
  geoScope: GeoScope;
  workspaceId?: string | null;
}) {
  const workbookHints = sheets.flatMap((c) => c.sheets.flatMap((s) => [
    s.name, ...s.columns, ...s.sample.flatMap((row) => row.map((cell) => String(cell))),
  ]));
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
      {sheets.map((c, ci) => (
        <div key={ci}>
          <p className="font-semibold text-foreground">{tr(lang, "محتوى الملف", "File contents", "ناوەڕۆکی فایل")}: {c.name} · {c.sheets.length} {tr(lang, "تبويب", "sheets", "پەڕە")} · {c.totalRows} {tr(lang, "صف", "rows", "ڕیز")}</p>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {c.sheets.map((s, i) => <li key={i} className="rounded-lg bg-background px-2 py-1"><span className="font-medium">{s.name}</span> <span className="text-muted-foreground tabular-nums">· {s.totalRows} {tr(lang, "صف", "rows", "ڕیز")} · {s.columns.length} {tr(lang, "عمود", "cols", "ستوون")}</span></li>)}
          </ul>
        </div>
      ))}
      <ExportButtons size="xs" build={() => sheetExportPayload(sheets, reply, lang) as any} />
      {sheets.find((c) => c.attachment_id) && (
        <SecondResult
          attachmentId={sheets.find((c) => c.attachment_id)!.attachment_id!}
          lang={lang}
          workspaceId={workspaceId || null}
          workspaceContext={workspaceContext}
          requestText={requestText}
          geoScope={geoScope}
          workbookHints={workbookHints}
        />
      )}
    </div>
  );
}

type ProbeDiagnostics = {
  asked: number;
  answered: number;
  no_answer: number;
  empty: number;
  timeout: number;
  http_error: number;
  error: number;
};

type DualRes = {
  payload: any;
  summary: Array<{ market: string; label: string; voice: Array<{ name: string; percent: number | null; mentioned: number; answered: number }> }>;
  parties: Array<{ name: string; role: string; url: string | null; read: boolean }>;
  charged: number;
  llms?: string;
  negatives?: string[];
  clusters?: { asked: number; answered: number; probes_asked: number; probes_answered: number };
  diagnostics?: {
    market_probes: ProbeDiagnostics;
    cluster_probes: ProbeDiagnostics;
    pages: { urls: number; read: number; unread: number };
    social: { searched_parties: number; parties_with_results: number; results: number };
    alexandria: { connected: boolean; note: string };
  };
  context?: { brand: string; site: string; category: string; categorySource: string; marketSource: string };
};

function SecondResult({
  attachmentId, lang, workspaceId, workspaceContext, requestText, geoScope, workbookHints,
}: {
  attachmentId: string;
  lang: L;
  workspaceId: string | null;
  workspaceContext?: Workspace | null;
  requestText: string;
  geoScope: GeoScope;
  workbookHints: string[];
}) {
  const seed = resolveCompetitiveContext({
    workspace: workspaceContext as CompetitiveWorkspaceContext | null,
    requestText,
    workbookSignals: workbookHints,
  });
  const [brand, setBrand] = useState(seed.brand);
  const [site, setSite] = useState(seed.site);
  const [category, setCategory] = useState(seed.category);
  const [competitors, setCompetitors] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [needMarket, setNeedMarket] = useState(false);
  const [editContext, setEditContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<DualRes | null>(null);
  const hintsKey = workbookHints.join("\u0000");

  useEffect(() => {
    const resolved = resolveCompetitiveContext({
      workspace: workspaceContext as CompetitiveWorkspaceContext | null,
      requestText,
      workbookSignals: workbookHints,
    });
    setBrand((current) => current.trim() ? current : resolved.brand);
    setSite((current) => current.trim() ? current : resolved.site);
    setCategory((current) => current.trim() ? current : resolved.category);
  }, [workspaceContext, requestText, hintsKey]);

  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(withPreviewAuth("/api/dual-result"), {
        method: "POST",
        headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/json" },
        body: JSON.stringify({
          attachment_id: attachmentId,
          workspace_id: workspaceId || undefined,
          request_text: requestText,
          geo_scope: toServerGeoScope(geoScope),
          market_text: targetMarket,
          brand,
          site,
          category,
          competitors: competitors.split(/[,،\n]/).map((value) => value.trim()).filter(Boolean),
          lang,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j?.error === "no_market") setNeedMarket(true);
        if (j?.error === "category_required" || j?.error === "brand_required") setEditContext(true);
        const messages: Record<string, string> = {
          no_market: tr(lang, "لم أتمكن من تحديد السوق من الملف أو الطلب أو النطاق المختار. أدخل السوق المستهدف مرة واحدة.", "I could not determine the market from the workbook, request, or selected scope. Enter the target market once.", "نەتوانرا بازاڕ دیاری بکرێت؛ یەک جار بازاڕ بنووسە."),
          category_required: tr(lang, "لم أجد دليلًا كافيًا لتحديد المجال من مساحة العمل أو الملف. أدخل المجال فقط.", "I could not reliably infer the business category from the workspace or workbook. Enter only the category.", "بوارەکە لە پاشبنەما و فایلەوە دیاری نەکرا؛ تەنها بوار بنووسە."),
          brand_required: tr(lang, "تعذر استعادة اسم العلامة. أدخله مرة واحدة.", "The brand name could not be recovered. Enter it once.", "ناوی براند دیاری نەکرا؛ یەک جار بینووسە."),
          workspace_not_found: tr(lang, "تعذر التحقق من مساحة العمل المختارة. حدّث الصفحة ثم أعد المحاولة.", "The selected workspace could not be verified. Refresh and retry.", "شوێنی کار پشتڕاست نەکرایەوە."),
          attachment_workspace_mismatch: tr(lang, "الملف لا ينتمي إلى مساحة العمل الحالية؛ لم يُستخدم.", "This file does not belong to the active workspace and was not used.", "ئەم فایلە هی شوێنی کاری چالاک نییە."),
          not_found: tr(lang, "تعذر العثور على الملف المرفق.", "The attached file could not be found.", "فایلەکە نەدۆزرایەوە."),
          not_spreadsheet: tr(lang, "هذا المسار يحتاج إلى ملف Excel أو CSV.", "This research flow needs an Excel or CSV workbook.", "ئەم ڕێگایە فایلێکی Excel یان CSV دەوێت."),
          no_evidence: tr(lang, "لم تُجمع أدلة عامة كافية من الويب أو المحركات؛ لم يتم إنشاء تقرير تخميني.", "The web or engines returned no usable evidence, so no speculative report was created.", "بەڵگەی بەسوود بەدەست نەهات."),
        };
        setErr(messages[j?.error] || j?.ar || j?.error || tr(lang, "تعذر تنفيذ البحث.", "Research could not be completed.", "لێکۆڵینەوە تەواو نەبوو."));
        return;
      }
      setNeedMarket(false);
      setRes(j);
    } catch {
      setErr(tr(lang, "تعذر الاتصال بخدمة البحث.", "Could not connect to the research service.", "پەیوەندی بە خزمەتگوزاری گەڕان نەکرا."));
    } finally {
      setBusy(false);
    }
  };

  const autoResearch = shouldAutoStartKeywordResearch(requestText, workbookHints);
  const autoRunKey = useRef("");
  useEffect(() => {
    if (!autoResearch || res || busy) return;
    const signature = [
      attachmentId, requestText, hintsKey, brand, site, category, targetMarket, competitors,
      JSON.stringify(toServerGeoScope(geoScope)),
    ].join("\u0001");
    if (autoRunKey.current === signature) return;
    autoRunKey.current = signature;
    void run();
    // run is intentionally recreated with current form state; signature prevents duplicate execution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResearch, attachmentId, requestText, hintsKey, brand, site, category, targetMarket, competitors, res, busy, geoScope]);

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs";
  const scopeDisplay = getCompactGeoScopeDisplay(geoScope, lang);
  const showRequiredInputs = !brand.trim() || !category.trim() || needMarket;
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-background p-3">
      <p className="font-semibold text-foreground">{tr(lang, "تحليل العلامة والمنافسين لكل سوق", "Brand and competitor research by market", "لێکۆڵینەوەی براند و ڕکابەران بەپێی بازاڕ")}</p>
      <p className="mt-1 text-muted-foreground">{autoResearch
        ? tr(lang, "طلبت تحليل كلمات مفتاحية مع مخرجات Excel؛ سيبدأ البحث تلقائيًا باستخدام سياق الملف ومساحة العمل. إذا تعذر استعادة معلومة أساسية، سيطلبها معروف بدل افتراضها.", "You requested keyword analysis with an Excel output; research will start automatically using workbook and workspace context. If a required detail cannot be recovered, Maaroof will ask rather than assume it.", "داواتی شیکردنەوەی وشە و دەرئەنجامی Excel کراوە؛ گەڕان بە شێوەی خۆکار دەست پێدەکات. ئەگەر زانیارییەکی پێویست نەدۆزرایەوە، معروف دەیپرسێت.")
        : tr(lang, "سيستعيد معروف بيانات العميل والطلب والملف أولًا، ثم يكتشف المنافسين. لن يبدأ البحث المدفوع إلا عند الضغط على زر البدء.", "Maaroof will first reuse the client, request, and workbook context, then discover competitors. Research starts only when you click the button.", "معروف سەرەتا پاشبنەمای کڕیار و داواکاری و فایل بەکاردەهێنێت؛ گەڕان تەنها بە کرتەکردن دەست پێدەکات.")}</p>

      <div className="mt-3 grid gap-2 rounded-lg bg-muted/35 p-3 sm:grid-cols-2">
        <div><span className="text-muted-foreground">{tr(lang, "العلامة", "Brand", "براند")}:</span> <strong>{brand || tr(lang, "مطلوب", "Required", "پێویستە")}</strong></div>
        <div className="min-w-0"><span className="text-muted-foreground">{tr(lang, "الموقع", "Website", "ماڵپەڕ")}:</span> <span className="break-all">{site || tr(lang, "غير مسجل", "Not saved", "تۆمار نەکراوە")}</span></div>
        <div><span className="text-muted-foreground">{tr(lang, "المجال", "Category", "بوار")}:</span> <strong>{category || tr(lang, "مطلوب", "Required", "پێویستە")}</strong></div>
        <div><span className="text-muted-foreground">{tr(lang, "النطاق", "Scope", "سنوور")}:</span> <strong>{scopeDisplay.label}</strong></div>
        <div className="sm:col-span-2 text-muted-foreground">{tr(lang, "المنافسون", "Competitors", "ڕکابەران")}: {competitors.trim() || tr(lang, "سيتم اكتشافهم تلقائيًا؛ أدخل أسماء إضافية فقط إن أردت.", "Discovered automatically; add names only if needed.", "بە شێوەی خۆکار دەدۆزرێنەوە؛ ناوی زیادە تەنها ئەگەر بتەوێت.")}</div>
        {seed.categorySource === "inferred" && category && <p className="sm:col-span-2 text-[11px] text-muted-foreground">{tr(lang, "المجال مستنتج من مؤشرات الاسم والموقع والطلب أو الملف؛ راجعه إذا لم يكن دقيقًا.", "Category inferred from the name, website, request, or workbook; review it if inaccurate.", "بوارەکە لە نیشانەکانی ناو و ماڵپەڕ و فایلەوە خەمڵێنراوە.")}</p>}
      </div>

      {(showRequiredInputs || editContext) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(!brand.trim() || editContext) && <input className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={tr(lang, "اسم العلامة التجارية", "Brand name", "ناوی براند")} />}
          {(!category.trim() || editContext) && <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder={tr(lang, "المجال التجاري", "Business category", "بوار")} />}
          {needMarket && <input className={inputClass} value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)} placeholder={tr(lang, "السوق المستهدف، مثل United States أو العراق", "Target market, e.g. United States or Iraq", "بازاڕی ئامانج")} />}
          {editContext && <>
            <input className={inputClass} value={site} onChange={(e) => setSite(e.target.value)} placeholder={tr(lang, "رابط الموقع (اختياري)", "Website (optional)", "ماڵپەڕ")} dir="ltr" />
            <input className={inputClass} value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder={tr(lang, "منافسون إضافيون (اختياري)", "Additional competitors (optional)", "ڕکابەری زیادە")} />
            {!needMarket && <input className={inputClass} value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)} placeholder={tr(lang, "تحديد سوق إضافي (اختياري)", "Optional market override", "بازاڕی زیادە")} />}
          </>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setEditContext((value) => !value)} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {editContext ? tr(lang, "إخفاء التعديل", "Hide edits", "شاردنەوەی دەستکاری") : tr(lang, "تعديل بيانات البحث (اختياري)", "Edit research details (optional)", "دەستکاری زانیاری گەڕان")}
        </button>
        <button type="button" disabled={busy || !brand.trim() || !category.trim() || (needMarket && !targetMarket.trim())} onClick={run} className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{tr(lang, "جارٍ البحث والتحقق…", "Researching and verifying…", "گەڕان و پشتڕاستکردنەوە…")}</> : tr(lang, "ابدأ البحث", "Start research", "دەستپێبکە")}
        </button>
      </div>
      {busy && (
        <div role="status" aria-live="polite" className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            {tr(lang, "مسار البحث قيد التنفيذ", "Research workflow is running", "ڕێڕەوی گەڕان لە جێبەجێکردندایە")}
          </div>
          <p className="mt-1 text-muted-foreground">{tr(lang, "يشمل المسار قراءة الكلمات حسب السوق، واختبار المحركات ومجموعات الكلمات، وقراءة صفحات المصادر، ثم بناء ملف Excel. ستظهر أعداد الإجابات والأخطاء الفعلية بعد اكتمال الطلب.", "The workflow reads market-specific keywords, probes engines and keyword clusters, reads available source pages, then builds the Excel workbook. Actual answer and error counts appear when the request finishes.", "ڕێڕەوەکە وشەکان بەپێی بازاڕ دەخوێنێتەوە، بزوێنەر و کۆمەڵە وشەکان تاقی دەکاتەوە، پەڕەی سەرچاوەکان دەخوێنێتەوە، پاشان فایلی Excel دروست دەکات. ژمارەی وەڵام و هەڵە دوای تەواوبوونی داواکاری دەردەکەوێت.")}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-pulse rounded-full bg-primary/70" /></div>
        </div>
      )}
      {err && <p className="mt-2 text-destructive">{err}</p>}
      {res && (
        <div className="mt-2 space-y-2">
          {res.context && <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-muted-foreground">{tr(lang, "سياق التحليل الفعلي", "Resolved analysis context", "پاشبنەمای شیکردنەوە")}: {res.context.brand} · {res.context.category} · {res.context.marketSource}</div>}
          {res.diagnostics && (
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="font-semibold">{tr(lang, "حالة التنفيذ والأدلة", "Execution and evidence status", "دۆخی جێبەجێکردن و بەڵگە")}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="font-medium">{tr(lang, "استعلامات المحركات حسب السوق", "Market engine probes", "تاقیکردنەوەی بزوێنەر بەپێی بازاڕ")}</p>
                  <p className="mt-1 text-muted-foreground">{res.diagnostics.market_probes.answered}/{res.diagnostics.market_probes.asked} {tr(lang, "إجابة", "answered", "وەڵام")}; {res.diagnostics.market_probes.no_answer} {tr(lang, "بلا إجابة", "no answer", "بێ وەڵام")}; {res.diagnostics.market_probes.empty} {tr(lang, "فارغة", "empty", "بەتاڵ")}; {res.diagnostics.market_probes.timeout} {tr(lang, "انتهاء مهلة", "timeouts", "کاتی تەواوبوون")}; {res.diagnostics.market_probes.http_error} HTTP; {res.diagnostics.market_probes.error} {tr(lang, "أخطاء أخرى", "other errors", "هەڵەی تر")}</p>
                </div>
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="font-medium">{tr(lang, "استعلامات مجموعات الكلمات", "Keyword cluster probes", "تاقیکردنەوەی کۆمەڵە وشەکان")}</p>
                  <p className="mt-1 text-muted-foreground">{res.diagnostics.cluster_probes.answered}/{res.diagnostics.cluster_probes.asked} {tr(lang, "إجابة", "answered", "وەڵام")}; {res.diagnostics.cluster_probes.no_answer} {tr(lang, "بلا إجابة", "no answer", "بێ وەڵام")}; {res.diagnostics.cluster_probes.empty} {tr(lang, "فارغة", "empty", "بەتاڵ")}; {res.diagnostics.cluster_probes.timeout} {tr(lang, "انتهاء مهلة", "timeouts", "کاتی تەواوبوون")}; {res.diagnostics.cluster_probes.http_error} HTTP; {res.diagnostics.cluster_probes.error} {tr(lang, "أخطاء أخرى", "other errors", "هەڵەی تر")}</p>
                </div>
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="font-medium">{tr(lang, "قراءة صفحات المصادر", "Source page reads", "خوێندنەوەی پەڕەی سەرچاوە")}</p>
                  <p className="mt-1 text-muted-foreground">{res.diagnostics.pages.read}/{res.diagnostics.pages.urls} {tr(lang, "صفحة مقروءة", "pages read", "پەڕە خوێندراوە")}; {res.diagnostics.pages.unread} {tr(lang, "رابط بلا نص مستخرج", "URLs without extracted text", "بەستەر بەبێ دەقی وەرگیراو")}</p>
                </div>
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="font-medium">{tr(lang, "نتائج البحث الاجتماعي", "Social search results", "ئەنجامی گەڕانی سۆشیال")}</p>
                  <p className="mt-1 text-muted-foreground">{res.diagnostics.social.results} {tr(lang, "نتيجة مسجلة", "results recorded", "ئەنجام تۆمارکراوە")} · {res.diagnostics.social.parties_with_results}/{res.diagnostics.social.searched_parties} {tr(lang, "جهة لها نتائج", "parties with results", "لایەن ئەنجامی هەیە")}</p>
                </div>
                <div className="rounded-md bg-muted/30 p-2 sm:col-span-2">
                  <p className="font-medium">{tr(lang, "مصدر البيانات الاختياري", "Optional evidence connector", "پەیوەندی بەڵگەی هەڵبژاردە")}</p>
                  <p className="mt-1 text-muted-foreground">{res.diagnostics.alexandria.connected ? tr(lang, "متصل", "Connected", "پەیوەستە") : tr(lang, "غير متصل أو لم يقدم أدلة قابلة للاستخدام", "Not connected or no usable evidence returned", "پەیوەست نییە یان بەڵگەی بەسوود نەگەڕێندراوەتەوە")} {res.diagnostics.alexandria.note ? "— " + res.diagnostics.alexandria.note : ""}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{tr(lang, "«إجابة» تعني أن النص وصل فقط؛ لا تعني أن المحرك ذكر العلامة أو أن ترتيبها قيس. التفاصيل والأسئلة الفعلية مسجلة في ملف Excel.", "“Answered” means text was returned; it does not mean the engine mentioned the brand or that a ranking was measured. Exact prompts and detail are in the Excel file.", "«وەڵام» واتای گەیشتنی دەقە؛ واتای باسکردنی براند یان پێوانەکردنی ڕیزبەندی نییە. وردەکاری و پرسیارە ڕاستەقینەکان لە فایلی Excel تۆمارکراون.")}</p>
            </div>
          )}
          {res.summary.map((s) => (
            <div key={s.market} className="rounded-lg bg-muted/30 px-2 py-1">
              <span className="font-medium">{s.label}</span>: {s.voice.map((v) => v.name + " " + (v.percent === null ? tr(lang, "غير متوفر", "n/a", "نییە") : String(v.percent) + "% (" + v.mentioned + "/" + v.answered + ")")).join(" · ")}
            </div>
          ))}
          <ul className="space-y-0.5">{res.parties.map((p, i) => <li key={i}>{p.name} — {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="text-primary underline" dir="ltr">{p.url}</a> : tr(lang, "لم يُعثر على رابط موثوق", "No verified URL found", "بەستەری پشتڕاستکراو نەدۆزرایەوە")} {!p.read && " (" + tr(lang, "لم تُقرأ الصفحة", "page not read", "نەخوێندرایەوە") + ")"}</li>)}</ul>
          <div className="flex flex-wrap gap-1">
            {res.llms && <button type="button" onClick={() => navigator.clipboard.writeText(res.llms!)} className="rounded-lg border border-border px-2 py-1 text-xs">{tr(lang, "نسخ llms.txt", "Copy llms.txt", "کۆپی llms.txt")}</button>}
            {!!res.negatives?.length && <button type="button" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([res.negatives!.join("\n")], { type: "text/plain" })); a.download = "negative-keywords.txt"; a.click(); }} className="rounded-lg border border-border px-2 py-1 text-xs">{tr(lang, "تحميل الكلمات السلبية", "Download negative keywords", "داگرتنی وشە نەرێنییەکان")}</button>}
          </div>
          <ExportButtons size="xs" build={() => res.payload} />
        </div>
      )}
    </div>
  );
}
