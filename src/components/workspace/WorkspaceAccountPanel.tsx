import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Building2, LoaderCircle, Save } from "lucide-react";
import { updateWorkspace } from "@/lib/workspaces.functions";
import type { Workspace } from "@/components/maaroof/WorkspaceSwitcher";

type L = "ar" | "en" | "ku";
const tr = (lang: L, ar: string, en: string, ku: string) => lang === "en" ? en : lang === "ku" ? ku : ar;

/** Workspace-specific identity and onboarding. User-entered facts remain unverified until independently checked. */
export function WorkspaceAccountPanel({ workspace, lang, onSaved }: {
  workspace: Workspace | null;
  lang: L;
  onSaved: (workspace: Workspace) => void;
}) {
  const saveWorkspace = useServerFn(updateWorkspace);
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState("brand");
  const [website, setWebsite] = useState("");
  const [sector, setSector] = useState("");
  const [country, setCountry] = useState("");
  const [markets, setMarkets] = useState("");
  const [keyFacts, setKeyFacts] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const card = workspace?.entity_truth_card || {};
    const answers = workspace?.onboarding?.answers || {};
    setEntityName(String(card.entity_name || workspace?.name || ""));
    setEntityType(String(card.entity_type || (workspace?.kind === "client" ? "client" : workspace?.kind === "own" ? "organization" : "brand")));
    setWebsite(String(card.website_url || workspace?.brand_url || ""));
    setSector(String(card.sector || workspace?.brand_summary || ""));
    setCountry(String(card.country || workspace?.country || ""));
    setMarkets((Array.isArray(card.markets) ? card.markets : []).join(", "));
    setKeyFacts((Array.isArray(card.key_facts) ? card.key_facts : []).join("\n"));
    setGoal(String(answers.primary_goal || ""));
    setAudience(String(answers.target_audience || ""));
    setCompetitors((Array.isArray(answers.competitors) ? answers.competitors : []).join(", "));
    setMessage("");
    setError("");
  }, [workspace?.id, workspace?.entity_truth_card, workspace?.onboarding, workspace?.brand_url, workspace?.brand_summary, workspace?.country]);

  const save = async () => {
    if (!workspace) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const facts = keyFacts.split(/\n+/).map((v) => v.trim()).filter(Boolean).slice(0, 30);
      const marketList = markets.split(/[,،;\n]+/).map((v) => v.trim()).filter(Boolean).slice(0, 20);
      const competitorList = competitors.split(/[,،;\n]+/).map((v) => v.trim()).filter(Boolean).slice(0, 20);
      const card = {
        ...(workspace.entity_truth_card || {}),
        entity_name: entityName.trim().slice(0, 200),
        entity_type: entityType,
        website_url: website.trim() || null,
        links: website.trim() ? [{ url: website.trim(), type: "official" }] : [],
        sector: sector.trim().slice(0, 400),
        country: country.trim().slice(0, 80) || null,
        markets: marketList,
        keywords: Array.isArray(workspace.keywords) ? workspace.keywords : String(workspace.keywords || "").split(/[,،;\n]+/).map((v) => v.trim()).filter(Boolean),
        key_facts: facts,
        verification_state: "UNVERIFIED",
        verified: false,
        updated_at: new Date().toISOString(),
      };
      const onboarding = {
        ...(workspace.onboarding || {}),
        status: "completed",
        completed_at: new Date().toISOString(),
        answers: {
          primary_goal: goal.trim().slice(0, 1000),
          target_audience: audience.trim().slice(0, 500),
          competitors: competitorList,
        },
      };
      const settings = { ...(workspace.settings || {}), language: lang, scope: "workspace", memory_isolation: "strict" };
      const result: any = await saveWorkspace({ data: {
        id: workspace.id,
        name: entityName.trim().slice(0, 100) || workspace.name,
        brand_url: website.trim() || null,
        brand_summary: sector.trim().slice(0, 4000) || null,
        country: country.trim().slice(0, 80) || null,
        language: lang,
        entity_truth_card: card,
        onboarding,
        settings,
      } });
      onSaved(result.workspace as Workspace);
      setMessage(tr(lang, "حُفظت بطاقة الكيان وسياق التهيئة لهذه المساحة فقط.", "Entity truth card and onboarding saved for this workspace only.", "کارتی ناسنامە و دۆخی دەستپێک تەنها بۆ ئەم شوێنە پاشەکەوت کرا."));
    } catch (e: any) {
      setError(String(e?.message || tr(lang, "تعذّر الحفظ. تحقق من ترحيل قاعدة البيانات.", "Save failed. Check that the database migration is applied.", "پاشەکەوت سەرکەوتوو نەبوو.")).slice(0, 300));
    } finally { setBusy(false); }
  };

  return <section className="mt-4 rounded-2xl border border-border bg-card p-5 space-y-4">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-primary/10 p-2 text-primary"><Building2 className="size-5" /></div>
      <div className="min-w-0">
        <h2 className="font-semibold">{tr(lang, "حساب مساحة العمل", "Workspace account", "هەژماری شوێنی کار")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{tr(lang, "هوية العميل، سياق التهيئة، والأهداف محفوظة داخل هذه المساحة ولا تُستعار من الحساب الأساسي.", "Client identity, onboarding context, and goals are stored inside this workspace, not borrowed from the main account.", "ناسنامە و دۆخی دەستپێک و ئامانجەکان تەنها لەم شوێنەدا هەڵدەگیرێن.")}</p>
      </div>
    </div>
    {!workspace ? <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{tr(lang, "اختر أو أنشئ مساحة عمل لتكوين بطاقة كيان مستقلة. الحساب الأساسي يبقى منفصلاً.", "Select or create a workspace to configure its own entity card. The main account remains separate.", "شوێنی کار هەڵبژێرە یان دروستی بکە بۆ ناسنامەی تایبەت.")}</div> : <>
      <div className="flex items-center gap-2 text-xs"><BadgeCheck className="size-4 text-muted-foreground" /><span className="rounded-full bg-muted px-2 py-1">{tr(lang, "حالة الهوية: غير متحقق منها بعد", "Identity status: not yet verified", "دۆخی ناسنامە: هێشتا پشتڕاست نەکراوەتەوە")}</span></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">{tr(lang, "اسم الكيان", "Entity name", "ناوی کەسایەتی")}<input value={entityName} onChange={(e) => setEntityName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="text-xs">{tr(lang, "نوع الكيان", "Entity type", "جۆری کەسایەتی")}<select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="brand">{tr(lang, "علامة تجارية", "Brand", "براند")}</option><option value="organization">{tr(lang, "شركة / منظمة", "Company / organization", "کۆمپانیا / دامەزراوە")}</option><option value="client">{tr(lang, "عميل", "Client", "کڕیار")}</option><option value="product">{tr(lang, "منتج", "Product", "بەرهەم")}</option><option value="person">{tr(lang, "شخص", "Person", "کەس")}</option></select></label>
        <label className="text-xs sm:col-span-2">{tr(lang, "الموقع الرسمي", "Official website", "ماڵپەڕی فەرمی")}<input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="text-xs">{tr(lang, "القطاع / التخصص", "Sector / specialty", "بواری کار")}<input value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="text-xs">{tr(lang, "الدولة / المقر", "Country / headquarters", "وڵات / ناوەند")}<input value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="text-xs sm:col-span-2">{tr(lang, "الأسواق المستهدفة (افصل بفاصلة)", "Target markets (comma-separated)", "بازاڕە ئامانجەکان")}<input value={markets} onChange={(e) => setMarkets(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="text-xs sm:col-span-2">{tr(lang, "حقائق معروفة عن الكيان — سطر لكل حقيقة", "Known entity facts — one per line", "ڕاستییەکانی کەسایەتی")}<textarea rows={3} value={keyFacts} onChange={(e) => setKeyFacts(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold">{tr(lang, "سياق التهيئة", "Onboarding context", "پاشبنەمای دەستپێک")}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs sm:col-span-2">{tr(lang, "الهدف الرئيسي لهذه المساحة", "Primary goal for this workspace", "ئامانجی سەرەکی")}<textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
          <label className="text-xs">{tr(lang, "الجمهور المستهدف", "Target audience", "جەماوەری ئامانج")}<input value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
          <label className="text-xs">{tr(lang, "المنافسون المعروفون", "Known competitors", "کێبڕکێکارە ناسراوەکان")}<input value={competitors} onChange={(e) => setCompetitors(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy || !entityName.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{tr(lang, "حفظ حساب المساحة", "Save workspace account", "پاشەکەوتکردنی هەژمار")}</button>
        {message && <span role="status" className="text-xs text-primary">{message}</span>}
        {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      </div>
    </>}
  </section>;
}
