// Parts 12-13 admin panels — AI Model Center + Executive Decision Center.
// Rendered inside the existing Intelligence Center shell (no new dashboard page).
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { Layers, RefreshCw, Play, Loader2, Check, X, Download, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";
import {
  getModelCenter,
  reviewModelProposal,
  scanModelUpgrades,
  runModelBenchmark,
  getDecisionCenter,
  getRunDecisionTrace,
} from "@/lib/maaroof-models.functions";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

const money = (n: any) => `$${Number(n || 0).toFixed(4)}`;

/** Part 12 — AI Model Center: registry, real cost, health, benchmarks, proposals. */
import { ENGINES } from "@/components/engine-logos";
import { getEngineEntitlement } from "@/lib/ai-engines.functions";

/** المحركات التسعة ← النموذج المُختار حالياً لكل محرك (شفافية كاملة للإدارة). */
function NineEnginesMap() {
  const { t } = useI18n();
  const load = useServerFn(getEngineEntitlement);
  const [rows, setRows] = useState<any>(null);
  useEffect(() => { load().then(setRows).catch(() => {}); }, []);
  if (!rows) return null;
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="mb-2 text-xs font-semibold">{t("auto.nine_engines_models")}</div>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {ENGINES.map((e) => {
          const m = rows.models?.[e.key];
          return (
            <div key={e.key} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5 text-[11px]">
              <e.Logo size={14} />
              <span className="font-medium">{e.name}</span>
              <span className="ms-auto truncate text-muted-foreground" dir="ltr">{m?.model || "—"}</span>
              {e.proxy && <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600">proxy</span>}
              {m?.governed && <span className="rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-600">gov</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AiModelCenterSection() {
  const { t } = useI18n();
  const load = useServerFn(getModelCenter);
  const review = useServerFn(reviewModelProposal);
  const scan = useServerFn(scanModelUpgrades);
  const bench = useServerFn(runModelBenchmark);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [task, setTask] = useState(t("auto.write_a_5_point_geo_plan"));
  const [picked, setPicked] = useState<string[]>([]);

  const refresh = async () => {
    try {
      setData(await load());
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("auto.loading")}</div>;

  const models: any[] = data?.models || [];
  const gov = data?.governance || {};
  const totalSpend = models.reduce((a, m) => a + Number(m.total_usd || 0), 0);
  const active = models.filter((m) => m.status === "active").length;

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= 4 ? p : [...p, k]));

  const runBench = async () => {
    if (!picked.length) return toast.error(t("auto.choose_at_least_one_model"));
    setBusy("bench");
    try {
      const r: any = await bench({ data: { task, models: picked } });
      if (!r?.ok) toast.error(r?.error === "benchmark_disabled" ? t("auto.tests_are_off_from_settings") : String(r?.error));
      else toast.success(t("auto.benchmark_test_completed"));
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Layers className="size-4" /> {t("auto.ai_models_center")}</h3>
        <div className="flex gap-2">
          <button
            onClick={async () => { setBusy("scan"); try { const r: any = await scan({}); toast[r?.proposal_id ? "success" : "info"](r?.proposal_id ? t("auto.a_new_suggestion_has_been_recorded") : t("auto.no_better_model_currently")); await refresh(); } finally { setBusy(null); } }}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40"
          >
            {busy === "scan" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} فحص التحديثات
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t("auto.registered_models")} value={models.length} />
        <Stat label={t("auto.active_2")} value={active} />
        <Stat label={t("auto.actual_spending")} value={money(totalSpend)} />
        <Stat label={t("auto.governance")} value={gov.enabled ? t("auto.enabled_2") : t("auto.disabled")} />
      </div>

      <NineEnginesMap />


      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-2 text-start">{t("auto.selection")}</th>
              <th className="p-2 text-start">{t("auto.model")}</th>
              <th className="p-2 text-start">{t("auto.status")}</th>
              <th className="p-2 text-start">{t("auto.inference")}</th>
              <th className="p-2 text-start">{t("auto.speed")}</th>
              <th className="p-2 text-start">{t("auto.income_m")}</th>
              <th className="p-2 text-start">{t("auto.spent_m")}</th>
              <th className="p-2 text-start">{t("auto.calls")}</th>
              <th className="p-2 text-start">{t("auto.success_2")}</th>
              <th className="p-2 text-start">{t("auto.time_ms")}</th>
              <th className="p-2 text-start">{t("auto.actual_cost")}</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.model_key} className="border-t border-border/50">
                <td className="p-2"><input type="checkbox" checked={picked.includes(m.model_key)} onChange={() => toggle(m.model_key)} aria-label={`اختيار ${m.model_key}`} /></td>
                <td className="p-2 font-medium">{m.model_key}
                  {data?.defaults?.planner_model === m.model_key && <span className="ms-1 rounded bg-primary/15 px-1 text-[10px] text-primary">{t("auto.default")}</span>}
                </td>
                <td className="p-2">{m.status}</td>
                <td className="p-2">{m.capabilities?.reasoning ?? "—"}</td>
                <td className="p-2">{m.speed}</td>
                <td className="p-2">{m.cost_in_usd_per_mtok}</td>
                <td className="p-2">{m.cost_out_usd_per_mtok}</td>
                <td className="p-2">{m.calls}</td>
                <td className="p-2">{m.success_rate ?? "—"}</td>
                <td className="p-2">{m.avg_latency_ms ?? "—"}</td>
                <td className="p-2">{money(m.total_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border/60 p-3">
        <div className="mb-2 text-xs font-semibold">{t("auto.benchmark")}</div>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={2}
          aria-label={t("auto.benchmark_task")}
          className="w-full rounded-lg border border-border/60 bg-background p-2 text-xs"
        />
        <div className="mt-2 flex items-center gap-2">
          <button onClick={runBench} disabled={busy === "bench"} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-60">
            {busy === "bench" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} تشغيل على {picked.length || 0} نموذج
          </button>
          <span className="text-[11px] text-muted-foreground">{t("auto.accuracy_time_tokens_and_actual_cost")}</span>
        </div>

        {!!(data?.benchmarks || []).length && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr>
                <th className="p-1.5 text-start">{t("auto.model")}</th><th className="p-1.5 text-start">{t("auto.accuracy")}</th>
                <th className="p-1.5 text-start">{t("auto.inference")}</th><th className="p-1.5 text-start">{t("auto.time_4")}</th>
                <th className="p-1.5 text-start">{t("auto.tokens")}</th><th className="p-1.5 text-start">{t("auto.cost_3")}</th>
                <th className="p-1.5 text-start">{t("auto.date")}</th>
              </tr></thead>
              <tbody>
                {(data.benchmarks as any[]).slice(0, 12).map((b) => (
                  <tr key={b.id} className="border-t border-border/50">
                    <td className="p-1.5">{b.model_key}</td>
                    <td className="p-1.5">{b.accuracy ?? "—"}</td>
                    <td className="p-1.5">{b.reasoning_score ?? "—"}</td>
                    <td className="p-1.5">{b.latency_ms ?? "—"}</td>
                    <td className="p-1.5">{b.tokens}</td>
                    <td className="p-1.5">{money(b.usd)}</td>
                    <td className="p-1.5">{new Date(b.created_at).toLocaleString("ar")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/60 p-3">
        <div className="mb-2 text-xs font-semibold">{t("auto.upgrade_suggestions_not_applied_without_your")}</div>
        {!(data?.proposals || []).length && <div className="text-xs text-muted-foreground">{t("auto.no_suggestions_currently")}</div>}
        <div className="space-y-2">
          {(data?.proposals as any[]).map((p) => (
            <div key={p.id} className="rounded-lg border border-border/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium">{p.model_key} <span className="text-muted-foreground">— {p.status}</span></div>
                {p.status === "pending" && (
                  <div className="flex gap-1.5">
                    <button onClick={async () => { await review({ data: { id: p.id, decision: "approved" } }); toast.success(t("auto.approved")); await refresh(); }} className="flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-muted/40"><Check className="size-3" /> موافقة</button>
                    <button onClick={async () => { await review({ data: { id: p.id, decision: "rejected" } }); toast.success(t("auto.rejected")); await refresh(); }} className="flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-muted/40"><X className="size-3" /> {t("auto.reject")}</button>
                  </div>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{p.reason}</div>
              <div className="mt-1 text-[11px]">توفير متوقع: {p.expected_gain_pct ?? 0}% — خطة التراجع: {p.rollback_plan}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Part 13 — Decision Center: timeline, tree, score, alternatives, export. */
export function DecisionCenterSection() {
  const { t } = useI18n();
  const load = useServerFn(getDecisionCenter);
  const loadRun = useServerFn(getRunDecisionTrace);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [runTrace, setRunTrace] = useState<any>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setData(await load({ data: { search: search || undefined, stage: stage || undefined } }));
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const runsById = useMemo(() => new Map(((data?.runs as any[]) || []).map((r) => [r.id, r])), [data]);
  const grouped = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const t of ((data?.traces as any[]) || [])) {
      const k = t.run_id || "—";
      (g.get(k) || g.set(k, []).get(k)!).push(t);
    }
    return Array.from(g.entries());
  }, [data]);

  const openTrace = async (runId: string) => {
    if (openRun === runId) { setOpenRun(null); setRunTrace(null); return; }
    setOpenRun(runId);
    try { setRunTrace(await loadRun({ data: { runId } })); } catch (e: any) { toast.error(String(e?.message || e)); }
  };

  const download = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const exportTrace = (fmt: "json" | "csv" | "md") => {
    const rows: any[] = runTrace?.traces || [];
    if (!rows.length) return toast.error(t("auto.no_data_to_export"));
    if (fmt === "json") return download(`decision-${openRun}.json`, JSON.stringify({ run: runTrace.run, traces: rows }, null, 2), "application/json");
    if (fmt === "csv") {
      const head = "seq,stage,summary,cost_usd,confidence,alternatives\n";
      const body = rows.map((r) => [r.seq, r.stage, JSON.stringify(r.summary || ""), r.cost_usd, r.confidence ?? "", JSON.stringify(r.alternatives || [])].join(",")).join("\n");
      return download(`decision-${openRun}.csv`, head + body, "text/csv;charset=utf-8");
    }
    const md = [`# سجل القرار — ${runTrace?.run?.goal || openRun}`, "", ...rows.map((r) => `## ${r.seq}. ${r.stage}\n\n${r.summary || "—"}\n\n- التكلفة: ${money(r.cost_usd)}\n- الثقة: ${r.confidence ?? "—"}\n- بدائل مرفوضة: ${(r.alternatives || []).map((a: any) => `${a.option} (${a.reason})`).join("؛ ") || "—"}`)].join("\n");
    download(`decision-${openRun}.md`, md, "text/markdown;charset=utf-8");
  };

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><ScrollText className="size-4" /> {t("auto.executive_decision_center")}</h3>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("auto.search_decision_summaries")} aria-label={t("auto.search_decisions")} className="bg-transparent py-1.5 text-xs outline-none" />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label={t("auto.filter_by_stage")} className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs">
          <option value="">{t("auto.all_stages")}</option>
          {["goal_understanding","context_analysis","workspace_analysis","memory_analysis","knowledge_analysis","expert_selection","capability_selection","tool_selection","model_selection","execution_strategy","cost_analysis","risk_analysis","time_analysis","future_impact","execution","validation","approval","learning"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} تحديث
        </button>
      </div>

      {!grouped.length && !loading && (
        <div className="rounded-xl border border-border/60 p-4 text-xs text-muted-foreground">
          لا توجد قرارات مسجّلة بعد. فعّل «تتبّع القرار» من إعدادات معروف لبدء التسجيل.
        </div>
      )}

      <div className="space-y-2">
        {grouped.map(([runId, rows]) => {
          const run: any = runsById.get(runId);
          return (
            <div key={runId} className="rounded-xl border border-border/60">
              <button onClick={() => openTrace(runId)} className="flex w-full items-center justify-between gap-2 p-3 text-start">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{run?.goal || runId}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {rows.length} مرحلة · {money(run?.total_usd)} · {run?.steps_count ?? 0} خطوة · {run?.status || "—"}
                  </div>
                </div>
                <span className="text-[11px] text-primary">{openRun === runId ? t("auto.hide") : t("auto.view_tree")}</span>
              </button>

              {openRun === runId && runTrace && (
                <div className="border-t border-border/50 p-3">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(["json", "csv", "md"] as const).map((f) => (
                      <button key={f} onClick={() => exportTrace(f)} className="flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-muted/40">
                        <Download className="size-3" /> {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <ol className="space-y-2">
                    {(runTrace.traces as any[]).map((t) => (
                      <li key={t.id} className="rounded-lg border border-border/50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium">{t.seq}. {t.stage}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {t.cost_usd > 0 ? money(t.cost_usd) : ""} {t.confidence != null ? `· ثقة ${t.confidence}` : ""}
                          </div>
                        </div>
                        {t.summary && <div className="mt-1 text-[11px] text-muted-foreground">{t.summary}</div>}
                        {!!(t.alternatives || []).length && (
                          <ul className="mt-1.5 space-y-0.5 text-[11px]">
                            {(t.alternatives as any[]).map((a, i) => (
                              <li key={i} className="text-muted-foreground">✕ {a.option} — {a.reason}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
