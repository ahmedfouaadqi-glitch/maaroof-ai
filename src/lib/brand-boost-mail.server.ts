function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
}

export type MonthlyBrandReport = {
  brandName: string;
  month: string;
  operationCount: number;
  completedCount: number;
  failedCount: number;
  chargedUnits: number;
  crawlerHits: number;
  verifiedCrawlerHits: number;
  crawlerBreakdown: Array<{ name: string; total: number; verified: number }>;
};

export async function sendBrandMonthlyReport(
  report: MonthlyBrandReport,
  emailTo: string,
  idempotencyKey: string,
): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BRAND_BOOST_REPORT_FROM;
  if (!apiKey || !from) throw new Error("monthly_report_email_not_configured");

  const rows = report.crawlerBreakdown.map((item) =>
    "<tr><td>" + escapeHtml(item.name) + "</td><td>" + item.total + "</td><td>" + item.verified + "</td></tr>",
  ).join("");
  const subject = "تقرير معروف الشهري — " + report.brandName + " — " + report.month;
  const html = [
    '<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Arial,sans-serif;color:#171717;line-height:1.7">',
    "<h1>تقرير معروف الشهري</h1><p><strong>" + escapeHtml(report.brandName) + "</strong> — " + escapeHtml(report.month) + "</p>",
    "<h2>ملخص العمليات</h2><ul>",
    "<li>إجمالي العمليات: " + report.operationCount + "</li>",
    "<li>عمليات مكتملة: " + report.completedCount + "</li>",
    "<li>عمليات فاشلة أو غير مكتملة: " + report.failedCount + "</li>",
    "<li>وحدات الاستخدام المسجلة: " + report.chargedUnits + "</li></ul>",
    "<h2>حركة الزواحف</h2><ul>",
    "<li>إجمالي الطلبات المسجلة: " + report.crawlerHits + "</li>",
    "<li>طلبات زواحف تم التحقق منها وفق آلية DNS المدعومة: " + report.verifiedCrawlerHits + "</li></ul>",
    "<table cellpadding='8' cellspacing='0' border='1'><thead><tr><th>الزاحف</th><th>الطلبات</th><th>المتحقق منها</th></tr></thead><tbody>",
    rows || "<tr><td colspan='3'>لا توجد زيارات مسجلة</td></tr>",
    "</tbody></table>",
    "<p style='color:#666;font-size:12px'>هذا التقرير يلخص العمليات والطلبات التي سجلها معروف فقط. لا يثبت أن محركاً فهرس المحتوى أو استخدمه في إجابة.</p>",
    '<p><a href="https://maaroofai.com">MAAROOF Ai</a></p></body></html>',
  ].join("");
  const text = [
    subject,
    "العمليات: " + report.operationCount + " | مكتملة: " + report.completedCount + " | فاشلة/جزئية: " + report.failedCount,
    "وحدات الاستخدام المسجلة: " + report.chargedUnits,
    "زيارات الزواحف: " + report.crawlerHits + " | زيارات موثقة DNS: " + report.verifiedCrawlerHits,
    ...report.crawlerBreakdown.map((item) => item.name + ": " + item.total + " (موثق: " + item.verified + ")"),
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [emailTo], subject, html, text }),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(payload?.message || payload?.error || "email_provider_http_" + response.status);
    throw new Error(message.slice(0, 300));
  }
  return { id: typeof payload?.id === "string" ? payload.id : null };
}
