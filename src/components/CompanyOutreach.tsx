import { useEffect, useState } from "react";
import { Building2, Loader2, Mail, Copy, Check, Search, Sparkles, ExternalLink } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";
import { ToolLangSelect } from "@/components/ToolLangSelect";
import { ToolHelpBanner } from "@/components/ToolHelpBanner";
import { GeoScopeSelector } from "@/components/GeoScopeSelector";
import { HandoffMenu } from "@/components/HandoffMenu";
import { consumeHandoff } from "@/lib/tool-handoff";
import { apiFetch } from "@/lib/api-client";

type Mode = "search" | "email" | "brand";

export function CompanyOutreach() {
  const { t, lang } = useI18n();
  const [outLang, setOutLang] = useState<Lang>(lang);
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const specialty = (auth?.profile as any)?.specialty || "";

  const [mode, setMode] = useState<Mode>("email");
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState("");
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onReuse = (e: Event) => { const txt = (e as CustomEvent).detail?.text; if (txt) { const lines = String(txt).split("\n"); setCompany(lines[0].slice(0, 100)); setNotes(lines.slice(1).join("\n").slice(0, 2000)); } };
    window.addEventListener("geo:reuse-outreach", onReuse);
    const pending = consumeHandoff("outreach");
    if (pending) { const lines = pending.split("\n"); setCompany(lines[0].slice(0, 100)); setNotes(lines.slice(1).join("\n").slice(0, 2000)); }
    return () => window.removeEventListener("geo:reuse-outreach", onReuse);
  }, []);

  const run = async () => {
    if (!company.trim()) return;
    setLoading(true); setErr(""); setOut(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (auth as any)?.session;
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await apiFetch("/api/company-email", {
        method: "POST", headers,
        body: JSON.stringify({ company, sector, goal, notes, lang: outLang, mode }),
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

  const modes: { key: Mode; label: string; icon: any }[] = [
    { key: "search", label: t("outreach_mode_search"), icon: Search },
    { key: "email", label: t("outreach_mode_email"), icon: Mail },
    { key: "brand", label: t("outreach_mode_brand"), icon: Sparkles },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> {t("outreach_title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("outreach_desc")}</p>
          <ToolHelpBanner toolKey="outreach" />
          <div className="mt-3"><GeoScopeSelector compact toolKey="outreach" /></div>
        </div>
        <ToolLangSelect value={outLang} onChange={setOutLang} />
      </div>

      {specialty && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
          <Sparkles className="size-3" /> {t("specialty_active")}: <b>{specialty}</b>
        </div>
      )}

      {/* Mode selector */}
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/40 p-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button key={m.key} onClick={() => { setMode(m.key); setOut(null); }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${active ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="size-3.5" /> {m.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {mode === "search" && t("outreach_mode_search_desc")}
        {mode === "email" && t("outreach_mode_email_desc")}
        {mode === "brand" && t("outreach_mode_brand_desc")}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input value={company} onChange={(e) => setCompany(e.target.value)}
          placeholder={mode === "brand" ? t("outreach_brand_ph") : t("outreach_company")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder={t("outreach_sector")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        {mode === "email" && (
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t("outreach_goal")}
            className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm sm:col-span-2" />
        )}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("outreach_notes")} rows={3}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm sm:col-span-2" />
      </div>

      <button disabled={loading} onClick={run}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {loading ? <Loader2 className="size-4 animate-spin" /> : (mode === "email" ? <Mail className="size-4" /> : <Search className="size-4" />)}
        {mode === "search" ? t("outreach_run_search") : mode === "brand" ? t("outreach_run_brand") : t("outreach_run")}
      </button>

      {err && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}

      {out && (
        <div className="mt-4 space-y-3">
          {out.company_brief && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm leading-relaxed">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("outreach_brief")}</div>
              {out.company_brief}
            </div>
          )}
          {out.key_points?.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("outreach_key_points")}</div>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {out.key_points.map((p: string, i: number) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* Search-only extras */}
          {mode === "search" && out.website && (
            <a href={out.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              {out.website} <ExternalLink className="size-3" />
            </a>
          )}
          {mode === "search" && out.social && (
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(out.social).filter(([_, v]) => v).map(([k, v]) => (
                <a key={k} href={String(v)} target="_blank" rel="noreferrer" className="rounded-full border border-border bg-background/60 px-2.5 py-1 hover:border-primary">{k}</a>
              ))}
            </div>
          )}

          {/* Brand mode extras */}
          {mode === "brand" && out.competitors?.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("outreach_competitors")}</div>
              <div className="flex flex-wrap gap-1.5">
                {out.competitors.map((c: string, i: number) => (
                  <span key={i} className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs">{c}</span>
                ))}
              </div>
            </div>
          )}
          {mode === "brand" && out.opportunities?.length > 0 && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold text-success">{t("outreach_opportunities")}</div>
              <ol className="ms-5 list-decimal space-y-1">
                {out.opportunities.map((p: string, i: number) => <li key={i}>{p}</li>)}
              </ol>
            </div>
          )}

          {/* Email */}
          {mode === "email" && (out.email_subject || out.email_body) && (
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
          )}

          {/* Sources */}
          {out.sources?.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("research_sources")}</div>
              <ul className="space-y-1">
                {out.sources.map((s: any, i: number) => (
                  <li key={i} className="text-xs">
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      [{i + 1}] {s.title} {s.domain && <span className="text-muted-foreground">— {s.domain}</span>} <ExternalLink className="size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ExportButtons size="xs" build={() => ({
            title: t("outreach_title"), subtitle: company,
            sections: [
              { kind: "kv", heading: t("outreach_brief"), rows: [["", out.company_brief || ""]] },
              ...(out.email_subject || out.email_body ? [{ kind: "kv" as const, heading: t("outreach_email"),
                rows: [[t("col_subject"), out.email_subject || ""], [t("col_body"), out.email_body || ""]] as [string, string | number][] }] : []),
            ],
          })} />

          <HandoffMenu source="outreach" getText={() => `${company}\n${out.company_brief || ""}\n\n${out.email_body || ""}`} />
        </div>
      )}
    </div>
  );
}
