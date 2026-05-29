import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePulseI18n } from "@/lib/pulse-i18n";
import { PulseSubNav } from "@/components/PulseSubNav";

export const Route = createFileRoute("/pulse/compare")({
  component: ComparePage,
});

type Gov = { id: string; slug: string; name_ar: string };
type Metric = { metric_key: string; sector: string; value: number | null; unit: string | null; governorate_id: string | null };

function ComparePage() {
  const { t, dir } = usePulseI18n();
  const [govs, setGovs] = useState<Gov[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    supabase.from("governorates").select("id, slug, name_ar").order("name_ar").then(({ data }) => {
      if (data) setGovs(data as Gov[]);
    });
  }, []);

  useEffect(() => {
    if (selected.length === 0) { setMetrics([]); return; }
    supabase
      .from("pulse_metrics")
      .select("metric_key, sector, value, unit, governorate_id, captured_at")
      .in("governorate_id", selected)
      .order("captured_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setMetrics((data ?? []) as Metric[]));
  }, [selected]);

  const toggle = (id: string) =>
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 5));

  const matrix = useMemo(() => {
    // metric_key -> { gov_id -> latest value }
    const seen = new Map<string, Map<string, Metric>>();
    for (const m of metrics) {
      if (!m.governorate_id) continue;
      const inner = seen.get(m.metric_key) ?? new Map();
      if (!inner.has(m.governorate_id)) inner.set(m.governorate_id, m);
      seen.set(m.metric_key, inner);
    }
    return Array.from(seen.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [metrics]);

  const selectedGovs = govs.filter((g) => selected.includes(g.id));

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link to="/pulse" className="text-xs text-muted-foreground hover:text-foreground">← {t("pulse_brand")}</Link>
          <h1 className="text-3xl font-extrabold mt-1">{t("pulse_compare")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <PulseSubNav />
        <section>
          <p className="text-sm text-muted-foreground mb-3">اختر حتى 5 محافظات للمقارنة</p>
          <div className="flex flex-wrap gap-2">
            {govs.map((g) => (
              <button
                key={g.id}
                onClick={() => toggle(g.id)}
                className={`rounded-full px-3 py-1.5 text-xs border ${selected.includes(g.id) ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card/50"}`}
              >
                {g.name_ar}
              </button>
            ))}
          </div>
        </section>

        {selectedGovs.length > 0 && matrix.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("pulse_no_data")}</p>
        )}

        {matrix.length > 0 && (
          <section className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start p-2 text-muted-foreground font-semibold">المؤشر</th>
                  {selectedGovs.map((g) => (
                    <th key={g.id} className="text-start p-2 text-primary font-semibold">{g.name_ar}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(([key, byGov]) => (
                  <tr key={key} className="border-b border-border/40">
                    <td className="p-2 font-mono text-xs">{key}</td>
                    {selectedGovs.map((g) => {
                      const m = byGov.get(g.id);
                      return (
                        <td key={g.id} className="p-2 tabular-nums">
                          {m?.value != null ? m.value.toLocaleString() : "—"}
                          {m?.unit && <span className="text-xs text-muted-foreground ms-1">{m.unit}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground leading-relaxed">
          {t("pulse_disclaimer")}
        </footer>
      </main>
    </div>
  );
}
