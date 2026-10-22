import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Send, Trash2, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withPreviewAuth } from "@/lib/api-client";

type L = "ar" | "en" | "ku";
type Msg = { id?: string; role: "user" | "assistant"; content: string; needs_task?: boolean };
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

async function call(method: string, body?: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(withPreviewAuth("/api/maaroof-chat"), { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

/** Grounded chat with Maaroof: answers from the knowledge space; escalates to a task when research is needed. */
export function MaaroofChat({ lang, onToTask }: { lang: L; onToTask: (goal: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { void call("GET").then((r) => r.ok && setMsgs((r.json.items || []).map((m: any) => ({ ...m, needs_task: m.grounded?.needs_task })))); inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  const send = async () => {
    const m = text.trim(); if (!m || busy) return;
    setText(""); setErr(""); setBusy(true);
    setMsgs((p) => [...p, { role: "user", content: m }]);
    const r = await call("POST", { message: m, lang });
    setBusy(false); inputRef.current?.focus();
    if (!r.ok) {
      const e = r.json?.error;
      setErr(e === "chat_limit" ? tr(lang, "انتهى حد المحادثة المجاني لليوم. اشترك أو عُد غداً.", "Free daily chat limit reached.", "سنووری ڕۆژانە تەواو بوو.")
        : r.status === 402 ? tr(lang, "الرصيد غير كافٍ لهذه الرسالة. لم يُخصم شيء.", "Not enough balance. Nothing was charged.", "باڵانس بەس نییە.")
        : tr(lang, "تعذّر الرد الآن، لم يُخصم شيء. حاول مجدداً.", "Couldn't reply; nothing charged. Try again.", "وەڵام نەدرایەوە."));
      return;
    }
    setMsgs((p) => [...p, { role: "assistant", content: r.json.text, needs_task: r.json.needs_task }]);
  };

  const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content || "";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{tr(lang, "محادثة مع معروف", "Chat with Maaroof", "گفتوگۆ لەگەڵ معروف")}</h2>
          <p className="text-xs text-muted-foreground">{tr(lang, "يجيب مما تعلّمه في مساحة المعرفة فقط. إن احتاج بحثاً أو فحص النماذج العشرة يقترح تحويلها لمهمة بكلفة واضحة.", "Answers only from your knowledge space. If research or the ten-engine check is needed, it suggests a task with a clear cost.", "تەنها لە زانیارییەکانی تۆ وەڵام دەداتەوە.")}</p>
        </div>
        {msgs.length > 0 && <button type="button" onClick={async () => { if (window.confirm(tr(lang, "حذف المحادثة؟", "Clear chat?", "سڕینەوە؟"))) { await call("DELETE"); setMsgs([]); } }} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="clear"><Trash2 className="size-4" /></button>}
      </div>
      <div className="max-h-[55vh] min-h-48 space-y-3 overflow-y-auto rounded-xl bg-background p-3">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">{tr(lang, "مثال: «ماذا تعرف عن علامتي؟» أو «ما الذي ينقص ملفي ليقتبسني ChatGPT؟»", "Example: “What do you know about my brand?”", "نموونە: «چی دەزانیت دەربارەی براندەکەم؟»")}</p>}
        {msgs.map((m, i) => (
          <div key={m.id || i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-full whitespace-pre-wrap text-sm leading-7"}>
              {m.content}
              {m.role === "assistant" && m.needs_task && (
                <button type="button" onClick={() => onToTask(lastUser)} className="mt-2 flex items-center gap-1 rounded-lg border border-primary/40 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"><ArrowLeftRight className="size-3" />{tr(lang, "حوّلها إلى مهمة (تُعرض الكلفة قبل التنفيذ)", "Turn into a task (cost shown first)", "بیکە بە ئەرک")}</button>
              )}
            </div>
          </div>
        ))}
        {busy && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
        <div ref={endRef} />
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex items-end gap-2">
        <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={2} placeholder={tr(lang, "اكتب رسالتك…", "Type a message…", "پەیامەکەت بنووسە…")} className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <button type="button" onClick={() => void send()} disabled={busy || !text.trim()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50" aria-label="send"><Send className="size-4" /></button>
      </div>
    </section>
  );
}
