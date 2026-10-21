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
