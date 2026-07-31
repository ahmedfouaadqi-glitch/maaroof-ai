// System Health admin tab — surfaces diagnostics, cost-tracking gaps,
// negative-margin tools, unpriced calls, Firecrawl spikes, and the
// Manus/Kimi cost report.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2, TrendingDown, Gauge, Bug, FileText, Activity, Bot } from "lucide-react";
import { getSystemHealth, type HealthSnapshot } from "@/lib/system-health.functions";
import { useI18n } from "@/lib/i18n";

const fmt$ = (n: number, d = 4) => `$${(Number(n) || 0).toFixed(d)}`;

export function SystemHealthTab() {
  const { lang } = useI18n();
  const ar = lang === "ar"; const ku = lang === "ku";
  const t = (a: string, e: string, k: string) => (ar ? a : ku ? k : e);
  const run = useServerFn(getSystemHealth);
  const [data, setData] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { setData(await run({} as any) as any); }
    catch (e: any) { setErr(e?.message || "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading && !data) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  if (err) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{err}</div>;
  if (!data) return null;

  const issues =
    data.negativeMargin.length +
    data.unmeteredTools.length +
    data.toolsMissingInstrumentation.length +
    data.unpriced402.length +
    (data.firecrawlSpike ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-gradient">
            {t(t("auto.system_health"), "System Health", "تەندروستی سیستەم")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(t("auto.last_scan"), "Last scan", t("auto.latest"))}: {new Date(data.generatedAt).toLocaleString()} · {issues} {t(t("auto.problem"), "issues", "کێشە")}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs hover:border-primary">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} {t(t("auto.update"), "Refresh", "نوێ")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={<Activity />} label={t(t("auto.30_day_rows"), "Rows / 30d", "ڕیز")} value={String(data.totals.ledger_rows_30d)} />
        <Stat icon={<Gauge />} label={t(t("auto.measured_ratio"), "% Metered", "ڕێژەی")} value={`${data.totals.metered_pct}%`}
          tone={data.totals.metered_pct < 50 ? "warn" : "ok"} />
        <Stat icon={<TrendingDown />} label={t(t("auto.actual_cost_30_days"), "Real cost 30d", "تێچوون")} value={fmt$(data.totals.real_usd_30d)} />
        <Stat icon={<CheckCircle2 />} label={t(t("auto.margin"), "Margin", t("auto.margin_2"))} value={fmt$(data.totals.margin_usd_30d, 2)}
          tone={data.totals.margin_usd_30d < 0 ? "bad" : "ok"} />
      </div>

      {/* Negative margin */}
      <Section
        title={t(t("auto.negative_margin_the_tool_costs_more"), "Negative margin (tool costs more than charged)", "هامشی نەرێنی")}
        icon={<TrendingDown className="size-4 text-destructive" />}
        empty={data.negativeMargin.length === 0}
        emptyText={t(t("auto.no_tools_with_negative_margin_excellent"), "No tools with negative margin — great.", t("auto.none"))}
      >
        <table className="w-full text-xs">
          <thead className="bg-background/40 text-muted-foreground">
            <tr>
              <th className="p-2 text-start">{t(t("auto.tool"), "Tool", t("auto.tool_2"))}</th>
              <th className="p-2 text-end">{t(t("auto.acquired"), "Charged", "وەرگیراو")}</th>
              <th className="p-2 text-end">{t(t("auto.real"), "Real", "ڕاستی")}</th>
              <th className="p-2 text-end">{t(t("auto.margin"), "Margin", t("auto.margin_2"))}</th>
              <th className="p-2 text-end">{t(t("auto.orders"), "Requests", t("auto.request"))}</th>
            </tr>
          </thead>
          <tbody>
            {data.negativeMargin.map((r) => (
              <tr key={r.tool_key} className="border-t border-border/40">
                <td className="p-2 font-mono">{r.tool_key}</td>
                <td className="p-2 text-end">{fmt$(r.charged, 4)}</td>
                <td className="p-2 text-end">{fmt$(r.real, 4)}</td>
                <td className="p-2 text-end text-destructive">{fmt$(r.margin, 4)}</td>
                <td className="p-2 text-end">{r.requests}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t(t("auto.fix_raise_the_price_from_finance"), "Fix: raise charged price from Finance → Suggested charge.", "ڕاستکردنەوە")}
        </p>
      </Section>

      {/* Tools missing instrumentation */}
      <Section
        title={t(t("auto.tools_that_don_t_track_true"), "Tools missing real-cost instrumentation", "ئامرازی بێ پێوانە")}
        icon={<Bug className="size-4 text-warning" />}
        empty={data.toolsMissingInstrumentation.length === 0}
        emptyText={t(t("auto.all_tools_record_the_cost"), "All tools record cost.", "هەموو.")}
      >
        <div className="flex flex-wrap gap-2">
          {data.toolsMissingInstrumentation.map((k) => (
            <span key={k} className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 font-mono text-xs text-warning">{k}</span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t(t("auto.fix_add_enrichledger_after_each_ai"), "Fix: add enrichLedger after every AI call in these routes.", "ڕاستکردنەوە")}
        </p>
      </Section>

      {/* Unmetered legacy data */}
      <Section
        title={t(t("auto.old_unmeasured_data"), "Legacy unmetered data", "داتای بێ پێوانە")}
        icon={<AlertTriangle className="size-4 text-muted-foreground" />}
        empty={data.unmeteredTools.length === 0}
        emptyText={t(t("auto.none_2"), "None.", t("auto.none"))}
      >
        <table className="w-full text-xs">
          <thead className="bg-background/40 text-muted-foreground">
            <tr>
              <th className="p-2 text-start">{t(t("auto.tool"), "Tool", t("auto.tool_2"))}</th>
              <th className="p-2 text-end">{t(t("auto.unmeasured_rows"), "Unmetered rows", "ڕیز")}</th>
              <th className="p-2 text-end">{t(t("auto.last_seen"), "Last seen", t("auto.after"))}</th>
            </tr>
          </thead>
          <tbody>
            {data.unmeteredTools.map((r) => (
              <tr key={r.tool_key} className="border-t border-border/40">
                <td className="p-2 font-mono">{r.tool_key}</td>
                <td className="p-2 text-end">{r.rows}</td>
                <td className="p-2 text-end text-muted-foreground">{r.last_seen ? new Date(r.last_seen).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Unpriced 402s */}
      <Section
        title={t(t("auto.unpriced_attempts_402"), "Unpriced 402 attempts", "بێ نرخ")}
        icon={<AlertTriangle className="size-4 text-warning" />}
        empty={data.unpriced402.length === 0}
        emptyText={t(t("auto.none_2"), "None.", t("auto.none"))}
      >
        <div className="flex flex-wrap gap-2">
          {data.unpriced402.map((r) => (
            <span key={r.tool_key} className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs">
              <span className="font-mono">{r.tool_key}</span> · {r.count}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t(t("auto.fix_set_tool_price_in_plans"), "Fix: set a price in Plans × Tools matrix or per-user override.", "ڕاستکردنەوە")}
        </p>
      </Section>

      {/* Firecrawl spike */}
      {data.firecrawlSpike && (
        <Section
          title={t(t("auto.unusual_rise_in_firecrawl"), "Firecrawl usage spike", "بەرزبوونەوە")}
          icon={<AlertTriangle className="size-4 text-warning" />}
          empty={false}
        >
          <p className="text-sm">
            {t(t("auto.today"), "Today", "ئەمڕۆ")} <b>{data.firecrawlSpike.day}</b>: <b>{data.firecrawlSpike.units}</b> units
            ({data.firecrawlSpike.ratio}× {t(t("auto.7_day_average"), "of 7-day avg", "ناوەند")} {data.firecrawlSpike.avg7d}).
          </p>
        </Section>
      )}

      {/* Profiles no metering */}
      {data.profilesNoMetering > 0 && (
        <Section title={t(t("auto.users_without_metering"), "Users without metering", "بەکارهێنەر")} icon={<Gauge className="size-4 text-muted-foreground" />} empty={false}>
          <p className="text-sm">{data.profilesNoMetering} {t(t("auto.profile_with_no_token_limit_actual"), "profiles with no token balance/limit — real cost not billed.", "پرۆفایل")}</p>
        </Section>
      )}

      {/* Recent errors */}
      {data.recentErrors.length > 0 && (
        <Section title={t(t("auto.most_frequent_errors"), "Top recent errors", "هەڵە")} icon={<Bug className="size-4 text-destructive" />} empty={false}>
          <ul className="space-y-1 text-xs">
            {data.recentErrors.map((r) => (
              <li key={r.action} className="flex items-center justify-between font-mono">
                <span>{r.action}</span><span className="text-muted-foreground">×{r.count}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Cost report */}
      <Section title={t(t("auto.report_on_the_cost_of_building"), "Cost report: building a Manus/Kimi-like agent", "تێچوون")} icon={<FileText className="size-4 text-primary" />} empty={false}>
        <CostReport lang={lang as any} />
      </Section>

      {/* Maaroof orchestrator */}
      <Section title={t(t("auto.maaroof_smart_agent"), "Maaroof Agent", "مەعروف")} icon={<Bot className="size-4 text-primary" />}
        empty={data.maaroof.runs_7d === 0} emptyText={t(t("auto.no_sessions_this_week"), "No runs this week.", "—")}>
        <div className="grid gap-3 md:grid-cols-4 mb-3">
          <Stat icon={<Activity />} label={t(t("auto.7y_sessions"), "Runs / 7d", "—")} value={String(data.maaroof.runs_7d)} />
          <Stat icon={<CheckCircle2 />} label={t(t("auto.success_4"), "Done", "—")} value={String(data.maaroof.done_7d)} />
          <Stat icon={<AlertTriangle />} label={t(t("auto.errors"), "Errors", "—")} value={String(data.maaroof.error_7d)}
            tone={data.maaroof.error_7d > 0 ? "warn" : "ok"} />
          <Stat icon={<Gauge />} label={t(t("auto.average_session_2"), "Avg $/run", "—")} value={fmt$(data.maaroof.avg_usd_per_run)}
            tone={data.maaroof.avg_cost_alert ? "warn" : "ok"} />
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          {t(t("auto.total_cost_7d"), "Total cost 7d:", "—")} <b>{fmt$(data.maaroof.total_usd_7d)}</b>
          {data.maaroof.avg_cost_alert && <span className="ms-2 text-warning">⚠ {t(t("auto.medium_high_0_50"), "High avg (>$0.50)", "—")}</span>}
        </div>
        {data.maaroof.top_goals.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold mb-1">{t(t("auto.highest_cost_targets"), "Top goals by cost", "—")}</div>
            <ul className="space-y-1 text-xs">
              {data.maaroof.top_goals.slice(0, 5).map((g, i) => (
                <li key={i} className="flex items-center gap-2"><span className="flex-1 truncate">{g.goal}</span><span className="text-muted-foreground">{g.runs}×</span><span className="font-mono">{fmt$(g.usd)}</span></li>
              ))}
            </ul>
          </div>
        )}
        {data.maaroof.recent.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr><th className="text-start p-1">{t("auto.time")}</th><th className="text-start p-1">{t("auto.target")}</th><th className="p-1">{t("auto.status")}</th><th className="p-1">{t("auto.steps_2")}</th><th className="p-1">USD</th></tr></thead>
              <tbody>
                {data.maaroof.recent.slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="p-1 whitespace-nowrap text-muted-foreground">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="p-1 max-w-xs truncate">{r.goal}</td>
                    <td className={`p-1 text-center ${r.status === "error" ? "text-destructive" : r.status === "done" ? "text-success" : "text-muted-foreground"}`}>{r.status}</td>
                    <td className="p-1 text-center">{r.steps}</td>
                    <td className="p-1 text-center font-mono">{fmt$(r.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon, empty, emptyText, children }: { title: string; icon: React.ReactNode; empty: boolean; emptyText?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon} {title}</div>
      {empty ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-success" /> {emptyText}</div>
      ) : children}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-gradient";
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className={`font-display text-2xl font-bold ${c}`}>{value}</div>
    </div>
  );
}

function CostReport({ lang }: { lang: "ar" | "en" | "ku" }) {
  const { t } = useI18n();
  if (lang === "ar") return (
    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
      <h4>{t("auto.a_build_a_manus_lite_agent")}</h4>
      <table>
        <thead><tr><th>{t("auto.item")}</th><th>{t("auto.detail")}</th><th>{t("auto.estimate")}</th></tr></thead>
        <tbody>
          <tr><td>{t("auto.develop")}</td><td>{t("auto.connect_16_tools_ui_memory")}</td><td>{t("auto.150_300_lovable_credits")}</td></tr>
          <tr><td>{t("auto.model_work")}</td><td>{t("auto.gemini_2_5_flash_via_ai")}</td><td>{t("auto.0_04_0_10_per_task")}</td></tr>
          <tr><td>Firecrawl</td><td>{t("auto.50_crawl_task")}</td><td>{t("auto.0_05_task")}</td></tr>
          <tr><td>Supabase</td><td>{t("auto.up_to_10k_requests_month")}</td><td>{t("auto.within_free")}</td></tr>
          <tr><td><b>{t("auto.total_active_user")}</b></td><td>{t("auto.30_tasks_month")}</td><td><b>{t("auto.3_5_month")}</b> → بيع $9.99–$19.99</td></tr>
        </tbody>
      </table>
      <h4>{t("auto.b_building_an_autonomous_product_at")}</h4>
      <ul>
        <li>فريق MVP (3–6 شهور): 2 ML + 2 full-stack + designer + PM → <b>$300K–$700K</b></li>
        <li>GPU + observability + DB: <b>{t("auto.30k_100k_month")}</b></li>
        <li>استئجار النماذج (Anthropic/OpenAI/Google) عند 100K مستخدم: <b>{t("auto.50k_month")}</b></li>
        <li>تدريب open-source بديل: <b>$1M+ one-time</b></li>
        <li>بحث + alignment + RLHF: <b>$200K–$500K</b></li>
        <li><b>{t("auto.manus_level_mvp_1m_3m_year")}</b></li>
      </ul>
      <h4>{t("auto.c_kimi_level_long_context_llm")}</h4>
      <p>يتطلب pretraining كامل لنموذج اللغة → <b>$10M – $50M+</b> في السنة الأولى. الفرق ليس في الكود، بل في امتلاك النموذج وبنية GPU.</p>
      <h4>{t("auto.d_your_practical_summary_now")}</h4>
      <p>بناء «Manus-lite» داخل Lovable ممكن خلال يومين بأقل من <b>$100</b> تطوير + <b>{t("auto.3_5_user_month")}</b> تشغيل، مع هامش ربح صحي لو بعت $14.99–$19.99/شهر.</p>
    </div>
  );
  if (lang === "ku") return (
    <div className="prose prose-invert max-w-none text-sm">
      <p>«Manus-lite» لە ناو Lovable: ~$3–5/بەکارهێنەر/مانگ، نرخی فرۆش $9.99–$19.99. بەرهەمێکی سەربەخۆی Manus-ئاست: $1M–$3M/ساڵ. Kimi-ئاست: $10M+.</p>
    </div>
  );
  return (
    <div className="prose prose-invert max-w-none text-sm">
      <h4>A) Building a "Manus-lite" agent inside this project</h4>
      <table>
        <thead><tr><th>Item</th><th>Detail</th><th>Estimate</th></tr></thead>
        <tbody>
          <tr><td>Development</td><td>Wire 16 tools + UI + memory</td><td>~150–300 Lovable credits</td></tr>
          <tr><td>Model runtime</td><td>Gemini 2.5 Flash: $0.075/M in + $0.30/M out</td><td>~$0.04–0.10 / task</td></tr>
          <tr><td>Firecrawl</td><td>~50 crawls / task</td><td>~$0.05 / task</td></tr>
          <tr><td>Supabase / Cloud</td><td>Up to 10K req/month</td><td>Free tier</td></tr>
          <tr><td><b>Per active user (30 tasks/mo)</b></td><td></td><td><b>~$3–5/mo</b> → sell at $9.99–$19.99</td></tr>
        </tbody>
      </table>
      <h4>B) Standalone Manus-grade product</h4>
      <ul>
        <li>MVP team (3–6 mo): 2 ML + 2 full-stack + designer + PM → <b>$300K–$700K</b></li>
        <li>Infra (GPU + observability + DB): <b>$30K–$100K/mo</b></li>
        <li>Model rental @ 100K users: <b>$50K+/mo</b></li>
        <li>Custom OSS training: <b>$1M+ one-time</b></li>
        <li>Alignment + RLHF: <b>$200K–$500K</b></li>
        <li><b>Year-1 total: $1M – $3M</b></li>
      </ul>
      <h4>C) Kimi-grade (long-context LLM + agent)</h4>
      <p>Requires full pretraining: <b>$10M – $50M+</b> year one. The gap is GPU + owning the model, not application code.</p>
      <h4>D) Bottom line for you</h4>
      <p>You can ship a "Manus-lite" inside Lovable in ~2 days for under <b>$100</b> dev + <b>$3–5/user/month</b> runtime, with healthy margin at $14.99–$19.99/month pricing.</p>
    </div>
  );
}
