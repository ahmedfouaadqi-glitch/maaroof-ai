import { useEffect, useState } from "react";
import { X, FileText, Trash2, Eye, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HelpTip } from "./HelpTip";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
type Row = { id: string; name: string; mime: string; size: number; created_at: string; status: string; analysis: string | null; path: string };

/** In-workspace file manager: lists the user's uploads, shows analysis, deletes after confirmation. */
export function FilesManager({ lang, onClose }: { lang: L; onClose: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [view, setView] = useState<Row | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("task_attachments").select("id,name,mime,size,created_at,status,analysis,path").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }) => { if (error) setErr(error.message); setRows((data as Row[]) || []); });
  }, [user?.id]);

  async function remove(r: Row) {
    if (!confirm(tr(lang, `حذف «${r.name}» نهائياً؟`, `Delete "${r.name}" permanently?`, `«${r.name}» بسڕدرێتەوە؟`))) return;
    await supabase.storage.from("task-files").remove([r.path]);
    const { error } = await supabase.from("task_attachments").delete().eq("id", r.id);
    if (error) { setErr(tr(lang, "تعذر الحذف.", "Could not delete.", "نەسڕایەوە.")); return; }
    setRows((rs) => (rs || []).filter((x) => x.id !== r.id));
    if (view?.id === r.id) setView(null);
  }

  const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border p-4">
          <FileText className="size-5 text-primary" />
          <h2 className="font-semibold">{tr(lang, "إدارة الملفات", "Manage files", "بەڕێوەبردنی فایل")}</h2>
          <HelpTip id="files" lang={lang} />
          <button type="button" onClick={onClose} aria-label="close" className="ms-auto rounded-lg p-1 hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-4">
          {err && <p role="alert" className="mb-2 text-xs text-destructive">{err}</p>}
          {rows === null ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr(lang, "لم ترفع أي ملف بعد. ارفع ملفاً أو صورة من صندوق المهمة أو المقابلة.", "No files yet. Upload one from the task box or the interview.", "هێشتا فایل نییە.")}</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium" dir="auto">{r.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.analysis ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.analysis ? tr(lang, "محلَّل", "Analyzed", "شیکراوە") : tr(lang, "غير محلَّل", "Not analyzed", "شینەکراوە")}</span>
                    <button type="button" onClick={() => setView(view?.id === r.id ? null : r)} disabled={!r.analysis} className="rounded-lg p-1 hover:bg-muted disabled:opacity-30" aria-label="view"><Eye className="size-4" /></button>
                    <button type="button" onClick={() => void remove(r)} className="rounded-lg p-1 text-destructive hover:bg-destructive/10" aria-label="delete"><Trash2 className="size-4" /></button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{r.mime} · {kb(r.size)} · {new Date(r.created_at).toLocaleDateString(lang === "en" ? "en" : "ar-IQ")}</p>
                  {view?.id === r.id && r.analysis && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-2 text-xs leading-5" dir="auto">{r.analysis}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
