import { useEffect, useMemo, useState } from "react";
import { adminListKnowledgeSpaces } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";
import { Download, RefreshCw, Search, ShieldCheck, Database, FileText, Network, AlertTriangle } from "lucide-react";

type Space = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string | null;
  lang: string | null;
  assets_count: number | null;
  nodes_count: number | null;
  confidence: number | null;
  metrics: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  asset_stats: { total: number; pending: number; failed: number };
  prompt_count: number;
};

const COPY = {
  ar: {
    title: "مساحات المعرفة", intro: "نظرة إدارية مجمّعة على المساحات دون فتح محتوى ملفات العملاء أو تعليماتهم الخاصة.",
    refresh: "تحديث", search: "ابحث بالاسم أو الوصف أو المعرّف", all: "كل الحالات", active: "نشطة", pending: "تحتاج مراجعة", failed: "تحتوي أخطاء",
    total: "المساحات", assets: "الأصول", prompts: "التعليمات", nodes: "عُقد المعرفة", approval: "بانتظار الموافقة", errors: "أصول فاشلة",
    name: "المساحة", status: "الحالة", language: "اللغة", updated: "آخر تحديث", details: "ملخص المساحة", owner: "معرّف المالك", description: "الوصف",
    exportJson: "تصدير JSON", exportCsv: "تصدير CSV", empty: "لا توجد مساحات تطابق البحث.", loadError: "تعذر تحميل ملخص مساحات المعرفة. تحقق من صلاحيات الإدارة والجداول.", readOnly: "عرض للقراءة فقط", noDescription: "لا يوجد وصف",
    confidence: "الثقة", privacy: "حماية الخصوصية: هذه الشاشة لا تعرض محتويات الملفات أو نصوص التعليمات، ولا تسمح بتعديل المساحات.",
  },
  en: {
    title: "Knowledge Spaces", intro: "Cross-space administrative overview without exposing client files or private prompt contents.",
    refresh: "Refresh", search: "Search name, description, or ID", all: "All statuses", active: "Active", pending: "Needs review", failed: "Has errors",
    total: "Spaces", assets: "Assets", prompts: "Prompts", nodes: "Knowledge nodes", approval: "Awaiting approval", errors: "Failed assets",
    name: "Space", status: "Status", language: "Language", updated: "Last updated", details: "Space summary", owner: "Owner ID", description: "Description",
    exportJson: "Export JSON", exportCsv: "Export CSV", empty: "No spaces match this search.", loadError: "Could not load knowledge-space summaries. Check admin access and database tables.", readOnly: "Read-only overview", noDescription: "No description",
    confidence: "Confidence", privacy: "Privacy boundary: this view does not expose file contents or prompt text and does not allow space mutations.",
  },
  ku: {
    title: "شوێنەکانی زانیاری", intro: "پوختەی بەڕێوەبەرایەتی بۆ شوێنەکان، بەبێ پیشاندانی ناوەڕۆکی فایل یان دەقی تایبەتی ڕێنماییەکان.",
    refresh: "نوێکردنەوە", search: "بە ناو، وەسف یان ناسنامە بگەڕێ", all: "هەموو دۆخەکان", active: "چالاک", pending: "پێویستی بە پێداچوونەوە", failed: "هەڵەی تێدایە",
    total: "شوێنەکان", assets: "سەرچاوەکان", prompts: "ڕێنماییەکان", nodes: "گرێکانی زانیاری", approval: "چاوەڕوانی پەسەندکردن", errors: "سەرچاوەی شکستخواردوو",
    name: "شوێن", status: "دۆخ", language: "زمان", updated: "دوایین نوێکردنەوە", details: "پوختەی شوێن", owner: "ناسنامەی خاوەن", description: "وەسف",
    exportJson: "هەناردەی JSON", exportCsv: "هەناردەی CSV", empty: "هیچ شوێنێک لەگەڵ ئەم گەڕانە ناگونجێت.", loadError: "نەتوانرا پوختەی شوێنەکان باربکرێت. دەسەڵاتی ئەدمین و خشتەکان بپشکنە.", readOnly: "تەنها خوێندنەوە", noDescription: "وەسف نییە",
    confidence: "متمانە", privacy: "پاراستنی تایبەتمەندی: ناوەڕۆکی فایل و دەقی ڕێنمایی پیشان نادرێت و گۆڕانکاری ڕێگەپێدراو نییە.",
  },
} as const;

export function KnowledgeSpacesPanel() {
  const { lang } = useI18n();
  const c = COPY[(lang === "en" || lang === "ku" ? lang : "ar") as keyof typeof COPY];
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await adminListKnowledgeSpaces({ data: {} });
      setSpaces((result.spaces || []) as Space[]);
    } catch {
      setError(c.loadError);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => spaces.filter((space) => {
    const text = `${space.name || ""} ${space.description || ""} ${space.id}`.toLowerCase();
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (statusFilter === "active" && !["active", "ready", "published"].includes(String(space.status || "").toLowerCase())) return false;
    if (statusFilter === "pending" && !(space.asset_stats?.pending > 0)) return false;
    if (statusFilter === "failed" && !(space.asset_stats?.failed > 0)) return false;
    return true;
  }), [spaces, query, statusFilter]);

  const selected = filtered.find((space) => space.id === selectedId) || spaces.find((space) => space.id === selectedId) || null;
  const summary = useMemo(() => spaces.reduce((acc, space) => {
    acc.assets += Number(space.asset_stats?.total ?? space.assets_count ?? 0);
    acc.prompts += Number(space.prompt_count || 0);
    acc.nodes += Number(space.nodes_count || 0);
    acc.pending += Number(space.asset_stats?.pending || 0);
    acc.failed += Number(space.asset_stats?.failed || 0);
    return acc;
  }, { assets: 0, prompts: 0, nodes: 0, pending: 0, failed: 0 }), [spaces]);

  const exportReport = (format: "json" | "csv") => {
    const safeRows = filtered.map((space) => ({
      id: space.id, name: space.name, description: space.description || "", status: space.status || "unknown",
      language: space.lang || "", owner_id: space.user_id, assets: space.asset_stats?.total ?? space.assets_count ?? 0,
      pending_assets: space.asset_stats?.pending ?? 0, failed_assets: space.asset_stats?.failed ?? 0,
      prompts_count: space.prompt_count ?? 0, knowledge_nodes: space.nodes_count ?? 0, confidence: space.confidence ?? null,
      created_at: space.created_at, updated_at: space.updated_at,
    }));
    const csvCell = (value: unknown) => {
      const text = value == null ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const content = format === "json"
      ? JSON.stringify({ generated_at: new Date().toISOString(), scope: "filtered_knowledge_space_metadata_only", spaces: safeRows }, null, 2)
      : [Object.keys(safeRows[0] || { id: "", name: "", status: "" }).join(","), ...safeRows.map((row) => Object.values(row).map(csvCell).join(","))].join("\r\n");
    const blob = new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maaroof-knowledge-spaces-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold">{c.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{c.intro}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium"><ShieldCheck className="size-3.5 text-primary" />{c.readOnly}</span>
        </div>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">{c.privacy}</div>
        {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: c.total, value: spaces.length, icon: Database },
            { label: c.assets, value: summary.assets, icon: FileText },
            { label: c.prompts, value: summary.prompts, icon: FileText },
            { label: c.nodes, value: summary.nodes, icon: Network },
            { label: c.approval, value: summary.pending, icon: AlertTriangle },
            { label: c.errors, value: summary.failed, icon: AlertTriangle },
          ].map((item) => <div key={item.label} className="rounded-xl border border-border/70 bg-background/60 p-3">
            <item.icon className="size-4 text-primary" />
            <div className="mt-2 text-xl font-bold tabular-nums">{item.value.toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
          </div>)}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{c.title} ({filtered.length})</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => exportReport("csv")} disabled={!filtered.length} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"><Download className="size-3.5" />{c.exportCsv}</button>
              <button type="button" onClick={() => exportReport("json")} disabled={!filtered.length} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"><Download className="size-3.5" />{c.exportJson}</button>
              <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"><RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />{c.refresh}</button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /></label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="all">{c.all}</option><option value="active">{c.active}</option><option value="pending">{c.pending}</option><option value="failed">{c.failed}</option>
            </select>
          </div>
          <div className="mt-3 max-h-[650px] space-y-2 overflow-auto">
            {busy && spaces.length === 0 && <p className="p-4 text-sm text-muted-foreground">{c.refresh}…</p>}
            {!busy && filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">{c.empty}</p>}
            {filtered.map((space) => (
              <button key={space.id} type="button" onClick={() => setSelectedId(space.id)} className={`w-full rounded-xl border p-3 text-start transition hover:border-primary/40 ${selected?.id === space.id ? "border-primary/50 bg-primary/5" : "border-border/70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold">{space.name || space.id}</span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px]">{space.status || "unknown"}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{space.description || c.noDescription}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{c.assets}: {space.asset_stats?.total ?? space.assets_count ?? 0}</span><span>{c.prompts}: {space.prompt_count ?? 0}</span><span>{c.nodes}: {space.nodes_count ?? 0}</span>
                  {(space.asset_stats?.pending || 0) > 0 && <span className="text-amber-600">{c.approval}: {space.asset_stats.pending}</span>}
                  {(space.asset_stats?.failed || 0) > 0 && <span className="text-destructive">{c.errors}: {space.asset_stats.failed}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="font-semibold">{c.details}</h3>
          {!selected ? <p className="mt-3 text-sm text-muted-foreground">{c.empty}</p> : <div className="mt-4 space-y-3 text-sm">
            <div><div className="text-xs text-muted-foreground">{c.name}</div><div className="mt-1 break-words font-semibold">{selected.name || selected.id}</div></div>
            <div><div className="text-xs text-muted-foreground">ID</div><code className="mt-1 block break-all text-xs">{selected.id}</code></div>
            <div><div className="text-xs text-muted-foreground">{c.owner}</div><code className="mt-1 block break-all text-xs">{selected.user_id}</code></div>
            <div><div className="text-xs text-muted-foreground">{c.description}</div><p className="mt-1 break-words leading-6">{selected.description || c.noDescription}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{c.status}</div><div className="mt-1 break-words font-medium">{selected.status || "unknown"}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{c.language}</div><div className="mt-1 font-medium">{selected.lang || "—"}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{c.confidence}</div><div className="mt-1 font-medium">{selected.confidence == null ? "—" : selected.confidence}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{c.updated}</div><div className="mt-1 text-xs">{selected.updated_at ? new Date(selected.updated_at).toLocaleString(lang) : "—"}</div></div>
            </div>
            <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">{c.privacy}</div>
          </div>}
        </aside>
      </section>
    </div>
  );
}
