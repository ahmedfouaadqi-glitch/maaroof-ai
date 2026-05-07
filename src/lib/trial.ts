// Anonymous trial counter (localStorage)
const KEY = "geo-trial-count";
const MAX = 2;

export function getTrialUsed(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(KEY) || "0", 10);
}
export function getTrialRemaining(): number {
  return Math.max(0, MAX - getTrialUsed());
}
export function bumpTrial(): number {
  const n = getTrialUsed() + 1;
  localStorage.setItem(KEY, String(n));
  return n;
}
export const TRIAL_MAX = MAX;
