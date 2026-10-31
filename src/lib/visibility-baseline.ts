/** Pure, opt-in comparison of a later live probe against a chosen baseline run. */
export type EngineSnap = { engine: string; mentioned: boolean };
export type RunSnap = { engines: EngineSnap[]; evidence_urls: string[]; mention_pct: number | null };
export type EngineChange = { engine: string; before: boolean | null; after: boolean | null; change: "gained" | "lost" | "same" | "not_comparable" };

export function compareToBaseline(baseline: RunSnap, latest: RunSnap) {
  const b = new Map(baseline.engines.map((e) => [e.engine, e.mentioned]));
  const l = new Map(latest.engines.map((e) => [e.engine, e.mentioned]));
  const keys = [...new Set([...b.keys(), ...l.keys()])];
  const engines: EngineChange[] = keys.map((engine) => {
    const before = b.has(engine) ? b.get(engine)! : null;
    const after = l.has(engine) ? l.get(engine)! : null;
    const change = before == null || after == null ? "not_comparable" : before === after ? "same" : after ? "gained" : "lost";
    return { engine, before, after, change };
  });
  const old = new Set(baseline.evidence_urls);
  const newEvidence = latest.evidence_urls.filter((u) => !old.has(u));
  const delta = baseline.mention_pct != null && latest.mention_pct != null ? Number((latest.mention_pct - baseline.mention_pct).toFixed(1)) : null;
  return { engines, newEvidence, delta, supportedByNewEvidence: newEvidence.length > 0 };
}

export function snapFromResultMeta(meta: any): RunSnap {
  const answers: any[] = meta?.visibility_metrics?.engines || meta?.engine_mentions || [];
  return {
    engines: Array.isArray(meta?.engine_mentions) ? meta.engine_mentions : answers.map((a: any) => ({ engine: String(a.engine), mentioned: Boolean(a.mentioned) })),
    evidence_urls: Array.isArray(meta?.evidence_urls) ? meta.evidence_urls : [],
    mention_pct: meta?.query_pack_metrics?.organic_mention_rate?.value_pct ?? meta?.visibility_metrics?.mention_rate?.value_pct ?? null,
  };
}
