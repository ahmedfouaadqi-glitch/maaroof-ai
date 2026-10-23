// Pure critical-debate summary over recorded council opinions. Zero model calls, zero cost.
// Separates evidence (a claim that carries a real http link) from hypothesis (no link).
export type Opinion = { expert: string; opinion?: string | null; objection?: string | null; suggest_tools?: string[]; confidence?: number | null; error?: string };
export type DebateClaim = { expert: string; text: string; kind: "evidence" | "hypothesis"; links: string[] };
export type DebateSummary = {
  experts: number;
  agreedTools: string[];
  contestedTools: string[];
  objections: Array<{ expert: string; text: string }>;
  claims: DebateClaim[];
  evidenceCount: number;
  hypothesisCount: number;
};

const LINK_RE = /https?:\/\/[^\s)"'<>،]+/g;

export function classifyClaim(text: string): { kind: "evidence" | "hypothesis"; links: string[] } {
  const links = Array.from(new Set(String(text || "").match(LINK_RE) || []));
  return { kind: links.length ? "evidence" : "hypothesis", links };
}

export function debateFromOpinions(all: Opinion[]): DebateSummary | null {
  const ops = all.filter((o) => !o.error && (o.opinion || o.objection));
  if (ops.length < 2) return null;
  const counts = new Map<string, number>();
  for (const o of ops) for (const t of new Set(o.suggest_tools || [])) counts.set(t, (counts.get(t) || 0) + 1);
  const agreedTools: string[] = [], contestedTools: string[] = [];
  for (const [t, n] of counts) (n === ops.length ? agreedTools : contestedTools).push(t);
  const claims = ops.filter((o) => o.opinion).map((o) => ({ expert: o.expert, text: String(o.opinion).slice(0, 400), ...classifyClaim(String(o.opinion)) }));
  return {
    experts: ops.length,
    agreedTools: agreedTools.sort(),
    contestedTools: contestedTools.sort(),
    objections: ops.filter((o) => o.objection && String(o.objection).trim()).map((o) => ({ expert: o.expert, text: String(o.objection).slice(0, 300) })),
    claims,
    evidenceCount: claims.filter((c) => c.kind === "evidence").length,
    hypothesisCount: claims.filter((c) => c.kind === "hypothesis").length,
  };
}
