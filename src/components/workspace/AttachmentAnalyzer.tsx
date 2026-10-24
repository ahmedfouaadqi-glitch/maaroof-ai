import { useEffect, useRef, useState } from "react";
import { Paperclip, LoaderCircle, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { withPreviewAuth } from "@/lib/api-client";
import { validateAttachment, attachmentPath, ATTACHMENT_MIME } from "@/lib/attachments";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

/** Upload an image/PDF/text and have Maaroof analyze it. Cost shown first; charged on success only. */
export function AttachmentAnalyzer({ lang, context = "task", onResult }: { lang: L; context?: "task" | "interview"; onResult?: (text: string) => void }) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [cost, setCost] = useState<{ cost: number; balance: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<{ analysis: string; charged: number } | null>(null);

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || "";
  useEffect(() => {
    if (!file) return;
    (async () => { const r = await fetch(withPreviewAuth("/api/attachment-analyze"), { headers: { Authorization: `Bearer ${await token()}` } }); if (r.ok) setCost(await r.json()); })().catch(() => {});
  }, [file]);

  const pick = (f: File | undefined) => {
    setMsg(""); setResult(null);
    if (!f) return;
    const v = validateAttachment(f);
    if (v !== "ok") { setMsg(v === "too_large" ? tr(lang, "الحد الأقصى 10MB", "Max 10MB", "زۆرترین 10MB") : tr(lang, "نوع غير مدعوم: صورة أو PDF أو نص فقط", "Unsupported: image, PDF or text only", "جۆری پشتگیرینەکراو")); return; }
    setFile(f);
  };

  const run = async () => {
    if (!file || !user) return;
    setBusy(true); setMsg("");
    try {
      const path = attachmentPath(user.id, file.name, Date.now());
      const up = await supabase.storage.from("task-files").upload(path, file, { contentType: file.type });
      if (up.error) throw new Error("upload");
      const r = await fetch(withPreviewAuth("/api/attachment-analyze"), {
        method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path, name: file.name, mime: file.type, question, context, lang }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "failed");
      setResult({ analysis: j.analysis, charged: j.charged || 0 });
      onResult?.(j.analysis);
    } catch (e: any) {
      const code = String(e?.message);
      setMsg(code === "balance" ? tr(lang, "الرصيد غير كافٍ.", "Not enough balance.", "باڵانس بەس نییە.") : tr(lang, "تعذّر التحليل ولم يُخصم شيء.", "Analysis failed — nothing was charged.", "شکستی هێنا، هیچ نەبڕدرا."));
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4 text-primary" />{tr(lang, "إرفاق صورة أو ملف للتحليل", "Attach an image or file", "هاوپێچکردنی وێنە یان فایل")}</h3>
        <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">{tr(lang, "اختيار ملف", "Choose file", "هەڵبژاردن")}</button>
        <input ref={inputRef} type="file" accept={ATTACHMENT_MIME.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{tr(lang, "صورة أو PDF أو نص حتى 10MB. يحلّله نموذج معروف القادر على قراءة الصور؛ النماذج العشرة في فحص الظهور لا تستقبل الصور، لذا لا تُرسل إليها.", "Image, PDF or text up to 10MB. Analyzed by Maaroof's vision model; the ten visibility engines don't accept images, so files are not sent to them.", "وێنە، PDF یان دەق تا 10MB.")}</p>
      {file && (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-2 text-xs">{file.type.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}{file.name} · {(file.size / 1024).toFixed(0)}KB</p>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={tr(lang, "ماذا تريد أن تعرف من هذا الملف؟ (اختياري)", "What do you want to know from it? (optional)", "پرسیار (ئارەزوومەندانە)")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          {cost && <p className="text-xs text-muted-foreground">{tr(lang, "الكلفة", "Cost", "تێچوون")}: {cost.cost} · {tr(lang, "رصيدك", "Balance", "باڵانس")}: {cost.balance} — {tr(lang, "تُخصم عند النجاح فقط", "charged only on success", "تەنها لە سەرکەوتندا")}</p>}
          <button type="button" disabled={busy} onClick={run} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy && <LoaderCircle className="size-3.5 animate-spin" />}{tr(lang, "موافقة وتحليل", "Approve & analyze", "ڕەزامەندی و شیکردنەوە")}</button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-destructive">{msg}</p>}
      {result && <div className="mt-3 rounded-xl border border-border bg-background p-3 text-sm"><p className="whitespace-pre-wrap leading-6">{result.analysis}</p><p className="mt-2 text-[11px] text-muted-foreground">{tr(lang, "خُصم", "Charged", "بڕدرا")}: {result.charged}</p></div>}
    </div>
  );
}
