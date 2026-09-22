import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";
import { useExportConfig, useExportOverride, isToolExportEnabled } from "@/lib/content";
import type { ExportPayload } from "@/lib/exports";
import {
  listToolHistory,
  getToolResult,
  deleteToolResult,
  clearToolHistory,
} from "@/lib/tool-history.functions";

type Item = { id: string; tool_key: string; title: string; lang: string | null; created_at: string };

/** Per-user history of a single tool's results, each downloadable in any allowed format. */
export function ToolHistory({ toolKey, className = "" }: { toolKey: string; className?: string }) {
  const { t, lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;

  const exportCfg = useExportConfig();
  const override = useExportOverride();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const r: any = await listToolHistory({ data: { toolKey } });
      setItems((r?.items || []) as Item[]);
    } catch { /* silent */ }
    finally { setBusy(false); }
  }, [user, toolKey]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { if (user) load(); /* initial count */ }, [user, load]);

  if (!user) return null;
  if (override && !override.exports_enabled) return null;
  if (!isToolExportEnabled(exportCfg, toolKey, override)) return null;

  const buildFor = (id: string) => async () => {
    const row: any = await getToolResult({ data: { id } });
    const p = (row?.payload || { title: row?.title, sections: [] }) as ExportPayload;
    return { ...p, lang: (row?.lang || lang) as any };
  };

  const remove = async (id: string) => {
    try { await deleteToolResult({ data: { id } }); setItems((s) => s.filter((x) => x.id !== id)); } catch {}
  };
  const clearAll = async () => {
    try { await clearToolHistory({ data: { toolKey } }); setItems([]); } catch {}
  };

  return (
    <div className={`mt-4 rounded-xl border border-border bg-background/40 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <History className="size-3.5 text-primary" />
        {t("hist_title")}
        {items.length > 0 && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
            {items.length}
          </span>
        )}
        <span className="ms-auto">{open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} {t("hist_refresh")}
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="ms-auto inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2 py-1 text-[11px] text-destructive transition hover:bg-destructive/10"
              >
                <Trash2 className="size-3" /> {t("hist_clear")}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-muted-foreground">{t("hist_empty")}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{it.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(it.created_at).toLocaleString()} · {(it.lang || "").toUpperCase()}
                    </div>
                  </div>
                  <ExportButtons toolKey={toolKey} size="xs" build={buildFor(it.id) as any} />
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    aria-label={t("hist_delete")}
                    title={t("hist_delete")}
                    className="rounded-lg border border-border p-1 text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
