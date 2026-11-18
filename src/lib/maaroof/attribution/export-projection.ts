import type { ExportSection, ExportLang } from "@/lib/exports";
import type { AttributionProjection } from "./projection";

const LABELS: Record<ExportLang, {
  summary: string;
  sourceBreakdown: string;
  channel: string;
  source: string;
  credit: string;
  attributedRevenue: string;
  currency: string;
  trafficEvents: string;
  duplicateEvents: string;
  humanSessions: string;
  aiReferralSessions: string;
  crawlerSessions: string;
  eventsWithoutSessionId: string;
  aiReferrals: string;
  crawlerEvents: string;
  conversions: string;
  unattributed: string;
  status: string;
  limitations: string;
  measured: string;
  partial: string;
  unknown: string;
}> = {
  ar: {
    summary: "ملخص الإسناد",
    sourceBreakdown: "توزيع الإسناد حسب المصدر",
    channel: "القناة",
    source: "المصدر",
    credit: "حصة التحويلات",
    attributedRevenue: "الإيراد المنسوب",
    currency: "العملة",
    trafficEvents: "أحداث الزيارات المسجلة",
    duplicateEvents: "الأحداث المكررة المستبعدة",
    humanSessions: "الجلسات البشرية",
    aiReferralSessions: "جلسات إحالة AI",
    crawlerSessions: "جلسات الزواحف",
    eventsWithoutSessionId: "أحداث بلا معرّف جلسة",
    aiReferrals: "إحالات AI المسجلة",
    crawlerEvents: "أحداث الزواحف",
    conversions: "التحويلات المؤكدة",
    unattributed: "تحويلات بلا إسناد",
    status: "حالة القياس",
    limitations: "حدود القياس",
    measured: "مقاس",
    partial: "جزئي",
    unknown: "غير معروف",
  },
  en: {
    summary: "Attribution summary",
    sourceBreakdown: "Attribution by source",
    channel: "Channel",
    source: "Source",
    credit: "Conversion credit",
    attributedRevenue: "Attributed revenue",
    currency: "Currency",
    trafficEvents: "Recorded traffic events",
    duplicateEvents: "Duplicate events excluded",
    humanSessions: "Human sessions",
    aiReferralSessions: "AI referral sessions",
    crawlerSessions: "Crawler sessions",
    eventsWithoutSessionId: "Events without session ID",
    aiReferrals: "Recorded AI referrals",
    crawlerEvents: "Crawler events",
    conversions: "Confirmed conversions",
    unattributed: "Unattributed conversions",
    status: "Measurement status",
    limitations: "Measurement limitations",
    measured: "Measured",
    partial: "Partial",
    unknown: "Unknown",
  },
  ku: {
    summary: "پوختەی ئەتریبیوشن",
    sourceBreakdown: "دابەشکردنی ئەتریبیوشن بەپێی سەرچاوە",
    channel: "کەناڵ",
    source: "سەرچاوە",
    credit: "بەشی گۆڕانکاری",
    attributedRevenue: "داهاتی تەرخانکراو",
    currency: "دراو",
    trafficEvents: "ڕووداوەکانی هاتووچۆی تۆمارکراو",
    duplicateEvents: "ڕووداوە دووبارەکان لابراون",
    humanSessions: "دانیشتنە مرۆییەکان",
    aiReferralSessions: "دانیشتنەکانی ئاماژەی AI",
    crawlerSessions: "دانیشتنەکانی کراولەر",
    eventsWithoutSessionId: "ڕووداوەکانی بێ ناسنامەی دانیشتن",
    aiReferrals: "ئاماژەکانی AI",
    crawlerEvents: "ڕووداوەکانی کراولەر",
    conversions: "گۆڕانکارییە پشتڕاستکراوەکان",
    unattributed: "گۆڕانکارییە بێ ئەتریبیوشنەکان",
    status: "دۆخی پێوانەکردن",
    limitations: "سنوورەکانی پێوانەکردن",
    measured: "پێوانەکراو",
    partial: "بەشێکی",
    unknown: "نەزانراو",
  },
};

function statusLabel(status: AttributionProjection["measurementStatus"], lang: ExportLang): string {
  return LABELS[lang][status];
}

/** Pure export projection. The caller chooses whether to append these sections. */
export function toAttributionExportSections(
  projection: AttributionProjection,
  lang: ExportLang,
): ExportSection[] {
  const labels = LABELS[lang];
  const summary: ExportSection = {
    heading: labels.summary,
    kind: "kv",
    rows: [
      [labels.status, statusLabel(projection.measurementStatus, lang)],
      [labels.trafficEvents, projection.counts.acceptedTrafficEvents],
      [labels.duplicateEvents, projection.counts.duplicateTrafficEventsExcluded],
      [labels.humanSessions, projection.counts.humanSessions],
      [labels.aiReferralSessions, projection.counts.aiReferralSessions],
      [labels.crawlerSessions, projection.counts.crawlerSessions],
      [labels.eventsWithoutSessionId, projection.counts.eventsWithoutSessionId],
      [labels.aiReferrals, projection.counts.aiReferralEvents],
      [labels.crawlerEvents, projection.counts.crawlerMarkerEvents],
      [labels.conversions, projection.counts.confirmedConversions],
      [labels.unattributed, projection.counts.unattributedConversions],
    ],
  };

  const breakdown: ExportSection = {
    heading: labels.sourceBreakdown,
    kind: "table",
    table: {
      columns: [labels.channel, labels.source, labels.credit, labels.attributedRevenue, labels.currency],
      data: projection.channelAttribution.map((row) => [
        row.channel,
        row.source || "(not set)",
        Number(row.conversionCredit.toFixed(4)),
        Number(row.attributedRevenue.toFixed(4)),
        row.currency,
      ]),
    },
  };

  const limitations: ExportSection = {
    heading: labels.limitations,
    kind: "list",
    list: projection.limitations,
  };

  return [summary, breakdown, limitations];
}
