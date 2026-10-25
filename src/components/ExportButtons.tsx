import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeFloatingMenuPosition } from "@/lib/floating-menu";
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
  instagram_automated_access_denied: { ar: "Instagram رفض القراءة الآلية لهذه الصفحة", en: "Instagram declined automated reading of this page", ku: "Instagram ڕێگەی خوێندنەوەی ئۆتۆماتیکی ئەم پەڕەیەی نەدا" },
  instagram_rate_limited: { ar: "Instagram قيّد طلبات القراءة الآلية مؤقتًا", en: "Instagram temporarily limited automated reading requests", ku: "Instagram داواکارییەکانی خوێندنەوەی ئۆتۆماتیکی کاتی سنووردار کرد" },
  target_access_restricted: { ar: "الموقع لم يسمح بالقراءة الآلية", en: "The website did not permit automated reading", ku: "ماڵپەڕەکە ڕێگەی خوێندنەوەی ئۆتۆماتیکی نەدا" },
  target_rate_limited: { ar: "الموقع قيّد طلبات القراءة مؤقتًا", en: "The website temporarily limited reading requests", ku: "ماڵپەڕەکە داواکارییەکانی خوێندنەوەی کاتی سنووردار کرد" },
  reader_rate_limited: { ar: "حد مؤقت لطلبات القراءة", en: "Temporary reading-request limit", ku: "سنووری کاتی داواکاری خوێندنەوە" },
  reader_quota_reached: { ar: "بلغت سعة القراءة المتاحة حدها الحالي", en: "The available reading capacity has been reached", ku: "توانای خوێندنەوەی بەردەست گەیشتە سنوورەکەی" },
  access_restricted: { ar: "تعذّرت القراءة الآلية لهذه الصفحة", en: "Automated reading of this page was not permitted", ku: "خوێندنەوەی ئۆتۆماتیکی ئەم پەڕەیە ڕێگەپێنەدرا" },
  rate_limited: { ar: "تقييد مؤقت لطلبات القراءة", en: "Temporary reading-request limit", ku: "سنووری کاتی داواکاری خوێندنەوە" },
  timeout: { ar: "انتهت المهلة", en: "Timed out", ku: "کاتی پشکنین تەواو بوو" },
  source_unavailable: { ar: "تعذر الحصول على محتوى صالح", en: "Usable content could not be retrieved", ku: "ناوەڕۆکی بەکارهێنراو بەدەست نەهات" },
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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [exportLang, setExportLang] = useState<"ar" | "en" | "ku">(lang === "en" || lang === "ku" ? lang : "ar");
  const triggerId = useId();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const withPack = true;
  const pad = size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const anchor = trigger.getBoundingClientRect();
      const menuBox = menu.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const position = computeFloatingMenuPosition(
        anchor,
        { width: menuBox.width || 320, height: menuBox.height || 320 },
        { width: viewportWidth, height: viewportHeight },
        window.getComputedStyle(trigger).direction === "rtl" ? "rtl" : "ltr",
      );
      setMenuPosition({ top: position.top, left: position.left });
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, exportLang]);

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
    setOpen(false);
    const p = await build();
    p.lang = exportLang;
    p.identity = identity;
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
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setMenuPosition(null);
          setOpen((value) => !value);
        }}
        className={`inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 ${pad} font-semibold text-primary shadow-sm transition duration-200 hover:-translate-y-px hover:border-primary/60 hover:bg-primary/15 hover:shadow active:translate-y-0`}
      >
        <Download className="size-3.5" /> {t("export_menu")}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <button
            type="button"
            aria-label={exportLang === "en" ? "Close export menu" : exportLang === "ku" ? "داخستنی لیستی هەناردە" : "إغلاق قائمة التصدير"}
            tabIndex={-1}
            className="fixed inset-0 z-[10000] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            ref={menuRef}
            id={menuId}
            role="dialog"
            aria-labelledby={`${menuId}-title`}
            dir={exportLang === "en" ? "ltr" : "rtl"}
            style={{
              position: "fixed",
              top: menuPosition?.top ?? -10000,
              left: menuPosition?.left ?? 8,
              visibility: menuPosition ? "visible" : "hidden",
            }}
            className="z-[10001] w-80 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-popover/95 p-2 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl transition-[opacity,transform] duration-150"
          >
            <div className="flex items-start justify-between gap-3 px-2 pb-2 pt-1">
              <div>
                <h3 id={`${menuId}-title`} className="text-sm font-bold text-foreground">
                  {exportLang === "en" ? "Export report" : exportLang === "ku" ? "هەناردەکردنی ڕاپۆرت" : "تصدير التقرير"}
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {exportLang === "en" ? "Choose a format and language" : exportLang === "ku" ? "فۆرمات و زمان هەڵبژێرە" : "اختر الصيغة واللغة"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={exportLang === "en" ? "Close" : exportLang === "ku" ? "داخستن" : "إغلاق"}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="mb-2 flex gap-1 rounded-xl bg-muted/70 p-1" role="group" aria-label="Report language">
              {(["ar", "en", "ku"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setExportLang(l)}
                  aria-pressed={exportLang === l}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition duration-150 ${exportLang === l ? "bg-background text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
                  {l === "ar" ? "العربية" : l === "en" ? "English" : "کوردی"}
                </button>
              ))}
            </div>
            <p className="mb-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {exportLang === "en" ? "Machine-readable assets are added where supported." : exportLang === "ku" ? "ناوەڕۆکی گونجاو بۆ خوێندنەوەی ماشێن، لە شوێنی پشتگیریکراو زیاد دەکرێت." : "تُضاف الأصول القابلة للقراءة الآلية حيثما يدعمها التقرير."}
            </p>
            <div className="grid gap-1">
              {available.map((f) => {
                const Icon = ICONS[f];
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => run(f)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-start text-sm text-foreground transition duration-150 hover:-translate-y-px hover:border-primary/20 hover:bg-primary/10 hover:text-primary hover:shadow-sm active:translate-y-0"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{labels[f]}</span>
                    <span className="text-[10px] text-muted-foreground transition group-hover:text-primary" aria-hidden="true">↗</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
