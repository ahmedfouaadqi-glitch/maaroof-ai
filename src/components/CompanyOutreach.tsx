import { useState } from "react";
import { Building2, Loader2, Mail, Copy, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ExportButtons } from "@/components/ExportButtons";

export function CompanyOutreach() {
  const { t, lang } = useI18n();
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState("");
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!company.trim()) return;
    setLoading(true); setErr(""); setOut(null);
    try {
      const res = await fetch("/api/company-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, sector, goal, notes, lang }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setOut(j);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setLoading(false); }
  };

  const copyEmail = async () => {
    if (!out) return;
    const text = `${out.email_subject || ""}\n\n${out.email_body || ""}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Building2 className="size-5 text-primary" /> {t("outreach_title")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("outreach_desc")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("outreach_company")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder={t("outreach_sector")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t("outreach_goal")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm sm:col-span-2" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("outreach_notes")} rows={3}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm sm:col-span-2" />
      </div>
      <button disabled={loading} onClick={run}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        {t("outreach_run")}
      </button>
      {err && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}
      {out && (
        <div className="mt-4 space-y-3">
          {out.company_brief && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("outreach_brief")}</div>
              {out.company_brief}
            </div>
          )}
          {out.key_points?.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-sm">
              {out.key_points.map((p: string, i: number) => <li key={i}>{p}</li>)}
            </ul>
          )}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">{t("outreach_email")}</span>
              <button onClick={copyEmail} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? t("hist_copied") : t("hist_copy")}
              </button>
            </div>
            <div className="font-semibold">{out.email_subject}</div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{out.email_body}</pre>
          </div>
          <ExportButtons size="xs" build={() => ({
            title: t("outreach_title"), subtitle: company,
            sections: [
              { kind: "kv", heading: t("outreach_brief"), rows: [["", out.company_brief || ""]] },
              { kind: "kv", heading: t("outreach_email"),
                rows: [[t("col_subject"), out.email_subject || ""], [t("col_body"), out.email_body || ""]] },
            ],
          })} />
        </div>
      )}
    </div>
  );
}
