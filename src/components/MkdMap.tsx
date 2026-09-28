import { useMemo } from "react";

// Lightweight SVG radar: the user's brand at the center, competitors on
// category orbits. Observed rivals are solid; AI-only observations dashed.
const RING_ORDER = ["direct", "indirect", "substitute", "hidden", "emerging", "seasonal", "perceived"] as const;

type Relation = {
  entity_name: string;
  category: string;
  confidence: number;
  is_ai_observation?: boolean;
};

export function MkdMap({
  brand,
  relations,
  cats,
  observedLabel,
  aiLabel,
}: {
  brand: string;
  relations: Relation[];
  cats: Record<string, string>;
  observedLabel: string;
  aiLabel: string;
}) {
  const size = 560;
  const c = size / 2;
  const ringGap = 32;
  const inner = 78;

  const nodes = useMemo(() => {
    const byCat: Record<string, Relation[]> = {};
    for (const r of relations || []) (byCat[r.category] ||= []).push(r);
    const out: { r: Relation; x: number; y: number; ring: number }[] = [];
    RING_ORDER.forEach((cat, ring) => {
      const rows = byCat[cat] || [];
      const radius = inner + ring * ringGap;
      rows.forEach((r, i) => {
        const angle = (2 * Math.PI * i) / rows.length - Math.PI / 2 + ring * 0.45;
        out.push({ r, ring, x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) });
      });
    });
    return out;
  }, [relations, c]);

  if (!relations?.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/40 p-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-xl" role="img" aria-label="competitive map">
        {RING_ORDER.map((cat, ring) => {
          const radius = inner + ring * ringGap;
          const has = nodes.some((n) => n.ring === ring);
          return (
            <g key={cat}>
              <circle cx={c} cy={c} r={radius} fill="none" className="stroke-border" strokeDasharray={cat === "perceived" ? "4 5" : undefined} strokeWidth={1} opacity={has ? 0.9 : 0.35} />
              {has && (
                <text x={c} y={c - radius - 5} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
                  {cats[cat] || cat}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map(({ r, x, y }) => {
          const rad = 7 + (Math.max(0, Math.min(100, r.confidence)) / 100) * 8;
          return (
            <g key={r.entity_name}>
              <line x1={c} y1={c} x2={x} y2={y} className="stroke-border" strokeWidth={0.6} opacity={0.5} />
              <circle
                cx={x} cy={y} r={rad}
                className={r.is_ai_observation ? "fill-accent/15 stroke-accent" : "fill-primary/20 stroke-primary"}
                strokeWidth={1.6}
                strokeDasharray={r.is_ai_observation ? "3 3" : undefined}
              />
              <text x={x} y={y + rad + 12} textAnchor="middle" className="fill-foreground" fontSize={10.5} fontWeight={600}>
                {r.entity_name.length > 18 ? r.entity_name.slice(0, 17) + "…" : r.entity_name}
              </text>
              <text x={x} y={y + rad + 23} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
                {r.confidence}%
              </text>
            </g>
          );
        })}
        <circle cx={c} cy={c} r={30} className="fill-primary stroke-primary" />
        <text x={c} y={c + 3} textAnchor="middle" className="fill-primary-foreground" fontSize={11} fontWeight={700}>
          {brand.length > 12 ? brand.slice(0, 11) + "…" : brand}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-primary/60" /> {observedLabel}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border border-dashed border-accent bg-accent/20" /> {aiLabel}</span>
      </div>
    </div>
  );
}
