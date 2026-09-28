import { useMemo, useState } from "react";

// Sector radar: each category owns an angular wedge; distance from the centre
// reflects confidence (closer = stronger). Labels sit beside the dot, alternating
// sides and radii to avoid overlap. The viewBox is padded so nothing is clipped.
const ORDER = ["direct", "indirect", "substitute", "hidden", "emerging", "seasonal", "perceived"] as const;

type Relation = { entity_name: string; category: string; confidence: number; is_ai_observation?: boolean; reason?: string };

export function MkdMap({ brand, relations, cats, observedLabel, aiLabel }: {
  brand: string; relations: Relation[]; cats: Record<string, string>; observedLabel: string; aiLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const R = 260, PAD = 150, S = R * 2 + PAD * 2, C = S / 2;

  const { wedges, nodes } = useMemo(() => {
    const present = ORDER.filter((c) => relations.some((r) => r.category === c));
    const total = relations.length || 1;
    let a0 = -Math.PI / 2;
    const wedges: { cat: string; a0: number; a1: number }[] = [];
    const nodes: { r: Relation; x: number; y: number; right: boolean }[] = [];
    for (const cat of present) {
      const rows = relations.filter((r) => r.category === cat).sort((a, b) => b.confidence - a.confidence);
      const span = Math.max(0.5, (rows.length / total) * 2 * Math.PI);
      wedges.push({ cat, a0, a1: a0 + span });
      rows.forEach((r, i) => {
        const a = a0 + span * ((i + 0.5) / rows.length);
        const base = 70 + (1 - Math.max(0, Math.min(100, r.confidence)) / 100) * (R - 90);
        const dist = base + (i % 2) * 22;
        const x = C + dist * Math.cos(a), y = C + dist * Math.sin(a);
        nodes.push({ r, x, y, right: Math.cos(a) >= 0 });
      });
      a0 += span;
    }
    const sum = wedges.reduce((s, w) => s + (w.a1 - w.a0), 0);
    const k = (2 * Math.PI) / sum;
    // normalize wedges if min-span inflated the total
    if (Math.abs(k - 1) > 0.01) {
      let s0 = -Math.PI / 2;
      for (const w of wedges) { const sp = (w.a1 - w.a0) * k; w.a0 = s0; w.a1 = s0 + sp; s0 += sp; }
    }
    return { wedges, nodes };
  }, [relations, C]);

  if (!relations?.length) return null;
  const arc = (a0: number, a1: number) => {
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0), x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    return `M${C},${C} L${x0},${y0} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`;
  };
  const active = nodes.find((n) => n.r.entity_name === hover);

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      {/* Mobile: compact list */}
      <div className="space-y-2 sm:hidden">
        {wedges.map((w) => (
          <div key={w.cat}>
            <div className="mb-1 text-xs font-semibold text-primary">{cats[w.cat] || w.cat}</div>
            {relations.filter((r) => r.category === w.cat).map((r) => (
              <div key={r.entity_name} className="mb-1 flex items-center gap-2 text-xs">
                <span className={`size-2.5 shrink-0 rounded-full ${r.is_ai_observation ? "border border-dashed border-accent bg-accent/20" : "bg-primary"}`} />
                <span className="flex-1 truncate">{r.entity_name}</span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${r.confidence}%` }} /></div>
                <span className="w-8 text-end text-muted-foreground">{r.confidence}%</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <svg dir="ltr" style={{ direction: "ltr" }} viewBox={`0 0 ${S} ${S}`} className="mx-auto hidden w-full max-w-3xl sm:block" role="img" aria-label="competitive map">
        {[0.33, 0.66, 1].map((f) => <circle key={f} cx={C} cy={C} r={R * f} fill="none" className="stroke-border" strokeWidth={1} opacity={0.6} />)}
        {wedges.map((w, i) => {
          const mid = (w.a0 + w.a1) / 2;
          const lx = C + (R + 24) * Math.cos(mid), ly = C + (R + 24) * Math.sin(mid);
          return (
            <g key={w.cat}>
              <path d={arc(w.a0, w.a1)} className={i % 2 ? "fill-primary/5" : "fill-accent/5"} />
              <line x1={C} y1={C} x2={C + R * Math.cos(w.a0)} y2={C + R * Math.sin(w.a0)} className="stroke-border" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor={Math.cos(mid) > 0.2 ? "start" : Math.cos(mid) < -0.2 ? "end" : "middle"} dominantBaseline="middle" className="fill-primary" fontSize={13} fontWeight={700}>
                {cats[w.cat] || w.cat}
              </text>
            </g>
          );
        })}
        {nodes.map(({ r, x, y, right }) => {
          const rad = 6 + (r.confidence / 100) * 6;
          const dim = hover && hover !== r.entity_name;
          const name = r.entity_name.length > 22 ? r.entity_name.slice(0, 21) + "…" : r.entity_name;
          return (
            <g key={r.entity_name} opacity={dim ? 0.3 : 1} onMouseEnter={() => setHover(r.entity_name)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <circle cx={x} cy={y} r={rad} className={r.is_ai_observation ? "fill-accent/20 stroke-accent" : "fill-primary/30 stroke-primary"} strokeWidth={1.8} strokeDasharray={r.is_ai_observation ? "3 3" : undefined} />
              <text x={right ? x + rad + 5 : x - rad - 5} y={y + 4} textAnchor={right ? "start" : "end"} className="fill-foreground" fontSize={12} fontWeight={600}>
                <tspan style={{ unicodeBidi: "plaintext" } as any}>{name}</tspan><tspan className="fill-muted-foreground" fontWeight={400}>{`  ${r.confidence}%`}</tspan>
              </text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={38} className="fill-primary" />
        <text x={C} y={C + 4} textAnchor="middle" className="fill-primary-foreground" fontSize={12} fontWeight={700}>
          {brand.length > 12 ? brand.slice(0, 11) + "…" : brand}
        </text>
      </svg>
      {active?.r.reason && <p className="mx-auto mt-2 hidden max-w-2xl rounded-lg bg-muted/50 p-2 text-xs sm:block"><b>{active.r.entity_name}:</b> {active.r.reason}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-primary/60" /> {observedLabel}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border border-dashed border-accent bg-accent/20" /> {aiLabel}</span>
      </div>
    </div>
  );
}
