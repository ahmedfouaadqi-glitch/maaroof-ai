import { useState } from "react";
import { Download, FileDown, FileSpreadsheet, FileText, FileType2, Presentation, Braces, Hash } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVisibility } from "@/lib/visibility";
import {
  useExportConfig,
  useExportOverride,
  isToolExportEnabled,
  allowedExportFormats,
  type ExportFormat,
} from "@/lib/content";
import { useExportIdentity } from "@/lib/export-identity";
import {
  exportToPDF, exportToExcel, exportToCSV, exportToWord, exportToPowerPoint,
  exportToMarkdown, exportToJSON, type ExportPayload,
} from "@/lib/exports";

const RUNNERS: Record<ExportFormat, (p: ExportPayload) => void | Promise<void>> = {
  pdf: exportToPDF,
  xlsx: exportToExcel,
  csv: exportToCSV,
  docx: exportToWord,
  pptx: exportToPowerPoint,
  md: exportToMarkdown,
  json: exportToJSON,
};

const ICONS: Record<ExportFormat, any> = {
  pdf: FileDown,
  xlsx: FileSpreadsheet,
  csv: FileText,
  docx: FileType2,
  pptx: Presentation,
  md: Hash,
  json: Braces,
};

const AUDIT_EXPORT_LABELS: Record<string, Record<"ar" | "en" | "ku", string>> = {
  measured: { ar: "قابل للقياس", en: "Measured", ku: "پێوراو" },
  unmeasured: { ar: "لم يُقَس", en: "Unmeasured", ku: "نەپێوراو" },
  access_restricted: { ar: "الوصول مقيّد", en: "Access restricted", ku: "دەستپێگەیشتن سنووردارە" },
  rate_limited: { ar: "تجاوز حد الطلبات", en: "Rate limited", ku: "سنووری داواکاری" },
  timeout: { ar: "انتهت المهلة", en: "Timed out", ku: "کاتی پشکنین تەواو بوو" },
  source_unavailable: { ar: "المصدر غير متاح", en: "Source unavailable", ku: "سەرچاوە بەردەست نییە" },
  insufficient_public_content: { ar: "محتوى عام غير كافٍ", en: "Insufficient public content", ku: "ناوەڕۆکی گشتی بەس نییە" },
  no_public_content: { ar: "لم يُستخرج محتوى عام", en: "No public content extracted", ku: "ناوەڕۆکی گشتی دەستنەکەوت" },
  insufficient_content_for_axis: { ar: "المحتوى لا يكفي لهذا المحور", en: "Not enough content for this axis", ku: "ناوەڕۆک بۆ ئەم تەوەرە بەس نییە" },
  needs_full_page_content: { ar: "يتطلب محتوى أعمق", en: "Full content required", ku: "ناوەڕۆکی زیاتر پێویستە" },
};
const auditExportText = (value: string, lang: "ar" | "en" | "ku") => AUDIT_EXPORT_LABELS[value]?.[lang] || value;

export function ExportButtons({
  build,
  size = "sm",
  className = "",
  formats,
  toolKey,
}: {
  build: () => ExportPayload | Promise<ExportPayload>;
  size?: "sm" | "xs";
  className?: string;
  /** Optional restriction on top of admin policy. */
  formats?: ExportFormat[];
  toolKey?: string;
}) {
  const { t, lang } = useI18n();
  const vis = useVisibility();
  const exportCfg = useExportConfig();
  const override = useExportOverride();
  const identity = useExportIdentity({
    showUser: override?.show_user_name ?? exportCfg.footer.show_user_name,
    emailPrivacy: override?.email_privacy ?? exportCfg.footer.email_privacy,
    showLogo: override?.show_logo ?? exportCfg.footer.show_logo,
  });
  const [open, setOpen] = useState(false);
  const [exportLang, setExportLang] = useState<"ar" | "en" | "ku">(lang === "en" || lang === "ku" ? lang : "ar");
  const withPack = true;
  const pad = size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  if (!vis.loading && !vis.isWidgetVisible("results_export")) return null;
  if (override && !override.exports_enabled) return null;
  // Admin export-config gate: hide per-tool export buttons when policy says so.
  if (toolKey && !isToolExportEnabled(exportCfg, toolKey, override)) return null;

  let available = allowedExportFormats(exportCfg, override);
  if (formats?.length) available = available.filter((f) => formats.includes(f));
  if (!available.length) return null;

  const labels: Record<ExportFormat, string> = {
    pdf: t("export_pdf"),
    xlsx: t("export_excel"),
    csv: "CSV",
    docx: t("export_word"),
    pptx: t("export_ppt"),
    md: "Markdown",
    json: "JSON",
  };

  const run = async (f: ExportFormat) => {
    const p = await build();
    p.lang = exportLang;
    p.identity = identity;
    setOpen(false);
    try {
      const { labelFor, localizeValue, glossarySection } = await import("@/lib/maaroof/report-sections");
      const { linksSection, packSections, engineAnswerSections } = await import("@/lib/machine-pack");
      const base = p.sections.filter((s) => !/^(حزمة قراءة الآلة|Machine-readable pack|پاکێجی)/.test(s.heading));
      // Localize fixed labels/values into the chosen export language (model answer text stays as-is).
      const loc: import("@/lib/exports").ExportSection[] = base.map((s) => ({
        ...s,
        heading: labelFor(s.heading, exportLang),
        rows: s.rows?.map(([k, v]) => [labelFor(String(k), exportLang), typeof v === "string" ? auditExportText(v, exportLang) : localizeValue(v, exportLang)] as [string, string | number]),
        table: s.table ? { ...s.table, columns: s.table.columns.map((c) => labelFor(c, exportLang)) } : undefined,
        cards: s.cards?.map((card) => ({
          ...card,
          status: card.status ? auditExportText(card.status, exportLang) : undefined,
          fields: card.fields?.map(([k, v]) => [labelFor(String(k), exportLang), typeof v === "string" ? auditExportText(v, exportLang) : localizeValue(v, exportLang)] as [string, string | number]),
          notes: card.notes?.map((note) => auditExportText(note, exportLang)),
        })),
      }));
      const extra: typeof loc = [linksSection(base, exportLang)];
      if (withPack) {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const [{ data: prof }, { data: mk }] = await Promise.all([
            supabase.from("profiles").select("brand_name, full_name, target_markets, onboarding").eq("id", u.user.id).maybeSingle(),
            supabase.from("entity_market_names").select("name, status").eq("user_id", u.user.id),
          ]);
          const pr: any = prof || {};
          const confirmed = ((mk || []) as any[]).filter((m) => m.status === "owner_confirmed" || m.status === "evidence_confirmed").map((m) => m.name);
          const ent = p.entity;
          const own = !ent?.brand || ent.brand.trim().toLowerCase() === String(pr.brand_name || "").trim().toLowerCase();
          extra.push(...packSections(ent?.brand
            ? { brand: ent.brand, site: ent.site, summary: ent.summary, markets: own ? [...(pr.target_markets || []), ...confirmed] : [], onboarding: own ? { ...(pr.onboarding || {}), faqs: ent.faqs?.length ? ent.faqs : pr.onboarding?.faqs } : { faqs: ent.faqs, facts: (ent.facts || []).join("\n"), links: (ent.links || []).join("\n") } }
            : { brand: pr.brand_name || pr.full_name || "", markets: [...(pr.target_markets || []), ...confirmed], onboarding: pr.onboarding || {} }, exportLang));
        } else if (p.entity?.brand) {
          const ent = p.entity;
          extra.push(...packSections({ brand: ent.brand, site: ent.site, summary: ent.summary, onboarding: { faqs: ent.faqs, facts: (ent.facts || []).join("\n"), links: (ent.links || []).join("\n") } }, exportLang));
        }
      }
      const engineSecs = p.engineAnswers?.length ? engineAnswerSections({ probe: { answers: p.engineAnswers } }, exportLang) : [];
      const all = [...engineSecs, ...loc.filter((s) => !/^(Glossary|فەرهەنگ|معجم المصطلحات)$/.test(s.heading)), ...extra];
      const { brandModelIds } = await import("@/lib/maaroof/model-council");
      const bm = (x: any) => (typeof x === "string" ? brandModelIds(x, exportLang) : x);
      for (const s of all) { s.text = bm(s.text); s.list = s.list?.map(bm); s.rows = s.rows?.map(([k, v]) => [k, bm(v)] as [string, string | number]); if (s.table) s.table = { ...s.table, data: s.table.data.map((r) => r.map(bm)) }; }
      const g = glossarySection(all, exportLang);
      p.sections = g ? [...all, g] : all;
    } catch {}
    await RUNNERS[f](p);
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 ${pad} font-semibold text-primary transition hover:bg-primary/20`}
      >
        <Download className="size-3.5" /> {t("export_menu")}
      </button>
      {open && (
        <>
          <button type="button" aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute top-full z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg ltr:left-0 rtl:right-0">
            <div className="mb-1 flex gap-1 border-b border-border p-1" role="group" aria-label="Report language">
              {(["ar", "en", "ku"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setExportLang(l)}
                  className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${exportLang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-primary/10"}`}>
                  {l === "ar" ? "العربية" : l === "en" ? "English" : "کوردی"}
                </button>
              ))}
            </div>
            <p className="mb-1 border-b border-border px-2 py-1.5 text-[11px] text-muted-foreground">
              {exportLang === "en" ? "Every export includes llms.txt + JSON-LD + FAQPage with how-to" : exportLang === "ku" ? "هەموو هەناردەیەک llms.txt و JSON-LD و FAQPage لەخۆدەگرێت" : "كل تصدير يتضمن llms.txt وJSON-LD وFAQPage مع طريقة الاستخدام"}
            </p>
            {available.map((f) => {
              const Icon = ICONS[f];
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => run(f)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-foreground transition hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="size-3.5" /> {labels[f]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
