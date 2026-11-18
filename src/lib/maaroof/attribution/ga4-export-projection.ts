import type { ExportLang, ExportSection } from "@/lib/exports";
import type { Ga4AttributionProjection } from "./ga4-projection";

const LABELS: Record<ExportLang, {
  title: string;
  sessions: string;
  aiSessions: string;
  keyEvents: string;
  revenue: string;
  currency: string;
  channel: string;
  source: string;
  medium: string;
  campaign: string;
  limitations: string;
  warnings: string;
  measured: string;
  partial: string;
  unknown: string;
}> = {
  ar: {
    title: "ملخص GA4 للإحالات",
    sessions: "الجلسات",
    aiSessions: "جلسات إحالة AI",
    keyEvents: "الأحداث الرئيسية",
    revenue: "الإيراد",
    currency: "العملة",
    channel: "القناة",
    source: "المصدر",
    medium: "الوسيط",
    campaign: "الحملة",
    limitations: "حدود التقرير",
    warnings: "تحذيرات القراءة",
    measured: "مقاس",
    partial: "جزئي",
    unknown: "غير معروف",
  },
  en: {
    title: "GA4 referral summary",
    sessions: "Sessions",
    aiSessions: "AI referral sessions",
    keyEvents: "Key events",
    revenue: "Revenue",
    currency: "Currency",
    channel: "Channel",
    source: "Source",
    medium: "Medium",
    campaign: "Campaign",
    limitations: "Report limitations",
    warnings: "Read warnings",
    measured: "Measured",
    partial: "Partial",
    unknown: "Unknown",
  },
  ku: {
    title: "پوختەی ئاماژەکانی GA4",
    sessions: "دانیشتنەکان",
    aiSessions: "دانیشتنەکانی ئاماژەی AI",
    keyEvents: "ڕووداوە سەرەکییەکان",
    revenue: "داهات",
    currency: "دراو",
    channel: "کەناڵ",
    source: "سەرچاوە",
    medium: "ناوەند",
    campaign: "کەمپەین",
    limitations: "سنوورەکانی ڕاپۆرت",
    warnings: "ئاگادارکردنەوەکانی خوێندنەوە",
    measured: "پێوانەکراو",
    partial: "بەشێکی",
    unknown: "نەزانراو",
  },
};

export function toGa4AttributionExportSections(
  projection: Ga4AttributionProjection,
  lang: ExportLang,
): ExportSection[] {
  const labels = LABELS[lang];
  const summary: ExportSection = {
    heading: labels.title,
    kind: "kv",
    rows: [
      [labels.sessions, projection.totalSessions],
      [labels.aiSessions, projection.aiReferralSessions],
      [labels.keyEvents, projection.totalKeyEvents],
      [labels.revenue, projection.totalRevenue ?? "—"],
      [labels.currency, projection.currencyCode || "—"],
      ["Status", labels[projection.measurementStatus]],
    ],
  };

  const sources: ExportSection = {
    heading: labels.title,
    kind: "table",
    table: {
      columns: [labels.channel, labels.source, labels.medium, labels.campaign, labels.sessions, labels.keyEvents, labels.revenue, labels.currency],
      data: projection.channels.map((row) => [
        row.channel,
        row.source || "(not set)",
        row.medium || "(not set)",
        row.campaign || "(not set)",
        row.sessions,
        row.keyEvents,
        row.totalRevenue ?? "—",
        row.currencyCode || "—",
      ]),
    },
  };

  return [
    summary,
    sources,
    { heading: labels.warnings, kind: "list", list: projection.warnings },
    { heading: labels.limitations, kind: "list", list: projection.limitations },
  ];
}
