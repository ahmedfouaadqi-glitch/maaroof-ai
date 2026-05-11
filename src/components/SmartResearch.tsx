import { useState } from "react";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";

export function SmartResearch() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true); setErr(""); setOut(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, lang, scope: (profile as any)?.geo_scope }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setOut(j);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Search className="size-5 text-primary" /> {t("research_title")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("research_desc")}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("research_ph")}
          className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <button disabled={loading} onClick={run}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {t("research_run")}
        </button>
      </div>
      {err && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}
      {out && (
        <div className="mt-4 space-y-3" id="research-result">
          {out.answer && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">{out.answer}</div>}
          {out.sources?.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("research_sources")}</div>
              <ul className="space-y-1">
                {out.sources.map((s: any, i: number) => (
                  <li key={i} className="text-xs">
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      [{i + 1}] {s.title} <ExternalLink className="size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ExportButtons size="xs" build={() => ({
            title: t("research_title"), subtitle: q,
            sections: [
              { kind: "kv", heading: t("research_answer"), rows: [["", out.answer || ""]] },
              { kind: "table", heading: t("research_sources"),
                table: { columns: ["#", t("col_title"), "URL"], data: (out.sources || []).map((s: any, i: number) => [i + 1, s.title, s.url]) } },
            ],
          })} />
        </div>
      )}
    </div>
  );
}
