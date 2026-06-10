import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, BarChart3 } from "lucide-react";
import { getUserIntelligence } from "@/lib/cognition.functions";

export function CognitiveInsightsTab() {
  const call = useServerFn(getUserIntelligence);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { const r = await call(); setRows((r as any).rows || []); } finally { setLoading(false); }
  })(); }, []);

  const stats = useMemo(() => {
    const goals: Record<string, number> = {};
    const urgency: Record<string, number> = {};
    const gaps: Record<string, number> = {};
    const ops: Record<string, number> = {};
    for (const r of rows) {
      const i = r.detected_intent || {};
      if (i.primary_goal) goals[i.primary_goal] = (goals[i.primary_goal] || 0) + 1;
      if (i.urgency) urgency[i.urgency] = (urgency[i.urgency] || 0) + 1;
      if (i.gap) gaps[i.gap] = (gaps[i.gap] || 0) + 1;
      if (i.opportunity) ops[i.opportunity] = (ops[i.opportunity] || 0) + 1;
    }
    const top = (m: Record<string, number>, n = 10) =>
      Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
    return { goals: top(goals), urgency: top(urgency, 5), gaps: top(gaps), ops: top(ops), total: rows.length };
  }, [rows]);

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="mb-2 flex items-center gap-2"><BarChart3 className="size-4 text-primary" /><h3 className="font-semibold">Overview</h3></div>
        <p className="text-xs text-muted-foreground">Aggregated from {stats.total} user intent profiles.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Primary goals" rows={stats.goals} max={stats.total} />
        <Block title="Urgency" rows={stats.urgency} max={stats.total} />
        <Block title="Top gaps" rows={stats.gaps} max={stats.total} />
        <Block title="Top opportunities" rows={stats.ops} max={stats.total} />
      </div>
    </div>
  );
}

function Block({ title, rows, max }: { title: string; rows: [string, number][]; max: number }) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="text-xs">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="truncate" title={k}>{k}</span>
                <span className="font-mono text-muted-foreground">{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${Math.max(4, Math.round((v / Math.max(1, max)) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
