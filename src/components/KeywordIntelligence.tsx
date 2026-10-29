import { useEffect, useState } from "react";
import { Loader2, KeyRound, Upload, SearchCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch, withPreviewAuth } from "@/lib/api-client";
import { ExportButtons } from "@/components/ExportButtons";
import type { ExportPayload } from "@/lib/exports";

type L = "ar" | "en" | "ku";
type ContentLanguage = "ar" | "en" | "ku" | "fr" | "de" | "es";
const WORKSPACE_KEY = "maaroof.active_workspace_id";
const T = {
  ar: {
    title: "ذكاء الكلمات المفتاحية التنافسية",
    hint: "يمكنك تحليل كلمات الموقع أو إرفاق مصنف. تُفصل لغة المحتوى عن السوق المستهدف.",
    brand: "العلامة", site: "الموقع الرسمي", category: "المجال / القطاع",
    comps: "المنافسون (اختياري، افصل بفاصلة)", market: "السوق المستهدف / الدولة",
    contentLanguage: "لغة المحتوى والكلمات", file: "إرفاق ملف كلمات مفتاحية (XLSX / XLSM / CSV / TSV)",
    liveSearch: "تفعيل فحص مباشر لنتائج البحث (قد يستهلك حصة البحث المتاحة)",
    liveLimit: "عدد الكلمات للفحص الحي لكل سوق (1–50)",
    run: "ابدأ التحليل", busy: "يجري التحليل…", selectedFile: "الملف المحدد",
    workspace: "مساحة العمل النشطة", noWorkspace: "الحساب الأساسي",
    liveNote: "عند عدم تفعيل الفحص الحي لن تُعرض درجات SEO/SERP تخمينية. كما أن مزود البحث الحالي لا يكشف بصورة موثوقة اقتباسات Google AI Overviews، لذلك ستظهر SGE/AEO كـ«لم تُقَس» حتى يتوفر مصدر يدعمها.",
    errors: { upload_failed: "فشل رفع الملف", workspace_not_found: "مساحة العمل غير موجودة أو لا تملك صلاحية الوصول إليها", unsupported_spreadsheet: "صيغة الملف غير مدعومة", file_too_large: "حجم الملف أكبر من الحد التشغيلي الحالي (25MB)" },
  },
  en: {
    title: "Competitive Keyword Intelligence",
    hint: "Analyze site keywords or attach a workbook. Content language and target market are independent.",
    brand: "Brand", site: "Official website", category: "Business sector",
    comps: "Competitors (optional, comma separated)", market: "Target market / country",
    contentLanguage: "Content and keyword language", file: "Attach keyword workbook (XLSX / XLSM / CSV / TSV)",
    liveSearch: "Enable live search-results checking (uses available search quota)",
    liveLimit: "Keywords to check live per market (1–50)",
    run: "Run analysis", busy: "Analyzing…", selectedFile: "Selected file",
    workspace: "Active workspace", noWorkspace: "Main account",
    liveNote: "Without live checking, SEO/SERP scores remain unmeasured. The current search provider does not reliably expose Google AI Overview citations, so SGE/AEO will remain unmeasured until a suitable source is connected.",
    errors: { upload_failed: "File upload failed", workspace_not_found: "Workspace not found or not accessible", unsupported_spreadsheet: "Unsupported file format", file_too_large: "File exceeds the current operational limit (25MB)" },
  },
  ku: {
    title: "زیرەکی وشە سەرەکییە ڕکابەرییەکان",
    hint: "وشەکانی ماڵپەڕ شیکەرەوە یان فایلێکی خشتەیی هاوپێچ بکە. زمانی ناوەڕۆک لە بازاڕی ئامانج جیاوازە.",
    brand: "براند", site: "ماڵپەڕی فەرمی", category: "بواری کار",
    comps: "ڕکابەران (ئارەزوومەندانە)", market: "بازاڕی ئامانج / وڵات",
    contentLanguage: "زمانی ناوەڕۆک و وشەکان", file: "هاوپێچکردنی فایل (XLSX / XLSM / CSV / TSV)",
    liveSearch: "چالاککردنی پشکنینی ڕاستەوخۆی ئەنجامی گەڕان",
    liveLimit: "ژمارەی وشە بۆ پشکنینی ڕاستەوخۆ لە هەر بازاڕێک (1–50)",
    run: "دەستپێکردن", busy: "شیکردنەوە…", selectedFile: "فایلی هەڵبژێردراو",
    workspace: "شوێنی کاری چالاک", noWorkspace: "هەژماری سەرەکی",
    liveNote: "ئەگەر پشکنینی ڕاستەوخۆ چالاک نەبێت، نمرەی خەمڵێنراوی SERP نیشان نادرێت. پێوانەی SGE/AEO تا بەردەستبوونی سەرچاوەی گونجاو نەپێوراو دەمێنێتەوە.",
    errors: { upload_failed: "بارکردنی فایل سەرکەوتوو نەبوو", workspace_not_found: "شوێنی کار نەدۆزرایەوە یان دەسەڵاتت نییە", unsupported_spreadsheet: "فۆرماتی فایل پشتگیری ناکرێت", file_too_large: "قەبارەی فایل لە سنووری 25MB زیاترە" },
  },
} as const;

const LANGUAGE_LABELS: Record<ContentLanguage, string> = {
  ar: "العربية", en: "English", ku: "کوردی (سۆرانی)", fr: "Français", de: "Deutsch", es: "Español",
};

export function KeywordIntelligence() {
  const { lang } = useI18n();
  const l = (["ar", "en", "ku"].includes(lang) ? lang : "ar") as L;
  const c = T[l];
  const auth = useAuth();
  const p: any = auth?.profile || {};
  const [brand, setBrand] = useState<string>(p.brand_name || p.entity_name || "");
  const [site, setSite] = useState<string>(p.website || p.entity_website || "");
  const [category, setCategory] = useState<string>(p.specialty || p.sector || "");
  const [market, setMarket] = useState<string>(p.hq_country || "");
  const [comps, setComps] = useState("");
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>((["ar", "en", "ku"].includes(p.language) ? p.language : l) as ContentLanguage);
  const [file, setFile] = useState<File | null>(null);
  const [liveSearch, setLiveSearch] = useState(false);
  const [liveLimit, setLiveLimit] = useState("10");
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState<ExportPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      const id = typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_KEY) || "" : "";
      if (cancelled) return;
      setWorkspaceId(id);
      if (!id || !auth.user?.id) {
        setWorkspaceName(c.noWorkspace);
        setBrand(String(p.brand_name || p.entity_name || ""));
        setSite(String(p.website || p.entity_website || ""));
        setCategory(String(p.specialty || p.sector || ""));
        setMarket(String(p.hq_country || ""));
        setContentLanguage((["ar", "en", "ku", "fr", "de", "es"].includes(p.language) ? p.language : l) as ContentLanguage);
        return;
      }
      const { data, error } = await supabase.from("workspaces")
        .select("id,name,brand_url,brand_summary,country,city,language,profile,entity_truth_card,keywords")
        .eq("id", id).eq("owner_id", auth.user.id).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setWorkspaceName(c.noWorkspace);
        setBrand(String(p.brand_name || p.entity_name || ""));
        setSite(String(p.website || p.entity_website || ""));
        setCategory(String(p.specialty || p.sector || ""));
        setMarket(String(p.hq_country || ""));
        setContentLanguage((["ar", "en", "ku", "fr", "de", "es"].includes(p.language) ? p.language : l) as ContentLanguage);
        return;
      }
      setWorkspaceName(data.name);
      const truth: any = data.entity_truth_card || {};
      const profile: any = data.profile || {};
      setBrand(String(truth.entity_name || profile.brand_name || data.name || ""));
      setSite(String(data.brand_url || truth.website_url || profile.website || ""));
      setCategory(String(truth.sector || data.brand_summary || profile.sector || ""));
      setMarket([data.city, data.country].filter(Boolean).join(", "));
      setContentLanguage((["ar", "en", "ku", "fr", "de", "es"].includes(data.language) ? data.language : (["ar", "en", "ku", "fr", "de", "es"].includes(p.language) ? p.language : l)) as ContentLanguage);
    }
    void loadWorkspace();
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKSPACE_KEY) void loadWorkspace();
    };
    const onWorkspaceChanged = () => void loadWorkspace();
    window.addEventListener("storage", onStorage);
    window.addEventListener("maaroof:workspace-changed", onWorkspaceChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("maaroof:workspace-changed", onWorkspaceChanged);
    };
  }, [auth.user?.id, auth.profile, l]);

  async function run() {
    setBusy(true); setErr(""); setPayload(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("unauthorized");
      let attachmentId: string | undefined;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        if (workspaceId) form.set("workspace_id", workspaceId);
        const upload = await fetch(withPreviewAuth("/api/keyword-upload"), {
          method: "POST",
          headers: { Authorization: "Bearer " + session.access_token },
          body: form,
        });
        const uploaded = await upload.json().catch(() => ({}));
        if (!upload.ok) throw new Error(uploaded?.error || "upload_failed");
        attachmentId = String(uploaded.attachment_id || "");
        if (!attachmentId) throw new Error("upload_failed");
      }
      const response = await apiFetch("/api/dual-result", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({
          brand, site, category,
          market_text: market,
          target_market: market,
          content_language: contentLanguage,
          workspace_id: workspaceId || null,
          attachment_id: attachmentId,
          live_search: liveSearch,
          live_search_limit: Math.max(1, Math.min(50, Number(liveLimit) || 10)),
          competitors: comps.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean),
          lang: l,
          request_text: c.title,
        }),
      });
      const j = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(j?.error || "failed");
      setPayload(j.payload);
    } catch (e: any) {
      const code = String(e?.message || "failed");
      const custom = (c.errors as Record<string, string>)[code];
      setErr(custom || (code === "unauthorized" ? (l === "en" ? "Sign in before running this tool." : "سجّل الدخول قبل تشغيل الأداة.") : code));
    } finally { setBusy(false); }
  }

  const field = (label: string, value: string, set: (value: string) => void) => (
    <label className="block text-xs text-muted-foreground">{label}
      <input value={value} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
    </label>
  );

  return (
    <div className="space-y-4" dir={l === "en" ? "ltr" : "rtl"}>
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-primary" /> {c.title}</div>
        <p className="mb-3 text-xs text-muted-foreground">{c.hint}</p>
        <p className="mb-3 text-[11px] text-muted-foreground">{c.workspace}: <span className="font-medium text-foreground">{workspaceName || (workspaceId ? workspaceId.slice(0, 8) : c.noWorkspace)}</span></p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field(c.brand, brand, setBrand)}
          {field(c.site, site, setSite)}
          {field(c.category, category, setCategory)}
          {field(c.market, market, setMarket)}
          <label className="block text-xs text-muted-foreground">{c.contentLanguage}
            <select value={contentLanguage} onChange={(e) => setContentLanguage(e.target.value as ContentLanguage)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              {Object.entries(LANGUAGE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3">{field(c.comps, comps, setComps)}</div>
        <div className="mt-3 rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <Upload className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.file}</span>
              <input type="file" accept=".xlsx,.xlsm,.csv,.tsv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-xs" />
              {file && <span className="mt-1 block text-muted-foreground">{c.selectedFile}: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
            </span>
          </label>
        </div>
        <div className="mt-3 rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input type="checkbox" checked={liveSearch} onChange={(e) => setLiveSearch(e.target.checked)} className="mt-0.5 accent-primary" />
            <span className="flex-1">{c.liveSearch}</span>
            <SearchCheck className="size-4 shrink-0 text-muted-foreground" />
          </label>
          {liveSearch && <label className="mt-3 block text-xs text-muted-foreground">{c.liveLimit}
            <input type="number" min={1} max={50} step={1} value={liveLimit} onChange={(e) => setLiveLimit(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>}
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{c.liveNote}</p>
        </div>
        <button onClick={run} disabled={busy || !brand.trim()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}{busy ? c.busy : c.run}
        </button>
        {err && <p role="alert" className="mt-2 text-xs text-destructive">{err}</p>}
      </div>
      {payload && (
        <div className="space-y-4">
          <ExportButtons build={() => payload} toolKey="keyword_intelligence" />
          {payload.sections.map((section, i) => section.table && (
            <section key={i} className="overflow-x-auto rounded-xl border border-border">
              <h3 className="bg-muted px-3 py-2 text-sm font-semibold">{section.heading}</h3>
              <table className="w-full text-xs">
                <thead><tr>{section.table.columns.map((header, j) => <th key={j} className="border-b border-border px-2 py-1 text-start font-medium">{header}</th>)}</tr></thead>
                <tbody>{section.table.data.map((row, j) => <tr key={j} className="border-b border-border/50">{row.map((value, k) => <td key={k} className="px-2 py-1 align-top">{String(value)}</td>)}</tr>)}</tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
