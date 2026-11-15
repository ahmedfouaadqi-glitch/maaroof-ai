export const VISIBILITY_TRIAL_RESULT_TTL_MS = 72 * 60 * 60 * 1000;
export const VISIBILITY_TRIAL_COOLDOWN_MS = 5 * 60 * 60 * 1000;
export const VISIBILITY_TRIAL_CYCLE_MS = VISIBILITY_TRIAL_RESULT_TTL_MS + VISIBILITY_TRIAL_COOLDOWN_MS;

export type VisibilityTrialWindow = {
  startedAt: Date;
  resultExpiresAt: Date;
  nextEligibleAt: Date;
};

/** The next trial can begin 77 hours after a genuine run starts. */
export function calculateVisibilityTrialWindow(startedAt: Date | string | number): VisibilityTrialWindow {
  const start = new Date(startedAt);
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid trial start time");
  return {
    startedAt: start,
    resultExpiresAt: new Date(start.getTime() + VISIBILITY_TRIAL_RESULT_TTL_MS),
    nextEligibleAt: new Date(start.getTime() + VISIBILITY_TRIAL_CYCLE_MS),
  };
}

export function isVisibilityTrialEligible(now: Date | string | number, nextEligibleAt: Date | string | number): boolean {
  const current = new Date(now).getTime();
  const eligible = new Date(nextEligibleAt).getTime();
  if (!Number.isFinite(current) || !Number.isFinite(eligible)) return false;
  return current >= eligible;
}

/** Initial delivery is view 1; exactly one later re-open is allowed before expiry. */
export function canRetrieveVisibilityTrialResult(
  now: Date | string | number,
  expiresAt: Date | string | number,
  viewCount: number,
): boolean {
  const current = new Date(now).getTime();
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(current) && Number.isFinite(expiry) &&
    current < expiry && Number.isInteger(viewCount) && viewCount === 1;
}
