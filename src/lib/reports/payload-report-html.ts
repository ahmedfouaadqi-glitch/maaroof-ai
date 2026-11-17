// Pure: builds a self-contained, fully escaped client report HTML from an export payload.
// Values come only from the recorded tool result; empty fields read "not measured".
import type { ExportPayload, ExportSection } from "@/lib/exports";

export type ReportBrandingInput = { companyName?: string | null; logoUrl?: string | null; brandColor?: string | null; contact?: { phone?: string; email?: string } | null };
type Lang = "ar" | "en" | "ku";

const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escHtml = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => MAP[c] ?? c);
const T = {
  ar: { nm: "لم يُقَس", gen: "تاريخ الإعداد", by: "أُعدّ بواسطة", contact: "للتواصل" },
  en: { nm: "Not measured", gen: "Prepared on", by: "Prepared by", contact: "Contact" },
  ku: { nm: "نەپێوراوە", gen: "ڕێکەوتی ئامادەکردن", by: "ئامادەکراوە لەلایەن", contact: "پەیوەندی" },
};
export function safeColor(c?: string | null) { return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#0A0A0C"; }
export function safeHttpsUrl(u?: string | null) { return u && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; }

function cell(v: unknown, nm: string) { const s = String(v ?? "").trim(); return s ? escHtml(s) : `<em>${nm}</em>`; }

function section(s: ExportSection, nm: string): string {
  const h = `<h2>${escHtml(s.heading)}</h2>`;
  if (s.kind === "text") return `<section>${h}<p>${cell(s.text, nm).replace(/\n/g, "<br>")}</p></section>`;
  if (s.kind === "list") return `<section>${h}<ul>${(s.list || []).map((x) => `<li>${cell(x, nm)}</li>`).join("")}</ul></section>`;
  if (s.kind === "kv") return `<section>${h}<table>${(s.rows || []).map(([k, v]) => `<tr><th>${escHtml(k)}</th><td>${cell(v, nm)}</td></tr>`).join("")}</table></section>`;
  if (s.kind === "table" && s.table) return `<section>${h}<div class="x"><table><thead><tr>${s.table.columns.map((c) => `<th>${escHtml(c)}</th>`).join("")}</tr></thead><tbody>${s.table.data.map((r) => `<tr>${r.map((v) => `<td>${cell(v, nm)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  if (s.kind === "cards") return `<section>${h}<div class="g">${(s.cards || []).map((c) => `<article><h3>${escHtml(c.title)}</h3>${c.score == null ? `<p class="s"><em>${nm}</em></p>` : `<p class="s">${escHtml(c.score)}</p>`}${c.status ? `<p>${escHtml(c.status)}</p>` : ""}${(c.fields || []).map(([k, v]) => `<p><b>${escHtml(k)}:</b> ${cell(v, nm)}</p>`).join("")}</article>`).join("")}</div></section>`;
  return "";
}

export function buildPayloadReportHtml(payload: ExportPayload, branding: ReportBrandingInput = {}, lang: Lang = "ar", generatedAt = new Date().toISOString()): string {
  const t = T[lang] ?? T.ar, dir = lang === "en" ? "ltr" : "rtl", color = safeColor(branding.brandColor), logo = safeHttpsUrl(branding.logoUrl);
  const company = branding.companyName?.trim() || "MAAROOF AI";
  const contact = [branding.contact?.phone, branding.contact?.email].filter(Boolean).map(escHtml).join(" · ");
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escHtml(payload.title)}</title><style>
body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;margin:0;background:#f6f6f4;color:#111;line-height:1.6}
header{background:${color};color:#fff;padding:28px 24px}header img{max-height:48px;display:block;margin-bottom:12px}
h1{margin:0;font-size:26px}main{max-width:1000px;margin:0 auto;padding:20px}section{background:#fff;border-radius:12px;padding:18px;margin:14px 0;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h2{margin:0 0 10px;font-size:18px;border-inline-start:4px solid ${color};padding-inline-start:8px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #e5e5e5;padding:6px 8px;text-align:start;vertical-align:top}th{background:#fafafa}
.x{overflow-x:auto}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}article{border:1px solid #eee;border-radius:10px;padding:10px}.s{font-size:24px;font-weight:700;margin:4px 0}em{color:#888}footer{text-align:center;font-size:12px;color:#666;padding:20px}
@media print{body{background:#fff}section{box-shadow:none;break-inside:avoid}}</style></head><body>
<header>${logo ? `<img src="${escHtml(logo)}" alt="">` : ""}<h1>${escHtml(payload.title)}</h1>${payload.subtitle ? `<p>${escHtml(payload.subtitle)}</p>` : ""}<p>${t.gen}: ${escHtml(generatedAt.slice(0, 10))}</p></header>
<main>${payload.sections.map((s) => section(s, t.nm)).join("")}</main>
<footer>${t.by}: ${escHtml(company)}${contact ? ` — ${t.contact}: ${contact}` : ""}</footer></body></html>`;
}
