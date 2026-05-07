// Trial removed: free analyses now require email signup + verification.
// Kept as no-ops for backward compatibility.
export function getTrialUsed(): number { return 999; }
export function getTrialRemaining(): number { return 0; }
export function bumpTrial(): number { return 999; }
export const TRIAL_MAX = 0;
