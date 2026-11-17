import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ReportsCenter } from "./ReportsCenter";
import { ReportPreviewModal } from "./ReportPreviewModal";
import { WhiteLabelSettingsModal } from "./WhiteLabelSettingsModal";
import type { ReportCenterItem } from "@/lib/reports/reports-center";
import { listReports, getReport, approveReport, createShareLink, getReportBranding, saveReportBranding } from "@/lib/reports/reports.functions";
import { exportToExcel } from "@/lib/exports";

type L = "ar" | "en" | "ku";
const T = {
  ar: { pick: "اختر مساحة عمل لعرض تقاريرها.", brand: "هوية التقرير", copied: "نُسخ رابط المشاركة (صالح 30 يوماً)", fail: "تعذّر تنفيذ العملية" },
  en: { pick: "Select a workspace to see its reports.", brand: "Report branding", copied: "Share link copied (valid 30 days)", fail: "Action failed" },
  ku: { pick: "شوێنێک هەڵبژێرە بۆ بینینی ڕاپۆرتەکان.", brand: "ناسنامەی ڕاپۆرت", copied: "بەستەر کۆپی کرا (٣٠ ڕۆژ)", fail: "کردارەکە سەرنەکەوت" },
};

export function ReportsPanel({ lang, workspaceId }: { lang: L; workspaceId: string | null }) {
  const t = T[lang];
  const list = useServerFn(listReports), get = useServerFn(getReport), approve = useServerFn(approveReport);
  const share = useServerFn(createShareLink), getBrand = useServerFn(getReportBranding), saveBrand = useServerFn(saveReportBranding);
  const [items, setItems] = useState<ReportCenterItem[]>([]);
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null);
  const [brandOpen, setBrandOpen] = useState(false);
  const [brand, setBrand] = useState<any>({});

  const reload = useCallback(async () => {
    if (!workspaceId) { setItems([]); return; }
    try { setItems(await list({ data: { workspaceId } }) as any); } catch { toast.error(t.fail); }
  }, [workspaceId]);
  useEffect(() => { void reload(); }, [reload]);

  const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e: any) { toast.error(`${t.fail}: ${e?.message || ""}`); } };
  if (!workspaceId) return <p className="rounded-xl border p-6 text-sm text-muted-foreground">{t.pick}</p>;

  return <div className="space-y-3">
    <div className="flex justify-end"><button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => run(async () => { setBrand(await getBrand({ data: { workspaceId } })); setBrandOpen(true); })}>{t.brand}</button></div>
    <ReportsCenter reports={items} workspaceId={workspaceId}
      onPreview={(r) => run(async () => { const x = await get({ data: { id: r.reportId } }); setPreview({ title: x.title, html: x.html }); })}
      onApprove={(r) => run(async () => { await approve({ data: { id: r.reportId } }); await reload(); })}
      onDownloadHtml={(r) => run(async () => { const x = await get({ data: { id: r.reportId } }); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([x.html], { type: "text/html;charset=utf-8" })); a.download = `${x.title.replace(/[\/\\:*?"<>|]/g, "_")}.html`; a.click(); URL.revokeObjectURL(a.href); })}
      onDownloadExcel={(r) => run(async () => { const x = await get({ data: { id: r.reportId } }); await exportToExcel(x.payload); })}
      onCopyShareLink={(r) => run(async () => { const s = await share({ data: { id: r.reportId } }); await navigator.clipboard.writeText(`${window.location.origin}/reports/share/${s.token}`); toast.success(t.copied); })}
    />
    <ReportPreviewModal open={!!preview} title={preview?.title || ""} html={preview?.html || ""} onClose={() => setPreview(null)} />
    <WhiteLabelSettingsModal open={brandOpen} workspaceId={workspaceId} initial={{ companyName: brand.companyName || "", logoUrl: brand.logoUrl || "", brandColor: brand.brandColor || undefined }} onClose={() => setBrandOpen(false)}
      onSave={(v) => run(async () => { await saveBrand({ data: { workspaceId, companyName: v.companyName, logoUrl: v.logoUrl, brandColor: v.brandColor } }); setBrandOpen(false); })} />
  </div>;
}
