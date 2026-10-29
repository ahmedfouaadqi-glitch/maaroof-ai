// WorkspaceSwitcher — sidebar chip to switch between brands/clients or create a new one.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, Check, Loader2, Trash2 } from "lucide-react";
import { listWorkspaces, createWorkspace, deleteWorkspace } from "@/lib/workspaces.functions";

export type Workspace = {
  id: string;
  name: string;
  kind: "own" | "client" | "brand";
  brand_url: string | null;
  language: "ar" | "en" | "ku";
  country: string | null;
  city?: string | null;
  space_kind?: "company" | "subsidiary" | "product" | "client";
  brand_summary?: string | null;
  keywords?: string[] | string | null;
  profile?: Record<string, unknown> | null;
  entity_truth_card?: Record<string, any> | null;
  onboarding?: Record<string, any> | null;
  settings?: Record<string, any> | null;
  goals?: unknown[] | null;
};

const STORAGE_KEY = "maaroof.active_workspace_id";

export function WorkspaceSwitcher({ onChange, disabled = false }: { onChange: (ws: Workspace | null) => void; disabled?: boolean }) {
  const { t, lang } = useI18n();
  const list = useServerFn(listWorkspaces);
  const create = useServerFn(createWorkspace);
  const del = useServerFn(deleteWorkspace);
  const [items, setItems] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"own" | "client" | "product">("own");
  const [brandUrl, setBrandUrl] = useState("");
  const [sector, setSector] = useState("");
  const [formError, setFormError] = useState("");
  const copy = (ar: string, en: string, ku: string) => lang === "en" ? en : lang === "ku" ? ku : ar;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await list();
        const arr = (res.items as unknown as Workspace[]) || [];
        setItems(arr);
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const found = saved ? arr.find((w) => w.id === saved) || null : null;
        setActiveId(found?.id ?? null);
        onChange(found);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function pick(w: Workspace | null) {
    if (disabled) return;
    if (w) {
      try {
        const latest = await list();
        const refreshed = (latest.items as unknown as Workspace[]) || [];
        setItems(refreshed);
        w = refreshed.find((item) => item.id === w!.id) || w;
      } catch {}
    }
    setActiveId(w?.id ?? null);
    if (typeof window !== "undefined") {
      if (w) localStorage.setItem(STORAGE_KEY, w.id);
      else localStorage.removeItem(STORAGE_KEY);
    }
    onChange(w);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("maaroof:workspace-changed", { detail: { workspaceId: w?.id ?? null } }));
  }

  async function submit() {
    if (!name.trim()) return;
    setCreating(true);
    setFormError("");
    try {
      const persistedKind: Workspace["kind"] = kind === "client" ? "client" : kind === "product" ? "brand" : "own";
      const spaceKind: NonNullable<Workspace["space_kind"]> = kind === "product" ? "product" : kind === "client" ? "client" : "company";
      const res = await create({ data: {
        name: name.trim(),
        kind: persistedKind,
        space_kind: spaceKind,
        brand_url: brandUrl.trim() || undefined,
        brand_summary: sector.trim() || undefined,
        keywords: [],
        language: lang === "en" || lang === "ku" ? lang : "ar",
      } });
      const w = res.workspace as unknown as Workspace;
      setItems((p) => [w, ...p]);
      await pick(w);
      setName(""); setBrandUrl(""); setSector(""); setShowForm(false);
    } catch (e: any) {
      const msg = String(e?.message || "");
      const lim = /space_limit_reached:(\d+)/.exec(msg);
      setFormError(lim
        ? copy(`بلغت الحد الأقصى لمساحات العمل في باقتك (${lim[1]}).`, `You reached your plan's workspace limit (${lim[1]}).`, `گەیشتیتە سنووری شوێنی کار (${lim[1]}).`)
        : (msg || copy("تعذر إنشاء مساحة العمل.", "Could not create the workspace.", "دروستکردنی شوێنی کار سەرکەوتوو نەبوو.")).slice(0, 240));
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("auto.delete_workspace_sessions_and_memory_within"))) return;
    await del({ data: { id } });
    const next = items.filter((w) => w.id !== id);
    setItems(next);
    if (activeId === id) pick(next[0] || null);
  }

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      <h2 className="flex items-center justify-between gap-2 font-semibold text-base m-0">
        <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {t("auto.workspaces")}</span>
        <button onClick={() => setShowForm((v) => !v)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> {t("auto.new")}</button>
      </h2>


      {showForm && (
        <div className="space-y-3 rounded-xl border border-border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">{copy("اختر نوع مساحة العمل؛ سيُحفظ لكل نوع سياقه وذاكرته وتقاريره الخاصة.", "Choose a workspace type. Its context, memory, and reports will remain scoped to it.", "جۆری شوێنی کار هەڵبژێرە؛ پاشبنەما و بیرگە و ڕاپۆرتەکانی تایبەتی دەبن.")}</p>
          <div role="radiogroup" aria-label={copy("نوع مساحة العمل", "Workspace type", "جۆری شوێنی کار")} className="grid gap-2">
            <button type="button" role="radio" aria-checked={kind === "own"} onClick={() => setKind("own")} className={`rounded-lg border p-3 text-start transition ${kind === "own" ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border hover:border-primary/50"}`}>
              <span className="block text-sm font-semibold">{copy("خاصة بي / علامتي التجارية", "My business / brand", "کار و براندی من")}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{copy("مثال: شركتك أو متجرك الخاص لتتبع حضوره واقتباساته في إجابات محركات الذكاء الاصطناعي.", "Example: your company or shop; track its presence and citations in AI answers.", "نموونە: کۆمپانیا یان فرۆشگاکەت بۆ بەدواداچوونی دەرکەوتن و ئاماژەکانی لە وەڵامی زیرەکی دەستکرد.")}</span>
            </button>
            <button type="button" role="radio" aria-checked={kind === "client"} onClick={() => setKind("client")} className={`rounded-lg border p-3 text-start transition ${kind === "client" ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border hover:border-primary/50"}`}>
              <span className="block text-sm font-semibold">{copy("عميل (Client)", "Client", "کڕیار")}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{copy("مثال: عميل تدير له الحملات أو تحسين GEO؛ هويته وأهدافه وتقاريره منفصلة عن بقية الحسابات.", "Example: a client whose campaigns or GEO work you manage; identity, goals, and reports stay separate.", "نموونە: کڕیارێک کە ڕیکلام یان GEO ـی بۆ بەڕێوە دەبەیت؛ ناسنامە و ئامانج و ڕاپۆرتی جیاواز.")}</span>
            </button>
            <button type="button" role="radio" aria-checked={kind === "product"} onClick={() => setKind("product")} className={`rounded-lg border p-3 text-start transition ${kind === "product" ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border hover:border-primary/50"}`}>
              <span className="block text-sm font-semibold">{copy("منتج (Product)", "Product", "بەرهەم")}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{copy("مثال: منتج جديد تدرس فرصه ومنافسيه وظهوره في إجابات النماذج بصورة مستقلة.", "Example: a product whose market opportunity, competitors, and visibility you analyze independently.", "نموونە: بەرهەمێکی نوێ کە دەرفەت و کێبڕکێکار و دەرکەوتنی بە جیاوازی دەخوێنیتەوە.")}</span>
            </button>
          </div>
          <label className="block text-xs font-medium">
            {copy("اسم الشركة أو العميل أو المنتج", "Company, client, or product name", "ناوی کۆمپانیا یان کڕیار یان بەرهەم")}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy("مثال: متجر معروف للأجهزة", "Example: Maaroof Electronics Shop", "نموونە: فرۆشگای ئەلیکترۆنیاتی معروف")} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium">
            {copy("رابط الموقع الرسمي (اختياري)", "Official website (optional)", "ماڵپەڕی فەرمی (ئارەزوومەندانە)")}
            <input type="url" value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium">
            {copy("نطاق العمل / القطاع", "Business scope / sector", "بواری کار")}
            <textarea rows={2} value={sector} onChange={(e) => setSector(e.target.value)} placeholder={copy("مثال: تجارة الأجهزة وتتبع الظهور في ChatGPT وGemini", "Example: electronics retail; track visibility in ChatGPT and Gemini", "نموونە: بازرگانی ئامێر و بەدواداچوونی دەرکەوتن لە ChatGPT و Gemini")} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setFormError(""); }} className="rounded-lg px-3 py-2 text-xs hover:bg-muted">{t("auto.cancel")}</button>
            <button type="button" onClick={() => void submit()} disabled={!name.trim() || creating} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">
              {creating && <Loader2 className="size-3 animate-spin" />} {t("auto.save")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> {t("auto.loading")}</div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            aria-label={t("auto.workspaces")}
            value={activeId ?? ""}
            onChange={(e) => { const id = e.target.value; void pick(id ? items.find((w) => w.id === id) || null : null); }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">{lang === "en" ? "Main account" : lang === "ku" ? "هەژماری سەرەکی" : "الحساب الأساسي"}</option>
            {items.map((w) => {
              const kindLabel = w.space_kind === "product" ? copy("منتج", "Product", "بەرهەم") : w.kind === "client" ? t("auto.client") : w.kind === "own" ? copy("خاص بي", "My business", "کاری من") : t("auto.tag");
              let host = "";
              try { host = w.brand_url ? ` · ${new URL(w.brand_url).hostname.replace("www.", "")}` : ""; } catch {}
              return <option key={w.id} value={w.id}>{`${w.name} — ${kindLabel}${host}`}</option>;
            })}
          </select>
          {activeId && (
            <button type="button" onClick={() => void remove(activeId)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" title={t("auto.delete")} aria-label={t("auto.delete")}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {items.length === 0 && <span className="text-xs text-muted-foreground">{t("auto.no_spaces_yet_create_the_first")}</span>}
        </div>
      )}
    </div>
  );
}
