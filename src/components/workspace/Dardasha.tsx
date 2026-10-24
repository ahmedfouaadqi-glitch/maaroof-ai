import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Send, Trash2, Play, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withPreviewAuth } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { validateAttachment, attachmentPath, ATTACHMENT_MIME } from "@/lib/attachments";
import { composeChatMessage, type DardashaAttachment } from "@/lib/maaroof/dardasha";
import { ShinyText } from "@/components/motion/effects";

type Quota = { unlimited: boolean; cap: number; remaining: number | null; resets_at: string };
type L = "ar" | "en" | "ku";
type Task = { kind: "scan" | "plan" | "recommend" | "simulate"; goal: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; needs_task?: boolean; task?: Task | null };
type Att = DardashaAttachment & { busy?: boolean; failed?: boolean };
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
const token = async () => (await supabase.auth.getSession()).data.session?.access_token || "";

async function call(method: string, body?: unknown) {
  const t = await token();
  const res = await fetch(withPreviewAuth("/api/maaroof-chat"), { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

/** «دردشة»: one surface for chat, files and tasks. A task starts only after the user clicks approve. */
export function Dardasha({ lang, onApproveTask, busyTask }: { lang: L; onApproveTask: (goal: string) => void; busyTask?: boolean }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [drag, setDrag] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void call("GET").then((r) => { if (!r.ok) return; setQuota(r.json.quota || null); setMsgs((r.json.items || []).map((m: any) => ({ ...m, needs_task: m.grounded?.needs_task, task: m.grounded?.task || null }))); }); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  const addFiles = async (files: File[]) => {
    if (!user) return;
    for (const f of files) {
      if (validateAttachment(f) !== "ok") { setErr(tr(lang, `«${f.name}» غير مدعوم (صورة، PDF أو نص حتى 10MB).`, `"${f.name}" unsupported (image, PDF or text up to 10MB).`, `«${f.name}» پشتگیری ناکرێت.`)); continue; }
      const name = f.name || "paste.png";
      setAtts((p) => [...p, { name, analysis: "", busy: true }]);
      try {
        const path = attachmentPath(user.id, name, Date.now());
        const up = await supabase.storage.from("task-files").upload(path, f, { contentType: f.type });
        if (up.error) throw new Error("upload");
        const r = await fetch(withPreviewAuth("/api/attachment-analyze"), { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ path, name, mime: f.type, question: text, lang }) });
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
    setText(""); setAtts([]); setErr(""); setBusy(true);
    setMsgs((p) => [...p, { role: "user", content: m }]);
    const r = await call("POST", { message: m, lang });
    setBusy(false); inputRef.current?.focus();
    if (!r.ok) {
      const e = r.json?.error;
      setErr(e === "chat_limit" ? tr(lang, "انتهى حد المحادثة لليوم.", "Daily chat limit reached.", "سنووری ڕۆژانە تەواو بوو.")
        : r.status === 402 ? tr(lang, "الرصيد غير كافٍ. لم يُخصم شيء.", "Not enough balance. Nothing was charged.", "باڵانس بەس نییە.")
        : tr(lang, "تعذّر الرد الآن، لم يُخصم شيء. حاول مجدداً.", "Couldn't reply; nothing charged.", "وەڵام نەدرایەوە."));
      return;
    }
    if (r.json.quota) setQuota(r.json.quota);
    setMsgs((p) => [...p, { role: "assistant", content: r.json.text, needs_task: r.json.needs_task, task: r.json.task || null }]);
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
          {quota && <span className="rounded-full bg-muted px-3 py-1 text-xs tabular-nums">{quota.unlimited ? tr(lang, "من رصيدك عند النجاح", "From balance on success", "لە باڵانس") : `${quota.remaining}/${quota.cap}`}</span>}
          {msgs.length > 0 && <button type="button" onClick={async () => { if (window.confirm(tr(lang, "حذف المحادثة؟", "Clear chat?", "سڕینەوە؟"))) { await call("DELETE"); setMsgs([]); } }} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="clear"><Trash2 className="size-4" /></button>}
        </div>
      </div>
      <div className="max-h-[55vh] min-h-48 space-y-3 overflow-y-auto rounded-xl bg-background p-3">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">{tr(lang, "مثال: «افحص ظهور علامتي في ChatGPT» أو «عميل لديه حساب إنستغرام فقط، ماذا نفعل؟»", "Example: “Check my brand in ChatGPT”", "نموونە: «براندەکەم بپشکنە»")}</p>}
        {msgs.map((m, i) => (
          <div key={m.id || i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-full whitespace-pre-wrap text-sm leading-7"}>
              {m.content}
              {m.role === "assistant" && (m.task || m.needs_task) && (
                <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs">
                  <p className="font-semibold text-primary">{tr(lang, "مهمة مقترحة", "Proposed task", "ئەرکی پێشنیارکراو")}{m.task ? ` · ${kindLabel[m.task.kind] || ""}` : ""}</p>
                  <p className="mt-1 text-foreground">{m.task?.goal || lastUser}</p>
                  <p className="mt-1 text-muted-foreground">{tr(lang, "ستمر بالمراحل الست: فهم الطلب ← الخطة والأدوات ← جمع الأدلة ← النماذج العشرة ← حل التعارض ← النتيجة. لا يُخصم شيء إلا عند النجاح.", "Six stages: understand → plan & tools → evidence → ten engines → resolve conflicts → result. Charged only on success.", "شەش قۆناغ. تەنها لە سەرکەوتندا دەبڕدرێت.")}</p>
                  <button type="button" disabled={busyTask} onClick={() => onApproveTask(m.task?.goal || lastUser)} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-50"><Play className="size-3" />{tr(lang, "موافقة وبدء", "Approve and start", "پەسەندکردن و دەستپێکردن")}</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin text-primary" /><ShinyText>{tr(lang, "معروف يفهم طلبك…", "Maaroof is understanding…", "معروف تێدەگات…")}</ShinyText></div>}
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
        <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const fs = Array.from(e.clipboardData.files || []); if (fs.length) { e.preventDefault(); void addFiles(fs); } }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={2} placeholder={tr(lang, "اكتب، الصق، أو اسحب ملفاً هنا…", "Type, paste or drop a file…", "بنووسە…")}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <button type="button" onClick={() => void send()} disabled={busy || (!text.trim() && !atts.some((a) => !a.busy && !a.failed))} className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50" aria-label="send"><Send className="size-4" /></button>
      </div>
    </section>
  );
}
