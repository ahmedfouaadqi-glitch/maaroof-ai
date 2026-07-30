// Part 5 — Maaroof Intelligence Center (unified admin shell).
// Groups existing admin panels + Cognitive Intelligence Engine sections
// into one coherent surface. Reuses existing components (Evolution over Replacement).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, Brain, Coins, ShieldCheck, Sparkles, Network, Bot,
  BarChart3, ScrollText, Layers, Fingerprint, Radar, Gauge,
} from "lucide-react";
import { MaaroofAdminTab } from "./MaaroofAdminTab";
import { SystemHealthTab } from "./SystemHealthTab";
import { AdminFinanceTab } from "./AdminFinanceTab";
import { CognitiveInsightsTab } from "./CognitiveInsightsTab";
import { UserIntelligenceTab } from "./UserIntelligenceTab";

type SectionKey =
  | "overview" | "maaroof" | "cognitive" | "dna" | "evolution"
  | "expert_scores" | "model_scores" | "mcp_scores" | "policy_scores"
  | "finance" | "health" | "user_intel" | "eqi" | "personality" | "laws";

const SECTIONS: Array<{ k: SectionKey; label: string; Icon: any; group: string }> = [
  { k: "overview",       label: "نظرة عامة",             Icon: Activity,    group: "core" },
  { k: "maaroof",        label: "معروف — الوكيل",        Icon: Bot,         group: "core" },
  { k: "cognitive",      label: "الرؤى الإدراكية",       Icon: Brain,       group: "cognitive" },
  { k: "dna",            label: "الحمض المعرفي (DNA)",   Icon: Fingerprint, group: "cognitive" },
  { k: "evolution",      label: "تقارير التطور",         Icon: Sparkles,    group: "cognitive" },
  { k: "expert_scores",  label: "أداء الخبراء",           Icon: BarChart3,   group: "scores" },
  { k: "model_scores",   label: "أداء النماذج",           Icon: Layers,      group: "scores" },
  { k: "mcp_scores",     label: "MCP المتصلة",           Icon: Network,     group: "scores" },
  { k: "policy_scores",  label: "السياسات",              Icon: ShieldCheck, group: "scores" },
  { k: "eqi",            label: "مؤشر الجودة التنفيذية", Icon: Gauge,       group: "scores" },
  { k: "personality",    label: "شخصيات الوكلاء",        Icon: Fingerprint, group: "scores" },
  { k: "laws",           label: "الامتثال الدستوري",     Icon: ShieldCheck, group: "scores" },

  { k: "finance",        label: "المالية الموحّدة",       Icon: Coins,       group: "ops" },
  { k: "health",         label: "صحة النظام",            Icon: Radar,       group: "ops" },
  { k: "user_intel",     label: "ذكاء المستخدمين",       Icon: ScrollText,  group: "ops" },
];

export function MaaroofIntelligenceCenter() {
  const [section, setSection] = useState<SectionKey>("overview");
  const groups = useMemo(() => {
    const g: Record<string, typeof SECTIONS> = {};
    for (const s of SECTIONS) (g[s.group] ||= []).push(s);
    return g;
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      <aside className="rounded-2xl border border-border/60 bg-card/60 p-2 h-max">
        {Object.entries(groups).map(([g, items]) => (
          <div key={g} className="mb-2">
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{g}</div>
            <div className="flex flex-col gap-0.5">
              {items.map(({ k, label, Icon }) => (
                <button
                  key={k}
                  onClick={() => setSection(k)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-start transition ${
                    section === k
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <main className="rounded-2xl border border-border/60 bg-card/40 p-3 md:p-4">
        {section === "overview"       && <OverviewSection />}
        {section === "maaroof"        && <MaaroofAdminTab />}
        {section === "cognitive"      && <CognitiveInsightsTab />}
        {section === "dna"            && <DnaSection />}
        {section === "evolution"      && <EvolutionSection />}
        {section === "expert_scores"  && <ScoresTable view="expert_scores_v"  cols={["expert","runs","avg_usd","avg_tokens","last_used_at"]} />}
        {section === "model_scores"   && <ScoresTable view="model_scores_v"   cols={["model","calls","avg_usd","avg_tokens","last_used_at"]} />}
        {section === "mcp_scores"     && <ScoresTable view="mcp_scores_v"     cols={["name","enabled","reliability","avg_cost_usd","avg_latency_ms","updated_at"]} />}
        {section === "policy_scores"  && <ScoresTable view="policy_scores_v"  cols={["policy","workspaces","last_updated_at"]} />}
        {section === "eqi"            && <EqiSection />}
        {section === "personality"    && <PersonalitySection />}
        {section === "laws"           && <LawsComplianceSection />}

        {section === "finance"        && <AdminFinanceTab />}
        {section === "health"         && <SystemHealthTab />}
        {section === "user_intel"     && <UserIntelligenceTab />}
      </main>
    </div>
  );
}

function OverviewSection() {
  const [stats, setStats] = useState<{ runs: number; dna: number; reports: number }>({ runs: 0, dna: 0, reports: 0 });
  useEffect(() => {
    (async () => {
      const [{ count: runs }, { count: dna }, { count: reports }] = await Promise.all([
        supabase.from("maaroof_runs").select("id", { count: "exact", head: true }),
        supabase.from("platform_dna" as any).select("id", { count: "exact", head: true }),
        supabase.from("maaroof_evolution_reports" as any).select("id", { count: "exact", head: true }),
      ]);
      setStats({ runs: runs || 0, dna: dna || 0, reports: reports || 0 });
    })();
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">مركز ذكاء معروف</h2>
        <p className="text-xs text-muted-foreground mt-1">
          كل ما يخص الوكيل الذكي في مكان واحد: الجلسات، الذاكرة، الحمض المعرفي، تقارير التطور، أداء الخبراء والنماذج و MCP، والصحة المالية والتشغيلية.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="جلسات" value={stats.runs} />
        <Stat label="أنماط DNA" value={stats.dna} />
        <Stat label="تقارير تطور" value={stats.reports} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-gradient">{value.toLocaleString()}</div>
    </div>
  );
}

function DnaSection() {
  const [rows, setRows] = useState<Array<{ kind: string; count: number; last_at: string }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("platform_dna" as any).select("kind, created_at").order("created_at", { ascending: false }).limit(1000);
      const map = new Map<string, { count: number; last_at: string }>();
      for (const r of ((data as any[]) || []) as Array<{ kind: string; created_at: string }>) {
        const cur = map.get(r.kind) || { count: 0, last_at: r.created_at };
        cur.count += 1;
        if (r.created_at > cur.last_at) cur.last_at = r.created_at;
        map.set(r.kind, cur);
      }
      setRows([...map.entries()].map(([kind, v]) => ({ kind, ...v })));
    })();
  }, []);
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">الحمض المعرفي للمنصة (Platform DNA)</h3>
        <p className="text-xs text-muted-foreground mt-1">
          أنماط مجهولة الهوية تُستخرج من الجلسات الناجحة — بدون أي بيانات شخصية — لتحسين قرارات معروف مستقبلاً.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-xl">
          لا توجد أنماط بعد — سيتم استخراجها تلقائياً من الجلسات الناجحة.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead><tr className="border-b text-muted-foreground">
            <th className="p-2 text-start">النوع</th>
            <th className="p-2">العدد</th>
            <th className="p-2">آخر التقاط</th>
          </tr></thead>
          <tbody>
            {rows.sort((a,b)=>b.count-a.count).map((r) => (
              <tr key={r.kind} className="border-b hover:bg-muted/30">
                <td className="p-2 font-mono">{r.kind}</td>
                <td className="p-2 text-center">{r.count}</td>
                <td className="p-2 text-center text-muted-foreground">{new Date(r.last_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EvolutionSection() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("maaroof_evolution_reports" as any).select("*").order("created_at", { ascending: false }).limit(30);
    setRows((data as any[]) || []);
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">تقارير تطور معروف</h3>
        <span className="text-[11px] text-muted-foreground">تُولَّد تلقائياً — عرض القراءة فقط.</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-xl">لا توجد تقارير بعد.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <details key={r.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <summary className="cursor-pointer text-xs flex items-center gap-2">
                <span className="font-mono text-primary">{r.period}</span>
                <span className="text-muted-foreground">{new Date(r.period_start).toLocaleDateString()} → {new Date(r.period_end).toLocaleDateString()}</span>
              </summary>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap font-mono opacity-80">{JSON.stringify(r.payload, null, 2)}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoresTable({ view, cols }: { view: string; cols: string[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from(view as any).select("*").limit(500);
      setRows((data as any[]) || []);
      setLoading(false);
    })();
  }, [view]);
  if (loading) return <div className="p-6 text-center text-xs text-muted-foreground">تحميل…</div>;
  if (!rows.length) return <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl">لا توجد بيانات بعد.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b text-muted-foreground">{cols.map((c) => <th key={c} className="p-2 text-start">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b hover:bg-muted/30">
              {cols.map((c) => (
                <td key={c} className="p-2 font-mono text-[11px]">
                  {r[c] == null ? "—" : typeof r[c] === "boolean" ? (r[c] ? "✓" : "✗") : typeof r[c] === "object" ? JSON.stringify(r[c]).slice(0, 60) : String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Part 7 — Executive Quality Index ---------- */
const EQI_DIMS: Array<[string, string]> = [
  ["decision", "القرار"], ["planning", "التخطيط"], ["expert", "الخبرة"], ["capability", "القدرات"],
  ["memory", "الذاكرة"], ["simulation", "المحاكاة"], ["execution", "التنفيذ"], ["reflection", "التأمل"],
  ["learning", "التعلّم"], ["cost_efficiency", "كفاءة التكلفة"], ["user_satisfaction", "رضا المستخدم"],
];

function EqiSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("executive_quality_index_v" as any).select("*").order("day", { ascending: false }).limit(30);
      setRows((data as any[]) || []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-6 text-center text-xs text-muted-foreground">تحميل…</div>;
  if (!rows.length) return <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl">لا توجد قياسات بعد — فعّل «مؤشر الجودة» ثم شغّل جلسات.</div>;
  const latest = rows[0];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">مؤشر الجودة التنفيذية (EQI)</h3>
        <p className="text-xs text-muted-foreground mt-1">11 بُعداً تُحتسب من كل جلسة — يوضّح أين يقوى معروف وأين يحتاج تحسيناً.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {EQI_DIMS.map(([k, label]) => {
          const v = latest[k] == null ? null : Number(latest[k]);
          return (
            <div key={k} className="rounded-xl border border-border/60 bg-background/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="text-lg font-bold">{v == null ? "—" : v.toFixed(1)}</div>
              <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b text-muted-foreground">
            <th className="p-2 text-start">اليوم</th><th className="p-2">جلسات</th>
            {EQI_DIMS.map(([k, l]) => <th key={k} className="p-2">{l}</th>)}
            <th className="p-2">م. التكلفة $</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b hover:bg-muted/30">
                <td className="p-2 whitespace-nowrap">{new Date(r.day).toLocaleDateString("ar-IQ")}</td>
                <td className="p-2 text-center">{r.runs}</td>
                {EQI_DIMS.map(([k]) => <td key={k} className="p-2 text-center font-mono">{r[k] == null ? "—" : Number(r[k]).toFixed(0)}</td>)}
                <td className="p-2 text-center font-mono">{r.avg_usd == null ? "—" : Number(r.avg_usd).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Part 7 — Agent personality traits ---------- */
function PersonalitySection() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("maaroof_agents")
        .select("id, role, mission, personality, personality_version, success_rate, runs_count, lifecycle_state, updated_at")
        .not("personality", "is", null)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(60);
      setRows((data as any[]) || []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-6 text-center text-xs text-muted-foreground">تحميل…</div>;
  if (!rows.length) return <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl">لا توجد شخصيات بعد — فعّل «شخصية الوكيل التنفيذية» في تحكم معروف.</div>;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">شخصيات الوكلاء التنفيذية</h3>
        <p className="text-xs text-muted-foreground mt-1">تتطور السمات تلقائياً بعد كل جلسة حسب النجاح والثقة والتكلفة.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {rows.map((r) => {
          const traits = (r.personality || {}) as Record<string, any>;
          return (
            <div key={r.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs mb-2">
                <span className="font-semibold">{r.role || "وكيل"}</span>
                <span className="font-mono text-[10px] text-muted-foreground">v{r.personality_version ?? 1}</span>
                <span className="ms-auto text-[10px] text-muted-foreground">{r.runs_count ?? 0} جلسة · {r.success_rate == null ? "—" : `${(Number(r.success_rate) * 100).toFixed(0)}%`}</span>
              </div>
              <div className="space-y-1">
                {Object.entries(traits).filter(([, v]) => typeof v === "number").map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-28 text-[11px] text-muted-foreground font-mono truncate">{k}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, Number(v)))}%` }} />
                    </div>
                    <span className="w-8 text-[10px] text-end font-mono">{Number(v).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Part 8 — Constitutional compliance (30 laws) ---------- */
function LawsComplianceSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("law_compliance_v" as any)
        .select("*")
        .order("day", { ascending: false })
        .limit(200);
      setRows((data as any[]) || []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-6 text-center text-xs text-muted-foreground">تحميل…</div>;
  if (!rows.length)
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
        لا توجد بيانات امتثال بعد — فعّل «دستور الذكاء الإدراكي» من إعدادات معروف ثم شغّل جلسات.
      </div>
    );
  const byLaw = new Map<string, { law: string; severity: string; total: number }>();
  for (const r of rows) {
    const key = `${r.law_id}`;
    const prev = byLaw.get(key) || { law: `${r.law_id}. ${r.law_ar}`, severity: r.severity, total: 0 };
    prev.total += Number(r.violations || 0);
    byLaw.set(key, prev);
  }
  const top = [...byLaw.values()].sort((a, b) => b.total - a.total).slice(0, 12);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">الامتثال الدستوري</h3>
        <p className="text-xs text-muted-foreground mt-1">أكثر القوانين خرقاً عبر الجلسات — مؤشر مباشر على أي طبقة تحتاج تفعيلاً أو ضبطاً.</p>
      </div>
      <div className="space-y-1.5">
        {top.map((l, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-background/40 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {l.law}
                {l.severity === "hard" && <span className="ms-2 text-[10px] rounded px-1 border border-destructive/50 text-destructive">إلزامي</span>}
              </span>
              <span className="font-mono">{l.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
              <div className="h-full bg-destructive/70" style={{ width: `${Math.min(100, (l.total / (top[0]?.total || 1)) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
