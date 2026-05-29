import { Printer } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function PrintAnalysisButton({ targetId, label }: { targetId: string; label?: string }) {
  const { t } = useI18n();
  const handle = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const styles = `
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;color:#111}
      h1,h2,h3{color:#0a4}
      .card{border:1px solid #ddd;border-radius:10px;padding:12px;margin:8px 0}
      .muted{color:#666;font-size:12px}
      .row{display:flex;gap:8px;flex-wrap:wrap}
      .footer{margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:11px;color:#666}
    `;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t("print_title")}</title><style>${styles}</style></head><body>`);
    w.document.write(`<h1>${t("print_title")}</h1>`);
    w.document.write(el.innerHTML);
    w.document.write(`<div class="footer">geoiraq.com · ${new Date().toLocaleString()} · ${t("export_disclaimer")}</div>`);
    w.document.write(`</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 250);
  };
  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
    >
      <Printer className="size-3.5" /> {label || t("print_only_btn")}
    </button>
  );
}
