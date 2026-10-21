// Pure helpers for workspace side panels (no I/O).
export type LedgerRow = { tokens: number; tool_key: string; created_at: string };

/** Sum of real charged tokens in the given month, plus top tools by spend. */
export function summarizeLedger(rows: LedgerRow[], now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let month = 0, total = 0;
  const byTool = new Map<string, number>();
  for (const r of rows) {
    const t = Math.max(0, Number(r.tokens) || 0);
    total += t;
    const d = new Date(r.created_at);
    if (d.getUTCFullYear() === y && d.getUTCMonth() === m) month += t;
    byTool.set(r.tool_key, (byTool.get(r.tool_key) || 0) + t);
  }
  const top = [...byTool.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tool, tokens]) => ({ tool, tokens }));
  return { month, total, top };
}

/** Knowledge completion % from answered interview questions and saved facts. */
export function knowledgeCompletion(answered: number, asked: number, facts: number): number {
  const a = Math.max(0, answered), q = Math.max(0, asked), f = Math.max(0, facts);
  if (q === 0 && f === 0) return 0;
  const interview = q > 0 ? a / q : 0;
  const factScore = Math.min(1, f / 20);
  return Math.round((q > 0 ? interview * 0.6 + factScore * 0.4 : factScore) * 100);
}
