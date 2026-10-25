import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeFloatingMenuPosition } from "@/lib/floating-menu";
import { Download, FileDown, FileSpreadsheet, FileText, FileType2, Presentation, Braces, Hash, Lightbulb, Languages, FileCode2, Info, LoaderCircle } from "lucide-react";
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
import { buildPack, engineAnswerSections, extractLinks, linksSection } from "@/lib/machine-pack";
import { toast } from "sonner";
import { collectExportTranslationPlan, applyExportTranslations } from "@/lib/export-content-translation";
import { translateExportContent } from "@/lib/translate-export.functions";
import {
  exportToPDF, exportToExcel, exportToCSV, exportToWord, exportToPowerPoint,
  exportToMarkdown, exportToJSON, type ExportPayload,
} from "@/lib/exports";

const RUNNERS: Record<ExportFormat, (p: ExportPayload, pdfPopup?: Window | null) => void | Promise<void>> = {
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
function downloadMachineAsset(filename: string, content: string, mime: string) {
  if (!content.trim()) return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const isMachinePackSection = (heading: string) =>
  /machine-readable pack|حزمة قراءة الآلة|پاکێجی|schema\.org json-ld|faqpage schema|llms\.txt/i.test(heading);
const isGlossarySection = (heading: string) => /^(Glossary|فەرهەنگ|معجم المصطلحات)$/i.test(heading);
const isLinksAppendix = (heading: string) => /^(Result links|Links in report|روابط النتائج|بەستەرەکانی ئەنجام)$/i.test(heading);

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
  const [preparedPayload, setPreparedPayload] = useState<ExportPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [translateContent, setTranslateContent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const triggerId = useId();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pad = size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  const entity = preparedPayload?.entity;
  const hasMachineAssetData = Boolean(entity?.brand && (entity.site || entity.summary || entity.facts?.length || entity.faqs?.length));
  const machineAssetPack = entity?.brand && hasMachineAssetData
    ? buildPack({
        brand: entity.brand,
        site: entity.site,
        summary: entity.summary,
        lang: exportLang,
        onboarding: { facts: (entity.facts || []).join("\n"), faqs: entity.faqs },
      })
    : null;
  const basePreviewSections = preparedPayload
    ? preparedPayload.sections.filter((section) =>
        !isMachinePackSection(section.heading) && !isGlossarySection(section.heading) && !isLinksAppendix(section.heading)
      )
    : [];
  const previewEngineSections = preparedPayload?.engineAnswers?.length
    ? engineAnswerSections({ probe: { answers: preparedPayload.engineAnswers } }, exportLang)
    : [];
  const previewLinkSections = extractLinks(basePreviewSections).length
    ? [linksSection(basePreviewSections, exportLang)]
    : [];
  const translationPreviewSections = preparedPayload ? [
    ...previewEngineSections,
    ...basePreviewSections,
    ...previewLinkSections,
    { heading: "Export metadata", kind: "kv" as const, rows: [["Title", preparedPayload.title], ["Subtitle", preparedPayload.subtitle || ""]] as [string, string][] },
  ] : [];
  const translationPlan = collectExportTranslationPlan(translationPreviewSections);
  const payloadSummary = preparedPayload
    ? /seo|geo|audit|visibility|presence|تدقيق|ظهور|محور/i.test(preparedPayload.title + " " + preparedPayload.sections.map((section) => section.heading).join(" "))
      ? (exportLang === "en" ? "This audit export includes findings, available evidence, recommendations and recorded links." : exportLang === "ku" ? "ئەم هەناردەیە دۆزینەوەکان، بەڵگە بەردەستەکان، پێشنیارەکان و بەستەرە تۆمارکراوەکان لەخۆدەگرێت." : "هذا التقرير يتضمن النتائج والأدلة المتاحة والتوصيات والروابط المسجلة.")
      : preparedPayload.sections.some((section) => section.kind === "table" || section.kind === "cards")
        ? (exportLang === "en" ? "This structured export preserves available tables, cards and metrics." : exportLang === "ku" ? "ئەم هەناردەیە خشتە و کارت و پێوەرە بەردەستەکان دەپارێزێت." : "يحافظ هذا التصدير المنظم على الجداول والبطاقات والمؤشرات المتاحة.")
        : (exportLang === "en" ? "This export contains the current answer and any links actually present in it." : exportLang === "ku" ? "ئەم هەناردەیە وەڵامی ئێستا و ئەو بەستەرانەی بەڕاستی تێیدان لەخۆدەگرێت." : "يتضمن هذا التصدير الرد الحالي والروابط الموجودة فيه فعلياً.")
    : "";


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
  }, [open, exportLang, previewLoading, preparedPayload, translateContent]);

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

  const openExportMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setMenuPosition(null);
    setPreparedPayload(null);
    setPreviewLoading(true);
    setPreviewError(false);
    setTranslateContent(false);
    setOpen(true);
    Promise.resolve()
      .then(() => build())
      .then((payload) => setPreparedPayload(payload))
      .catch(() => setPreviewError(true))
      .finally(() => setPreviewLoading(false));
  };

  const run = async (f: ExportFormat) => {
    if (previewLoading || exporting) return;
    // Open the PDF window during the trusted click event, before async work can trigger popup blocking.
    const pdfPopup = f === "pdf" ? window.open("", "_blank", "width=900,height=1000") : undefined;
    if (pdfPopup) {
      try {
        pdfPopup.document.title = exportLang === "en" ? "Preparing report…" : exportLang === "ku" ? "ڕاپۆرت ئامادە دەکرێت…" : "يجري تجهيز التقرير…";
        if (pdfPopup.document.body) pdfPopup.document.body.textContent = exportLang === "en" ? "Preparing your report for printing…" : exportLang === "ku" ? "ڕاپۆرتەکەت بۆ چاپکردن ئامادە دەکرێت…" : "يجري تجهيز التقرير للطباعة…";
      } catch { /* The browser may restrict access to the new window. */ }
    }
    setOpen(false);
    setExporting(true);
    try {
      const basePayload = preparedPayload || await build();
      const p: ExportPayload = {
        ...basePayload,
        sections: basePayload.sections.map((section) => ({ ...section })),
        lang: exportLang,
        identity,
      };
      const { labelFor, localizeValue, glossarySection } = await import("@/lib/maaroof/report-sections");
      const base = p.sections.filter((section) =>
        !isMachinePackSection(section.heading) && !isGlossarySection(section.heading) && !isLinksAppendix(section.heading)
      );

      // The selected language localizes headings and known labels. Narrative text is translated only by explicit opt-in below.
      const loc: ExportPayload["sections"] = base.map((section) => ({
        ...section,
        heading: labelFor(section.heading, exportLang),
        rows: section.rows?.map(([key, value]) => [
          labelFor(String(key), exportLang),
          typeof value === "string" ? auditExportText(value, exportLang) : localizeValue(value, exportLang),
        ] as [string, string | number]),
        table: section.table ? { ...section.table, columns: section.table.columns.map((column) => labelFor(column, exportLang)) } : undefined,
        cards: section.cards?.map((card) => ({
          ...card,
          status: card.status ? auditExportText(card.status, exportLang) : undefined,
          fields: card.fields?.map(([key, value]) => [
            labelFor(String(key), exportLang),
            typeof value === "string" ? auditExportText(value, exportLang) : localizeValue(value, exportLang),
          ] as [string, string | number]),
          notes: card.notes?.map((note) => auditExportText(note, exportLang)),
        })),
      }));

      const extra: ExportPayload["sections"] = [];
      if (extractLinks(loc).length > 0) extra.push(linksSection(loc, exportLang));

      const engineSecs = p.engineAnswers?.length
        ? engineAnswerSections({ probe: { answers: p.engineAnswers } }, exportLang)
        : [];
      let all = [
        ...engineSecs,
        ...loc.filter((section) => !isGlossary(section.heading)),
        ...extra,
      ];

      const { brandModelIds } = await import("@/lib/maaroof/model-council");
      const bm = (value: any) => (typeof value === "string" ? brandModelIds(value, exportLang) : value);
      for (const section of all) {
        if (isMachinePackSection(section.heading)) continue;
        section.text = bm(section.text);
        section.list = section.list?.map(bm);
        section.rows = section.rows?.map(([key, value]) => [key, bm(value)] as [string, string | number]);
        if (section.table) section.table = { ...section.table, data: section.table.data.map((row) => row.map(bm)) };
      }

      if (translateContent) {
        const metadataSection = {
          heading: "Export metadata",
          kind: "kv" as const,
          rows: [["Title", p.title], ["Subtitle", p.subtitle || ""]] as [string, string][],
        };
        const translatable = [...all, metadataSection];
        const plan = collectExportTranslationPlan(translatable);
        if (!plan.canTranslate) throw new Error("export_translation_limit");
        const result = await translateExportContent({
          data: { targetLang: exportLang, segments: plan.segments },
        });
        const translated = applyExportTranslations(translatable, result.translations);
        all = translated.slice(0, all.length);
        const translatedMetadata = translated[all.length];
        p.title = String(translatedMetadata?.rows?.[0]?.[1] || p.title);
        p.subtitle = String(translatedMetadata?.rows?.[1]?.[1] || p.subtitle || "") || undefined;
      }

      const glossary = glossarySection(all, exportLang);
      p.sections = glossary ? [...all, glossary] : all;
      await RUNNERS[f](p, f === "pdf" ? pdfPopup : undefined);
      if (f === "pdf" && !pdfPopup) {
        toast.warning(exportLang === "en" ? "The print window was blocked. An HTML report was downloaded; open it and choose Print / Save as PDF." : exportLang === "ku" ? "پەنجەرەی چاپ ڕێگری لێکرا؛ ڕاپۆرتی HTML داگرترا، بیکەرەوە و چاپ / پاشەکەوتکردن وەک PDF هەڵبژێرە." : "حظر المتصفح نافذة الطباعة؛ نُزّل تقرير HTML. افتحه واختر طباعة / حفظ بتنسيق PDF.");
      }
    } catch (error) {
      if (pdfPopup && !pdfPopup.closed) pdfPopup.close();
      const message = String(error instanceof Error ? error.message : error);
      if (message.includes("quota_exceeded")) {
        toast.error(exportLang === "en" ? "Translation quota or credits are not available. No file was exported." : exportLang === "ku" ? "سنووری وەرگێڕان یان کرێدیت بەردەست نییە؛ هیچ فایلێک هەناردە نەکرا." : "رصيد أو حصة الترجمة غير متاحين؛ لم يتم تصدير الملف.");
      } else if (message.includes("export_translation_limit")) {
        toast.error(exportLang === "en" ? "This report is too large for one translation batch. Export it in its original language." : exportLang === "ku" ? "ئەم ڕاپۆرتە بۆ یەک جار وەرگێڕان زۆر درێژە؛ بە زمانی سەرەکی هەناردەی بکە." : "التقرير كبير جداً لدفعة ترجمة واحدة. صدّره بلغته الأصلية.");
      } else {
        toast.error(exportLang === "en" ? "Export could not be completed. No partial file was intentionally created." : exportLang === "ku" ? "هەناردەکردن تەواو نەبوو؛ فایلێکی ناتەواو بە مەبەست دروست نەکرا." : "تعذر إكمال التصدير. لم يتم إنشاء ملف جزئي عمداً.");
      }
    } finally {
      setExporting(false);
    }
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
        onClick={openExportMenu}
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
            <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Lightbulb className="size-4 text-primary" />
                {exportLang === "en" ? "Before you export" : exportLang === "ku" ? "پێش هەناردەکردن" : "تلميح قبل التصدير"}
              </div>
              {previewLoading && <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />{exportLang === "en" ? "Preparing the content preview…" : exportLang === "ku" ? "پێشبینینی ناوەڕۆک ئامادە دەکرێت…" : "يجري تجهيز معاينة المحتوى…"}</div>}
              {previewError && <p className="py-2 text-xs text-destructive">{exportLang === "en" ? "The content preview failed. Close and reopen the export menu to retry." : exportLang === "ku" ? "پێشبینینی ناوەڕۆک شکستی هێنا؛ لیستەکە دابخە و دووبارە بیکەرەوە." : "تعذرت معاينة المحتوى. أغلق القائمة وأعد فتحها للمحاولة."}</p>}
              {!previewLoading && !previewError && preparedPayload && <p className="text-xs leading-5 text-muted-foreground">{payloadSummary}</p>}
              <div className="mt-2 grid gap-2">
                <div className="rounded-lg bg-background/75 px-2.5 py-2">
                  <div className="text-xs font-semibold">{exportLang === "en" ? "Example: a normal chat answer" : exportLang === "ku" ? "نموونە: وەڵامی ئاسایی چات" : "مثال: استشارة عادية"}</div>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{exportLang === "en" ? "The answer and links actually present in it; no unrelated brand assets." : exportLang === "ku" ? "وەڵام و بەستەرەکانی تێیدا؛ بەبێ فایلەکانی براندی بێ‌پەیوەندی." : "نص الإجابة والروابط الموجودة فيها فعلياً، دون أصول علامة غير مرتبطة."}</p>
                </div>
                <div className="rounded-lg bg-background/75 px-2.5 py-2">
                  <div className="text-xs font-semibold">{exportLang === "en" ? "Example: an SEO/GEO audit" : exportLang === "ku" ? "نموونە: پشکنینی SEO/GEO" : "مثال: تقرير تدقيق SEO/GEO"}</div>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{exportLang === "en" ? "Findings, measured axes, evidence and recommendations that exist in the report." : exportLang === "ku" ? "دۆزینەوەکان، تەوەرە پێوراوەکان، بەڵگە و پێشنیارەکانی ناو ڕاپۆرت." : "النتائج والمحاور المقاسة والأدلة والتوصيات الموجودة في التقرير."}</p>
                </div>
                <div className="rounded-lg bg-background/75 px-2.5 py-2">
                  <div className="text-xs font-semibold">{exportLang === "en" ? "Example: publish-ready drafts" : exportLang === "ku" ? "نموونە: ڕەشنووسی ئامادەی بڵاوکردنەوە" : "مثال: مسودات أصول للنشر"}</div>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{exportLang === "en" ? "Optional. They are included only when requested and there is enough entity data. They are drafts, not published files." : exportLang === "ku" ? "ئارەزوومەندانەیە؛ تەنها بە داواکاری و بە زانیاریی بەس دروست دەکرێن، و خۆکار بڵاو ناکرێنەوە." : "اختيارية؛ لا تُرفق إلا عند طلبها وتوافر بيانات كافية للكيان. وهي مسودات لا ملفات منشورة."}</p>
                </div>
              </div>
              <p className="mt-2 border-t border-primary/15 pt-2 text-[11px] leading-4 text-muted-foreground">
                {exportLang === "en" ? "Language selection translates report labels. The original body text stays unchanged unless you enable full-content translation." : exportLang === "ku" ? "هەڵبژاردنی زمان ناونیشان و لەیبڵەکان وەردەگێڕێت؛ دەقی سەرەکی بەبێ چالاککردنی وەرگێڕانی تەواو ناگۆڕێت." : "اختيار اللغة يغيّر العناوين والتسميات؛ ويبقى متن التقرير بلغته الأصلية ما لم تفعّل ترجمته."}
              </p>
            </div>

            {machineAssetPack && preparedPayload?.entity?.brand ? (
              <div className="mb-3 rounded-xl border border-border bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
                  <FileCode2 className="size-4 text-primary" />
                  {exportLang === "en" ? "Separate machine-readable files" : exportLang === "ku" ? "فایلە جیاوازەکانی خوێندنەوەی ئامێر" : "ملفات تقنية مستقلة"}
                </div>
                <p className="mb-3 text-[11px] leading-4 text-muted-foreground">
                  {exportLang === "en" ? "Download only the files that can be built from this report's entity data. Review every draft against your live website before publishing; no file is uploaded automatically." : exportLang === "ku" ? "تەنها ئەو فایلانە دابەزێنە کە لە زانیاریی قەوارەی ئەم ڕاپۆرتەوە دروست دەکرێن. پێش بڵاوکردنەوە هەر ڕەشنووسێک لەگەڵ ماڵپەڕی ڕاستەقینە بپشکنە؛ هیچ فایلێک خۆکار بارناکراوە." : "نزّل الملفات التي أمكن إنشاؤها من بيانات هذا الكيان فقط. راجع كل مسودة مقابل موقعك الفعلي قبل النشر؛ لا يُرفع أي ملف تلقائياً."}
                </p>
                <div className="grid gap-1.5">
                  {machineAssetPack.llms && (
                    <button type="button" onClick={() => downloadMachineAsset("llms.txt", machineAssetPack.llms, "text/plain;charset=utf-8")} className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-start transition hover:border-primary/20 hover:bg-primary/5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"><FileText className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">llms.txt</span>
                        <span className="block text-[11px] text-muted-foreground">{exportLang === "en" ? "Text summary of the entity's recorded facts and links" : exportLang === "ku" ? "پوختەی دەقیی ڕاستی و بەستەرە تۆمارکراوەکان" : "ملف نصي يلخص حقائق الكيان وروابطه المسجلة"}</span>
                      </span>
                      <Download className="size-4 text-primary" />
                    </button>
                  )}
                  {machineAssetPack.orgJsonld && (
                    <button type="button" onClick={() => downloadMachineAsset("organization.jsonld", machineAssetPack.orgJsonld, "application/ld+json;charset=utf-8")} className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-start transition hover:border-primary/20 hover:bg-primary/5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"><Braces className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">Organization JSON-LD</span>
                        <span className="block text-[11px] text-muted-foreground">{exportLang === "en" ? "Structured entity details; insert into the relevant page only after review" : exportLang === "ku" ? "زانیاریی ڕێکخراوی قەوارە؛ دوای پێداچوونەوە لە پەڕەی گونجاو دایبنێ" : "بيانات منظمة عن الكيان؛ تُدرج في الصفحة المناسبة بعد المراجعة"}</span>
                      </span>
                      <Download className="size-4 text-primary" />
                    </button>
                  )}
                  {machineAssetPack.faqJsonld && (
                    <button type="button" onClick={() => downloadMachineAsset("faqpage.jsonld", machineAssetPack.faqJsonld, "application/ld+json;charset=utf-8")} className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-start transition hover:border-primary/20 hover:bg-primary/5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"><FileCode2 className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">FAQPage JSON-LD</span>
                        <span className="block text-[11px] text-muted-foreground">{exportLang === "en" ? "Created only from recorded question/answer pairs" : exportLang === "ku" ? "تەنها لە پرسیار و وەڵامی تۆمارکراو دروست دەکرێت" : "ينشأ فقط من أزواج الأسئلة والأجوبة المسجلة"}</span>
                      </span>
                      <Download className="size-4 text-primary" />
                    </button>
                  )}
                </div>
                <p className="mt-2 border-t border-border/70 pt-2 text-[11px] leading-4 text-muted-foreground">
                  {exportLang === "en" ? "These are standalone files, not report appendices. Their facts, URLs and code remain in source form even when report-text translation is enabled." : exportLang === "ku" ? "ئەمە فایلە جیاوازن، نەک پاشکۆی ڕاپۆرت؛ ڕاستی و بەستەر و کۆدەکان بە شێوەی سەرچاوەکە دەمێننەوە." : "هذه ملفات مستقلة وليست ملاحق داخل التقرير. تبقى الحقائق والروابط والأكواد بلغتها الأصلية حتى عند تفعيل ترجمة نص التقرير."}
                </p>
              </div>
            ) : (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-[11px] leading-4 text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                {exportLang === "en" ? "Standalone machine-readable assets are unavailable because this result does not contain a specific entity and supporting facts." : exportLang === "ku" ? "فایلە جیاوازە تەکنیکییەکان بەردەست نین، چونکە قەوارە و زانیاریی پشتگیر لەم ئەنجامەدا نییە." : "لا تتوفر ملفات تقنية مستقلة لأن النتيجة لا تتضمن كياناً محدداً وبيانات داعمة كافية."}
              </div>
            )}

            <label className={"mb-3 flex items-start gap-2 rounded-xl border border-border bg-background/70 p-3 " + (translationPlan.canTranslate ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
              <input type="checkbox" checked={translateContent} disabled={!translationPlan.canTranslate || previewLoading || exporting} onChange={(event) => setTranslateContent(event.currentTarget.checked)} className="mt-0.5 accent-primary" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs font-semibold"><Languages className="size-4 text-primary" />{exportLang === "en" ? "Translate report text too" : exportLang === "ku" ? "دەقی ڕاپۆرتیش وەربگێڕە" : "ترجمة نص التقرير أيضاً"}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {translationPlan.canTranslate
                    ? (exportLang === "en" ? "Optional translation of narrative text. Estimated units: " + translationPlan.units + ". This uses translation credits only after you choose an export format." : exportLang === "ku" ? "وەرگێڕانی دەقی ڕاپۆرت بە ئارەزوو؛ یەکەی خەمڵێنراو: " + translationPlan.units + ". تەنها دوای هەڵبژاردنی فۆرمات کرێدیت بەکاردێت." : "اختيارية؛ وحدات الترجمة المقدّرة: " + translationPlan.units + ". لا يُستهلك رصيد الترجمة إلا بعد اختيار صيغة التصدير.")
                    : (exportLang === "en" ? "Translation is unavailable for this report size. Export it in its original content language." : exportLang === "ku" ? "وەرگێڕان بۆ ئەم قەبارەیە بەردەست نییە؛ بە زمانی سەرەکی هەناردەی بکە." : "الترجمة غير متاحة لحجم هذا التقرير؛ يمكنك تصديره بلغته الأصلية.")}
                </span>
              </span>
            </label>

            <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
              <Download className="size-3.5" />
              {exportLang === "en" ? "Choose an output format" : exportLang === "ku" ? "فۆرماتی هەناردە هەڵبژێرە" : "اختر صيغة الملف"}
            </div>
            <div className="grid gap-1">
              {available.map((f) => {
                const Icon = ICONS[f];
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={previewLoading || previewError || !preparedPayload || exporting}
                    onClick={() => run(f)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-start text-sm text-foreground transition duration-150 hover:-translate-y-px hover:border-primary/20 hover:bg-primary/10 hover:text-primary hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{labels[f]}</span>
                    {exporting ? <LoaderCircle className="size-4 animate-spin" /> : <span className="text-[10px] text-muted-foreground transition group-hover:text-primary" aria-hidden="true">↗</span>}
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
