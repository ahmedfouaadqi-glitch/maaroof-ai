import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Send, Trash2, Paperclip, X, ListChecks, XCircle } from "lucide-react";
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

type Quota = { unlimited: boolean; cap: number; remaining: number | null; resets_at: string };
type L = "ar" | "en" | "ku";
type Task = { kind: "scan" | "plan" | "recommend" | "simulate"; goal: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; needs_task?: boolean; task?: Task | null };
type ChatTaskDraft = { messageKey: string; goal: string };
type Att = DardashaAttachment & { busy?: boolean; failed?: boolean };
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
const token = async () => (await supabase.auth.getSession()).data.session?.access_token || "";

async function call(method: string, body?: unknown, workspaceId?: string | null) {
  const t = await token();
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : "";
  const res = await fetch(withPreviewAuth("/api/maaroof-chat" + query), { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

/** «دردشة»: one surface for chat, files and tasks. A task starts only after the user clicks approve. */
export function Dardasha({
  lang, onPrepareTask, busyTask, workspaceId = null, geoScope, onGeoScopeChange, chatPrefill, onPrefillConsumed,
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
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTaskDraft(null); void call("GET", undefined, workspaceId).then((r) => { if (!r.ok) return; setQuota(r.json.quota || null); setMsgs((r.json.items || []).map((m: any) => ({ ...m, needs_task: m.grounded?.needs_task, task: m.grounded?.task || null }))); }); }, [workspaceId]);
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
      setMsgs((p) => [...p, { role: "assistant", content: r.json.text, needs_task: r.json.needs_task, task: r.json.task || null }]);
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
      className={`rb-workspace-fade rounded-2xl border bg-card p-4 shadow-sm transition md:p-5 ${drag ? "border-primary ring-4 ring-primary/20" : "border-border"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{tr(lang, "دردشة", "Dardasha", "دردشە")}</h2>
          <p className="text-xs text-muted-foreground">{tr(lang, "اكتب، الصق، أو اسحب ملفاً. معروف يفهم طلبك ويختار المهارات والأدوات بنفسه، ولا يبدأ أي مهمة إلا بموافقتك.", "Type, paste or drop a file. Maaroof understands, picks skills and tools itself, and starts nothing without your approval.", "بنووسە، بلکێنە یان فایل ڕابکێشە. معروف بەبێ ڕەزامەندیت هیچ دەست پێناکات.")}</p>
        </div>
        <div className="flex items-center gap-2">
          {quota && <span className="rounded-full bg-muted px-3 py-1 text-xs tabular-nums">{(quota as any).approved ? tr(lang, "غير محدود", "Unlimited", "بێسنوور") : quota.unlimited ? tr(lang, "من رصيدك عند النجاح", "From balance on success", "لە باڵانس") : `${quota.remaining}/${quota.cap}`}</span>}
          {msgs.length > 0 && <button type="button" onClick={async () => { if (window.confirm(tr(lang, "حذف المحادثة؟", "Clear chat?", "سڕینەوە؟"))) { await call("DELETE", undefined, workspaceId); setMsgs([]); } }} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="clear"><Trash2 className="size-4" /></button>}
        </div>
      </div>
      <div className="mb-4 rounded-xl border border-border bg-background/50 p-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">{tr(lang, "النطاق الجغرافي الذي سيُوجّه الدردشة والبحث", "Geographic scope for chat and research", "بواری جوگرافی بۆ گفتوگۆ و گەڕان")}</div>
        <GeoScopeSelector compact value={geoScope} onChange={onGeoScopeChange} />
      </div>
      <div ref={boxRef} style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }} className="max-h-[60vh] space-y-3 overflow-y-auto overscroll-contain rounded-xl bg-background p-3">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">{tr(lang, "مثال: «افحص ظهور علامتي في ChatGPT» أو «عميل لديه حساب إنستغرام فقط، ماذا نفعل؟»", "Example: “Check my brand in ChatGPT”", "نموونە: «براندەکەم بپشکنە»")}</p>}
        {busy && <div role="status" aria-live="polite" className="mb-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><LoaderCircle className="size-4 animate-spin" />{tr(lang, "بطاقة الأداة: استشارة معروف", "Tool card: Maaroof consultation", "کارتی ئامراز: ڕاوێژکاری معروف")}</div>
          <p className="mt-1 text-xs text-muted-foreground">{tr(lang, "يُرسل الطلب ويُنتظر الرد. هذا مؤشر نشاط حي وليس نسبة إنجاز محسوبة من الخادم.", "The request is running. This is a live activity indicator, not a server-measured completion percentage.", "داواکاری لە جێبەجێکردندایە. ئەمە نیشاندەری چالاکییە، نە ڕێژەی تەواوبوونی پێوانەکراو.")}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={tr(lang, "نشاط الاستشارة", "Consultation activity", "چالاکی ڕاوێژکاری")}>
            <div className="h-full w-1/3 rounded-full bg-primary animate-[pulse_1.2s_ease-in-out_infinite]" />
          </div>
          <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground">{tr(lang, "عرض مراحل النشاط", "Show activity stages", "پیشاندانی قۆناغەکان")}</summary><ol className="mt-2 list-decimal space-y-1 ps-5"><li>{tr(lang, "استلام الطلب والسياق", "Receive request and context", "وەرگرتنی داواکاری و پاشبنەما")}</li><li className="font-semibold text-primary">{tr(lang, "استشارة النموذج وصياغة الرد", "Consult model and draft response", "ڕاوێژ لەگەڵ مۆدێل و ئامادەکردنی وەڵام")}</li><li>{tr(lang, "عرض النتيجة أو اقتراح مهمة تتطلب موافقتك", "Show a result or propose a task requiring your approval", "پیشاندانی ئەنجام یان پێشنیاری ئەرک بە ڕەزامەندی تۆ")}</li></ol></details>
        </div>}
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
          <div key={messageKey} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-full min-w-0 text-sm leading-7"}>
              {m.role === "assistant" ? <AssistantMessage content={m.content} lang={lang} /> : m.content}
              {m.role === "assistant" && m.content.trim() && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ExportButtons size="xs" build={() => ({ title: tr(lang, "استشارة معروف", "Maaroof consultation", "ڕاوێژکاری معروف"), lang, sections: [{ heading: tr(lang, "النتيجة", "Result", "ئەنجام"), kind: "text", text: m.content }] })} />
                  {!m.task && !m.needs_task && <button type="button" disabled={busyTask} onClick={() => openTaskDraft()} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"><ListChecks className="size-3.5" />{tr(lang, "حوّل الرد إلى مهمة", "Turn answer into a task", "وەڵامەکە بکە بە ئەرک")}</button>}
                </div>
              )}
              {m.role === "assistant" && (m.task || m.needs_task) && (
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
        {busy && <div role="status" aria-live="polite" className="rounded-xl border border-primary/25 bg-primary/5 p-3"><div className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin text-primary" /><ShinyText>{tr(lang, "معروف يحلل طلبك ويجهّز الاستشارة…", "Maaroof is analyzing your request and preparing the consultation…", "معروف داواکارییەکەت شیدەکاتەوە…")}</ShinyText></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/5 rounded-full bg-primary animate-pulse" /></div><p className="mt-1 text-[11px] text-muted-foreground">{tr(lang, "هذه إشارة نشاط وليست نسبة إنجاز محسوبة.", "Activity indicator, not a measured completion percentage.", "ئەمە نیشانەی چالاکییە، نەک ڕێژەی تەواوبوونی پێوانەکراو.")}</p></div>}
        <div ref={endRef} />
      </div>
      {atts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {atts.map((a, i) => (
            <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${a.failed ? "border-destructive text-destructive" : "border-border"}`}>
              {a.busy ? <LoaderCircle className="size-3 animate-spin" /> : <Paperclip className="size-3" />}{a.name}{a.failed ? ` · ${tr(lang, "تعذّر، لم يُخصم", "failed, not charged", "شکستی هێنا")}` : ""}
              <button type="button" onClick={() => setAtts((p) => p.filter((_, j) => j !== i))} aria-label="remove"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex items-end gap-2">
        <input ref={fileRef} type="file" multiple accept={ATTACHMENT_MIME.join(",")} className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted" aria-label="attach"><Paperclip className="size-4" /></button>
        <textarea id="dardasha-message-input" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const fs = Array.from(e.clipboardData.files || []); if (fs.length) { e.preventDefault(); void addFiles(fs); } }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={3} placeholder={tr(lang, "اكتب، الصق، أو اسحب ملفاً هنا…", "Type, paste or drop a file…", "بنووسە…")}
          className="min-h-20 flex-1 resize-none rounded-2xl border-2 border-border bg-background px-4 py-3 text-base leading-7 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15" />
        <button type="button" onClick={() => void send()} disabled={busy || (!text.trim() && !atts.some((a) => !a.busy && !a.failed))} className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50" aria-label="send"><Send className="size-5" /></button>
      </div>
    </section>
  );
}
