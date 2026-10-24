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

export type EngineDebateAnswer = {
  engine: string;
  mentioned?: boolean;
  answer?: string;
  grounded_answer?: string;
  status?: string;
  sources?: Array<{ url?: string; title?: string }>;
};

/** True only when usable engine answers actually split on whether the entity appeared. */
export function hasMaterialEngineConflict(answers: EngineDebateAnswer[]): boolean {
  const valid = (answers || []).filter((a) => !!a && typeof a.engine === "string" &&
    a.status !== "error" && a.status !== "timeout" && typeof a.mentioned === "boolean");
  return valid.length >= 2 && valid.some((a) => a.mentioned === true) && valid.some((a) => a.mentioned === false);
}

/** Convert real visibility-probe records into display data; no facts are inferred or invented. */
export function debateFromEngineAnswers(answers: EngineDebateAnswer[]) {
  const valid = (answers || []).filter((a) => !!a && typeof a.engine === "string" &&
    a.status !== "error" && a.status !== "timeout" && typeof a.mentioned === "boolean");
  const claims = valid.map((a) => {
    const links = Array.from(new Set((a.sources || []).map((s) => String(s?.url || "")).filter((u) => /^https?:\/\//i.test(u))));
    const text = String(a.grounded_answer || a.answer || "").trim().slice(0, 1000);
    return { expert: a.engine, engine: a.engine, text: text || (a.mentioned ? "Entity mentioned in blind answer; no grounded text returned." : "Entity not mentioned in blind answer; no grounded text returned."),
      kind: links.length ? "evidence" as const : "hypothesis" as const, links, mentioned: !!a.mentioned, verdict: a.mentioned ? "mentioned" : "not_mentioned" };
  });
  return { experts: valid.length, engineNames: valid.map((a) => a.engine), agreedTools: [], contestedTools: ["entity_appearance"], objections: [], claims,
    evidenceCount: claims.filter((c) => c.kind === "evidence").length, hypothesisCount: claims.filter((c) => c.kind === "hypothesis").length,
    conflictType: "engine_visibility_disagreement" };
}
