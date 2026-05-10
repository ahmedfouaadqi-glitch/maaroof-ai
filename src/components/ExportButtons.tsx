import { FileDown, FileSpreadsheet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { exportToPDF, exportToExcel, type ExportPayload } from "@/lib/exports";

export function ExportButtons({
  build,
  size = "sm",
  className = "",
}: {
  build: () => ExportPayload;
  size?: "sm" | "xs";
  className?: string;
}) {
  const { t, lang } = useI18n();
  const pad = size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  const onPDF = () => {
    const p = build();
    p.lang = (lang as any) || "ar";
    exportToPDF(p);
  };
  const onXLSX = () => {
    const p = build();
    p.lang = (lang as any) || "ar";
    exportToExcel(p);
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onPDF}
        className={`inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 ${pad} font-semibold text-primary transition hover:bg-primary/20`}
        title={t("export_pdf")}
      >
        <FileDown className="size-3.5" /> {t("export_pdf")}
      </button>
      <button
        type="button"
        onClick={onXLSX}
        className={`inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 ${pad} font-semibold text-success transition hover:bg-success/20`}
        title={t("export_excel")}
      >
        <FileSpreadsheet className="size-3.5" /> {t("export_excel")}
      </button>
    </div>
  );
}
