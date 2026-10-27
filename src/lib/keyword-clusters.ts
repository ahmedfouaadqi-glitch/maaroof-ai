// Pure: groups file keywords into small semantic clusters per market so each cluster can be asked
// to the ten engines on its own. Grouping is a written rule (shared head word), never a guess about meaning.

export type KeywordCluster = { market: string; head: string; keywords: string[]; hasWinner: boolean };

const STOP = new Set(["the", "and", "for", "with", "best", "near", "online", "buy", "in", "of", "to", "من", "في", "على", "افضل", "أفضل"]);

export function headWord(k: string): string {
  const words = k.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w));
  return words[0] || "";
}

/** Clusters for one market: winners first, then larger clusters. `limit` caps the number returned (0 = none). */
export function buildClusters(market: string, keywords: string[], winners: Set<string>, limit: number, perCluster = 5): KeywordCluster[] {
  const max = Math.max(0, Math.min(10, Math.floor(limit || 0)));
  if (!max) return [];
  const groups = new Map<string, KeywordCluster>();
  const seen = new Set<string>();
  for (const raw of keywords) {
    const k = String(raw || "").trim(); const key = k.toLowerCase();
    if (k.length < 3 || seen.has(key)) continue; seen.add(key);
    const h = headWord(k); if (!h) continue;
    const g = groups.get(h) || { market, head: h, keywords: [], hasWinner: false };
    if (g.keywords.length < perCluster) g.keywords.push(k);
    if (winners.has(key)) g.hasWinner = true;
    groups.set(h, g);
  }
  return [...groups.values()].sort((a, b) => Number(b.hasWinner) - Number(a.hasWinner) || b.keywords.length - a.keywords.length).slice(0, max);
}

/** Question asked to every engine for one cluster (blind: no brand is named). */
export function clusterQuestion(c: KeywordCluster, marketName: string): string {
  return `A user in ${marketName} searches for: ${c.keywords.map((k) => `"${k}"`).join(", ")}. Which providers, brands or websites would you recommend and why? Answer organically.`;
}

export type ClusterAnswer = { market: string; engine: string; status: "answered" | "no_answer" | "empty" | "timeout" | "http_error" | "error"; answer: string; keywords: string[]; query?: string; error?: string; provider_path?: "primary" | "fallback"; model_used?: string };

/** Measured score for one keyword: engines whose cluster answer contains it. null = not measured. */
export function clusterScore(answers: ClusterAnswer[], market: string, keyword: string): { engines: string[]; answered: number } | null {
  const kw = keyword.toLowerCase().trim();
  const rel = answers.filter((a) => a.market === market && a.keywords.some((k) => k.toLowerCase() === kw));
  const answered = rel.filter((a) => a.status === "answered" && a.provider_path !== "fallback");
  if (!answered.length) return null;
  return { engines: [...new Set(answered.filter((a) => a.answer.toLowerCase().includes(kw)).map((a) => a.engine))], answered: answered.length };
}

/** Clusters that got at least one real answer — the only ones that are charged. */
export function answeredClusterCount(answers: ClusterAnswer[]): number {
  return new Set(answers.filter((a) => a.status === "answered").map((a) => `${a.market}|${a.keywords.join("|")}`)).size;
}
