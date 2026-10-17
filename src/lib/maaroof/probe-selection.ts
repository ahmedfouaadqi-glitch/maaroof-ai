export type ProbeBudget = {
  eligibleCount: number;
  hasMeter: boolean;
  balance: number | null | undefined;
  dailyLimit: number | null | undefined;
  monthlyLimit: number | null | undefined;
  usedToday: number | null | undefined;
  usedMonth: number | null | undefined;
  tokensPerEngine: number | null | undefined;
  priced: boolean;
  disabled: boolean;
};

/**
 * Returns the maximum engine count affordable under the current snapshot.
 * The actual charge remains authoritative and atomic in chargeTokens().
 */
export function affordableProbeEngineCount(budget: ProbeBudget): number {
  const eligible = Math.max(0, Math.min(10, Math.floor(Number(budget.eligibleCount) || 0)));
  if (eligible === 0) return 0;

  // Legacy/unmetered users do not use the token ledger.
  if (!budget.hasMeter) return eligible;

  const perEngine = Number(budget.tokensPerEngine);
  if (budget.disabled || !budget.priced || !Number.isFinite(perEngine) || perEngine <= 0) return 0;

  const balance = Math.max(0, Number(budget.balance) || 0);
  const balanceCount = Math.floor(balance / perEngine);
  const dailyLimit = budget.dailyLimit == null ? Number.POSITIVE_INFINITY : Math.max(0, Number(budget.dailyLimit) - Math.max(0, Number(budget.usedToday) || 0));
  const monthlyLimit = budget.monthlyLimit == null ? Number.POSITIVE_INFINITY : Math.max(0, Number(budget.monthlyLimit) - Math.max(0, Number(budget.usedMonth) || 0));
  const dailyCount = Math.floor(dailyLimit / perEngine);
  const monthlyCount = Math.floor(monthlyLimit / perEngine);

  return Math.max(0, Math.min(eligible, balanceCount, dailyCount, monthlyCount));
}
