import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { adminListKnowledgeSpaces } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";

const T = {
  ar: { title: "مساحات المعرفة — عرض إداري للقراءة فقط", refresh: "تحديث", empty: "لا توجد مساحات معرفة.", name: "المساحة", owner: "معرّف المالك", status: "الحالة", assets: "المصادر", pending: "بانتظار الموافقة", failed: "فاشل", nodes: "العُقد", prompts: "القوالب", confidence: "الثقة", updated: "آخر تحديث", error: "تعذر تحميل مساحات المعرفة." },
  en: { title: "Knowledge spaces — read-only admin view", refresh: "Refresh", empty: "No knowledge spaces found.", name: "Space", owner: "Owner ID", status: "Status", assets: "Assets", pending: "Pending approval", failed: "Failed", nodes: "Nodes", prompts: "Prompts", confidence: "Confidence", updated: "Updated", error: "Could not load knowledge spaces." },
  ku: { title: "شوێنەکانی زانیاری — تەنها خوێندنەوە", refresh: "نوێکردنەوە", empty: "هیچ شوێنێکی زانیاری نییە.", name: "شوێن", owner: "ناسنامەی خاوەن", status: "دۆخ", assets: "سەرچاوەکان", pending: "چاوەڕێی پەسەندکردن", failed: "سەرکەوتوو نەبوو", nodes: "گرێکان", prompts: "قاڵبەکان", confidence: "متمانە", updated: "نوێکراوەتەوە", error: "بارکردنی شوێنەکانی زانیاری سەرکەوتوو نەبوو." },
};

export function KnowledgeSpacesAdminPanel() {
  const { lang } = useI18n();
  const c = T[(lang === "en" || lang === "ku" ? lang : "ar") as keyof typeof T];
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await adminListKnowledgeSpaces({ data: {} });
      setSpaces(result.spaces ?? []);
    } catch {
      setError(c.error);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-display font-bold">{c.title}</h2><p className="text-xs text-muted-foreground">حتى الآن: عرض فقط؛ لا تعديل أو حذف أو تشغيل تعلّم.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />{c.refresh}</button>
    </div>
    {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {loading ? <div className="p-8 text-center"><Loader2 className="inline h-5 w-5 animate-spin" /></div> :
      spaces.length === 0 ? <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">{c.empty}</p> :
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs">
        <thead><tr className="border-b bg-muted/40 text-muted-foreground">
          {[c.name,c.owner,c.status,c.assets,c.pending,c.failed,c.nodes,c.prompts,c.confidence,c.updated].map((label) => <th key={label} className="whitespace-nowrap p-2 text-start">{label}</th>)}
        </tr></thead>
        <tbody>{spaces.map((s) => <tr key={s.id} className="border-b last:border-0">
          <td className="min-w-40 p-2"><div className="font-medium">{s.name || "—"}</div><div className="mt-1 text-muted-foreground">{s.description || s.id}</div></td>
          <td className="max-w-32 break-all p-2 font-mono">{s.user_id}</td>
          <td className="p-2">{s.status || "—"}</td>
          <td className="p-2 text-center">{s.asset_stats?.total ?? s.assets_count ?? 0}</td>
          <td className="p-2 text-center">{s.asset_stats?.pending ?? 0}</td>
          <td className="p-2 text-center">{s.asset_stats?.failed ?? 0}</td>
          <td className="p-2 text-center">{s.nodes_count ?? 0}</td>
          <td className="p-2 text-center">{s.prompt_count ?? 0}</td>
          <td className="p-2 text-center">{s.confidence == null ? "—" : `${Math.round(Number(s.confidence))}%`}</td>
          <td className="whitespace-nowrap p-2">{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : "—"}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
