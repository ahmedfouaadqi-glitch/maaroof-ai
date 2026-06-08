import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVisibility } from "@/lib/visibility";
import { exportToPDF, exportToExcel, exportToCSV, type ExportPayload } from "@/lib/exports";

export function ExportButtons({
  build,
  size = "sm",
  className = "",
  formats = ["pdf", "xlsx", "csv"],
}: {
  build: () => ExportPayload;
  size?: "sm" | "xs";
  className?: string;
  formats?: Array<"pdf" | "xlsx" | "csv">;
}) {
  const { t, lang } = useI18n();
  const vis = useVisibility();
  const pad = size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  if (!vis.loading && !vis.isWidgetVisible("results_export")) return null;

  const run = (fn: (p: ExportPayload) => void) => {
    const p = build();
    p.lang = (lang as any) || "ar";
    fn(p);
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {formats.includes("pdf") && (
        <button
          type="button"
          onClick={() => run(exportToPDF)}
          className={`inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 ${pad} font-semibold text-primary transition hover:bg-primary/20`}
          title={t("export_pdf")}
        >
          <FileDown className="size-3.5" /> {t("export_pdf")}
        </button>
      )}
      {formats.includes("xlsx") && (
        <button
          type="button"
          onClick={() => run(exportToExcel)}
          className={`inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 ${pad} font-semibold text-success transition hover:bg-success/20`}
          title={t("export_excel")}
        >
          <FileSpreadsheet className="size-3.5" /> {t("export_excel")}
        </button>
      )}
      {formats.includes("csv") && (
        <button
          type="button"
          onClick={() => run(exportToCSV)}
          className={`inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 ${pad} font-semibold text-accent transition hover:bg-accent/20`}
          title="CSV"
        >
          <FileText className="size-3.5" /> CSV
        </button>
      )}
    </div>
  );
}
