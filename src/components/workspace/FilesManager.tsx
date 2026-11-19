import { useEffect, useState } from "react";
import { X, FileText, Eye, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HelpTip } from "./HelpTip";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
type Row = {
  id: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
  status: string;
  analysis: string | null;
  path: string;
};

/** In-workspace file manager: lists the user's uploads and shows analysis without deleting retained files. */
export function FilesManager({
  lang,
  onClose,
  workspaceId = null,
}: {
  lang: L;
  onClose: () => void;
  workspaceId?: string | null;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [view, setView] = useState<Row | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    let query = supabase
      .from("task_attachments")
      .select("id,name,mime,size,created_at,status,analysis,path,workspace_id")
      .eq("user_id", user.id);
    query = workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
    query
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        setRows((data as Row[]) || []);
      });
  }, [user?.id, workspaceId]);

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
          <p className="mb-2 text-xs text-muted-foreground">{tr(lang, "الحذف معطل لحماية ملفات العميل وسجلاته.", "Deletion is disabled to preserve client files and history.", "سڕینەوە ناچالاکە بۆ پاراستنی فایل و مێژووی کڕیار.")}</p>
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
