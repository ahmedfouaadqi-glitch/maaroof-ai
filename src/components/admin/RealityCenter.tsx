// Part 19 — Reality Center admin panel (Truth Center).
// Rendered inside the existing Intelligence Center shell (no new dashboard page).
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { Microscope, RefreshCw, Loader2, AlertTriangle, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { getRealityCenter, getRealityEvidence, getExecutionInspector } from "@/lib/maaroof-reality.functions";
import { RealityLabSection } from "./RealityLab";
import { VERIFICATION_STATES, stateLabel } from "@/lib/maaroof/truth";

const STATE_LABELS: Record<string, string> = {
  verified: "مُتحقَّق",
  measured: "مقاس",
  executed: "منفَّذ",
  simulated: "محاكى",
  predicted: "متوقَّع",
  assumed: "مفترَض",
  unknown: "غير معروف",
};

const STATE_TONE: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  measured: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  executed: "bg-primary/15 text-primary border-primary/30",
  simulated: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  predicted: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  assumed: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint ? <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ExecutionInspector() {
  const { t, lang } = useI18n();
  const load = useServerFn(getExecutionInspector);
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const fetchRows = async (s: string) => {
    setBusy(true);
    try {
      const r: any = await load({ data: s ? { state: s, limit: 25 } : { limit: 25 } });
      setRows(r.executions || []);
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void fetchRows(state); }, [state]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-semibold text-muted-foreground">{t("auto.execution_inspector")}</div>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="rounded-lg border border-border/60 bg-background px-2 py-1 text-[11px]"
        >
          <option value="">{t("auto.all_states")}</option>
          {VERIFICATION_STATES.map((s) => (
            <option key={s} value={s}>{stateLabel(s, lang)}</option>
          ))}
        </select>
        {busy ? <Loader2 className="size-3 animate-spin" /> : null}
      </div>
      {!rows?.length && !busy && <div className="text-[11px] text-muted-foreground">{t("auto.no_data_yet")}</div>}
      {(rows || []).map((e: any) => (
        <div key={e.id} className="rounded-xl border border-border/50 bg-background/40">
          <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-center gap-2 p-2 text-start">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{e.mode}</span>
            <span className="flex-1 truncate text-[11px]">{e.goal}</span>
            <span className="text-[10px] text-muted-foreground">{e.rollup?.verdict} {e.rollup?.done}/{e.rollup?.total}</span>
            <ChevronDown className={`size-3 transition ${open === e.id ? "rotate-180" : ""}`} />
          </button>
          {open === e.id && (
            <div className="border-t border-border/50 p-2 space-y-1">
              {(e.tasks || []).map((tk: any) => (
                <div key={tk.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATE_TONE[String(tk.verification_state || "").toLowerCase()] || STATE_TONE.unknown}`}>
                    {stateLabel(tk.verification_state, lang)}
                  </span>
                  <span className="flex-1 truncate">{tk.seq}. {tk.title}</span>
                  <span className="text-muted-foreground">{tk.execution_kind || "—"}</span>
                  <span className="text-muted-foreground">{tk.provider || "—"}</span>
                  <span className="text-muted-foreground">{tk.duration_ms != null ? `${tk.duration_ms}ms` : "—"}</span>
                  {tk.error ? <span className="text-destructive truncate max-w-[40%]">{tk.error}</span> : null}
                </div>
              ))}
              {!(e.tasks || []).length && <div className="text-[11px] text-muted-foreground">{t("auto.no_data_yet")}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function RealityCenterSection() {
  const { t } = useI18n();
  const load = useServerFn(getRealityCenter);
  const loadEvidence = useServerFn(getRealityEvidence);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Record<string, any[]>>({});
  const [stateFilter, setStateFilter] = useState("");
  const [query, setQuery] = useState("");

  const refresh = async () => {
    try { setData(await load()); }
    catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const gaps = useMemo(() => {
    const all: any[] = data?.gaps || [];
    const q = query.trim().toLowerCase();
    return all.filter(
      (g) =>
        (!stateFilter || g.reality_state === stateFilter) &&
        (!q || String(g.subject || "").toLowerCase().includes(q)),
    );
  }, [data, stateFilter, query]);


  const toggle = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!evidence[id]) {
      try {
        const r: any = await loadEvidence({ data: { recordId: id } });
        setEvidence((p) => ({ ...p, [id]: r.items || [] }));
      } catch (e: any) { toast.error(String(e?.message || e)); }
    }
  };

  if (loading) return <div className="p-6 text-center"><Loader2 className="size-4 animate-spin inline" /></div>;
  if (!data) return null;

  const enabled = !!data.settings?.enabled;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Microscope className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("auto.reality_center")}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${enabled ? STATE_TONE.verified : STATE_TONE.unknown}`}>
          {enabled ? t("auto.active") : t("auto.disabled")}
        </span>
        <button onClick={() => { setLoading(true); void refresh(); }} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] hover:bg-muted/40">
          <RefreshCw className="size-3" /> {t("auto.refresh")}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label={t("auto.records")} value={data.total} />
        <Stat label={t("auto.avg_reality")} value={`${data.avg_reality}%`} />
        <Stat label={t("auto.avg_evidence")} value={`${data.avg_evidence}%`} />
        <Stat label={t("auto.avg_verification")} value={`${data.avg_verification}%`} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground">{t("auto.reality_states")}</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(data.by_state || {}).map(([k, v]) => (
            <span key={k} className={`rounded-full border px-2 py-0.5 text-[10px] ${STATE_TONE[k] || STATE_TONE.unknown}`}>
              {STATE_LABELS[k] || k}: {String(v)}
            </span>
          ))}
          {!Object.keys(data.by_state || {}).length && (
            <span className="text-[11px] text-muted-foreground">{t("auto.no_data_yet")}</span>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-2 pt-1">
          <Bar label={t("auto.avg_reality")} value={data.avg_reality} />
          <Bar label={t("auto.avg_confidence")} value={data.avg_confidence} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <AlertTriangle className="size-3 text-amber-500" /> {t("auto.verification_gaps")}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="ms-auto rounded-lg border border-border/60 bg-background px-2 py-1 font-normal"
          >
            <option value="">{t("auto.all_states")}</option>
            {Object.keys(STATE_LABELS).map((s) => (
              <option key={s} value={s}>{STATE_LABELS[s]}</option>
            ))}
          </select>
          <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background px-2 py-1">
            <Search className="size-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("auto.search")}
              aria-label={t("auto.search")}
              className="w-28 bg-transparent font-normal outline-none"
            />
          </span>
        </div>
        {!gaps.length && <div className="text-[11px] text-muted-foreground">{t("auto.no_gaps_recorded")}</div>}
        {gaps.map((g: any) => (
          <div key={g.id} className="rounded-xl border border-border/50 bg-background/40">
            <button onClick={() => toggle(g.id)} className="flex w-full items-center gap-2 p-2 text-start">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATE_TONE[g.reality_state] || STATE_TONE.unknown}`}>
                {STATE_LABELS[g.reality_state] || g.reality_state}
              </span>
              <span className="text-[11px] text-muted-foreground">{g.subject}</span>
              <span className="text-[11px]">{g.reality_score}%</span>
              <ChevronDown className={`ms-auto size-3 transition ${openId === g.id ? "rotate-180" : ""}`} />
            </button>
            {openId === g.id && (
              <div className="border-t border-border/50 p-2 space-y-2">
                {!!(g.missing_evidence || []).length && (
                  <div className="text-[11px] text-amber-500">
                    {t("auto.missing_evidence")}: {(g.missing_evidence || []).join(" · ")}
                  </div>
                )}
                {!!(g.contradictions || []).length && (
                  <div className="text-[11px] text-destructive">
                    {t("auto.contradictions")}: {(g.contradictions || []).join(" · ")}
                  </div>
                )}
                <div className="space-y-1">
                  {(evidence[g.id] || []).map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 text-[11px]">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{e.source_kind}</span>
                      <span className="flex-1 truncate">{e.claim || e.source_ref || "—"}</span>
                      <span className="text-muted-foreground">×{e.weight}</span>
                    </div>
                  ))}
                  {evidence[g.id] && !evidence[g.id].length && (
                    <div className="text-[11px] text-muted-foreground">{t("auto.no_evidence_items")}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50 p-3">
        <RealityLabSection />
      </div>
    </div>
  );
}
