import { exportToExcel, type ExportPayload, type ExportLang } from "@/lib/exports";

export type PulseMetricRow = {
  metric_key: string;
  sector: string;
  value: number | null;
  unit: string | null;
  captured_at: string;
  governorate?: string | null;
};

export type PulseAppRow = {
  app_name: string;
  category: string | null;
  rank: number;
  governorate?: string | null;
};

export function exportPulseReport(opts: {
  title: string;
  subtitle?: string;
  lang?: ExportLang;
  metrics: PulseMetricRow[];
  apps?: PulseAppRow[];
  assistantMarkdown?: string;
}) {
  const sections: ExportPayload["sections"] = [];

  if (opts.metrics.length > 0) {
    sections.push({
      heading: opts.lang === "en" ? "Metrics" : opts.lang === "ku" ? "پێوەرەکان" : "المؤشرات",
      kind: "table",
      table: {
        columns: ["metric_key", "sector", "value", "unit", "governorate", "captured_at"],
        data: opts.metrics.map((m) => [
          m.metric_key,
          m.sector,
          m.value ?? "",
          m.unit ?? "",
          m.governorate ?? "—",
          new Date(m.captured_at).toLocaleString(),
        ]),
      },
    });
  }

  if (opts.apps && opts.apps.length > 0) {
    sections.push({
      heading: opts.lang === "en" ? "Trending apps" : opts.lang === "ku" ? "ئەپە بەناوبانگەکان" : "التطبيقات الأكثر تداولاً",
      kind: "table",
      table: {
        columns: ["rank", "app_name", "category", "governorate"],
        data: opts.apps.map((a) => [a.rank, a.app_name, a.category ?? "—", a.governorate ?? "—"]),
      },
    });
  }

  if (opts.assistantMarkdown) {
    sections.push({
      heading: opts.lang === "en" ? "Strategic analysis" : opts.lang === "ku" ? "شیکاری ستراتیجی" : "التحليل الاستراتيجي",
      kind: "text",
      text: opts.assistantMarkdown,
    });
  }

  exportToExcel({
    title: opts.title,
    subtitle: opts.subtitle,
    lang: opts.lang,
    sections,
  });
}
