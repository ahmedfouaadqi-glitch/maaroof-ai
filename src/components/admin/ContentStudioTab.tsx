import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Wand2, Trash2, Plus, Search } from "lucide-react";
import {
  adminListContent, adminUpsertContent, adminDeleteContent, adminBulkAutoFill,
} from "@/lib/cms.functions";
import { invalidateContent } from "@/lib/content";
import { useAdminL } from "./admin-i18n";

type Row = {
  key: string; namespace: string;
  ar: string | null; en: string | null; ku: string | null;
  notes: string | null; updated_at?: string;
};

export function ContentStudioTab() {
  const L = useAdminL({
    search: { ar: "بحث في المفتاح / النص…", en: "Search key / text…", ku: "گەڕان…" },
    allNs: { ar: "كل الأقسام", en: "All namespaces", ku: "هەموو" },
    newKey: { ar: "مفتاح جديد", en: "New key", ku: "کلیلی نوێ" },
    auto: { ar: "ترجمة تلقائية للمفقود", en: "Auto-translate missing", ku: "وەرگێڕانی خۆکار" },
    save: { ar: "حفظ", en: "Save", ku: "هەڵگرتن" },
    keyNs: { ar: "المفتاح / القسم", en: "Key / NS", ku: "کلیل" },
    deletePrompt: { ar: "حذف هذا المفتاح؟", en: "Delete this key?", ku: "بسڕیتەوە؟" },
    newKeyPrompt: { ar: "مفتاح جديد (مثال: home.hero.title):", en: "New content key (e.g. home.hero.title):", ku: "کلیلی نوێ:" },
    nsPrompt: { ar: "القسم (مثال: home, header, tool:brand_boost):", en: "Namespace (e.g. home, header, tool:brand_boost):", ku: "بەش:" },
    empty: { ar: "لا توجد مفاتيح. اضغط \"مفتاح جديد\" للبدء.", en: "No keys. Click \"New key\" to start.", ku: "هیچ نییە." },
    autoTitle: { ar: "ترجمة تلقائية", en: "Auto-translate", ku: "وەرگێڕان" },
    deleteTitle: { ar: "حذف", en: "Delete", ku: "سڕینەوە" },
  });
  const list = useServerFn(adminListContent);
  const upsert = useServerFn(adminUpsertContent);
  const del = useServerFn(adminDeleteContent);
  const bulk = useServerFn(adminBulkAutoFill);

  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [ns, setNs] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState<Record<string, Row>>({});

  const reload = async () => {
    setLoading(true);
    try {
      const r = await list();
      setRows(r.rows as Row[]);
      setDirty({});
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const namespaces = useMemo(() => {
    const s = new Set<string>(); rows.forEach((r) => s.add(r.namespace || "misc"));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (ns && r.namespace !== ns) return false;
      if (!q) return true;
      return r.key.toLowerCase().includes(q)
        || (r.ar || "").toLowerCase().includes(q)
        || (r.en || "").toLowerCase().includes(q)
        || (r.ku || "").toLowerCase().includes(q);
    });
  }, [rows, filter, ns]);

  const patch = (k: string, p: Partial<Row>) => {
    setDirty((d) => ({ ...d, [k]: { ...(d[k] || rows.find((r) => r.key === k)!), ...p } }));
  };

  const saveAll = async () => {
    const items = Object.values(dirty);
    if (!items.length) return;
    setBusy(true);
    try {
      await upsert({ data: { rows: items } });
      invalidateContent();
      await reload();
    } finally { setBusy(false); }
  };

  const autoFill = async (keys: string[]) => {
    if (!keys.length) return;
    setBusy(true);
    try {
      const r: any = await bulk({ data: { keys: keys.slice(0, 50) } });
      invalidateContent();
      await reload();
      const fc = (r?.failed || []).length;
      alert(`${r?.count || 0} / ${keys.length}${fc ? ` — failed: ${fc}` : ""}`);
    } catch (e: any) {
      alert(`Error: ${e?.message || e}`);
    }
    finally { setBusy(false); }
  };

  const removeKey = async (k: string) => {
    if (!confirm(`${L.deletePrompt} "${k}"`)) return;
    setBusy(true);
    try { await del({ data: { key: k } }); invalidateContent(); await reload(); }
    finally { setBusy(false); }
  };

  const addNew = () => {
    const k = prompt(L.newKeyPrompt);
    if (!k) return;
    const newNs = prompt(L.nsPrompt, ns || "misc") || "misc";
    setRows((r) => [{ key: k, namespace: newNs, ar: "", en: "", ku: "", notes: null }, ...r]);
    setDirty((d) => ({ ...d, [k]: { key: k, namespace: newNs, ar: "", en: "", ku: "", notes: null } }));
  };

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={L.search}
            className="w-full rounded-lg border border-border bg-background/60 ps-8 pe-3 py-2 text-sm" />
        </div>
        <select value={ns} onChange={(e) => setNs(e.target.value)}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
          <option value="">{L.allNs}</option>
          {namespaces.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={addNew} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
          <Plus className="size-3.5" /> {L.newKey}
        </button>
        <button onClick={() => autoFill(filtered.filter((r) => !r.ar || !r.en || !r.ku).map((r) => r.key))}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50">
          <Wand2 className="size-3.5" /> {L.auto}
        </button>
        <button onClick={saveAll} disabled={busy || dirtyCount === 0}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {L.save} {dirtyCount > 0 ? `(${dirtyCount})` : ""}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-2 text-start">{L.keyNs}</th>
              <th className="p-2 text-start">AR</th>
              <th className="p-2 text-start">EN</th>
              <th className="p-2 text-start">KU</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const cur = dirty[r.key] || r;
              const isDirty = !!dirty[r.key];
              return (
                <tr key={r.key} className={`border-t border-border/40 ${isDirty ? "bg-primary/5" : ""}`}>
                  <td className="p-2 align-top">
                    <div className="font-mono text-[11px] font-semibold text-foreground">{r.key}</div>
                    <div className="text-[10px] text-muted-foreground">{cur.namespace}</div>
                  </td>
                  <td className="p-2 align-top">
                    <textarea value={cur.ar || ""} onChange={(e) => patch(r.key, { ar: e.target.value })} dir="rtl"
                      className="min-h-[40px] w-full rounded border border-border bg-background/60 p-1.5 text-xs" />
                  </td>
                  <td className="p-2 align-top">
                    <textarea value={cur.en || ""} onChange={(e) => patch(r.key, { en: e.target.value })}
                      className="min-h-[40px] w-full rounded border border-border bg-background/60 p-1.5 text-xs" />
                  </td>
                  <td className="p-2 align-top">
                    <textarea value={cur.ku || ""} onChange={(e) => patch(r.key, { ku: e.target.value })} dir="rtl"
                      className="min-h-[40px] w-full rounded border border-border bg-background/60 p-1.5 text-xs" />
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => autoFill([r.key])} title={L.autoTitle} disabled={busy}
                        className="rounded p-1 text-accent hover:bg-accent/10 disabled:opacity-50"><Wand2 className="size-3.5" /></button>
                      <button onClick={() => removeKey(r.key)} title={L.deleteTitle} disabled={busy}
                        className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{L.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
