/**
 * MAAROOF Ai global audio policy.
 * Audio is permanently disabled. These exports are no-op compatibility shims.
 */
export function isSoundEnabled(): boolean { return false; }
export function setSoundEnabled(_on: boolean): void {
  try { if (typeof localStorage !== "undefined") localStorage.removeItem("geo:sound"); } catch {}
}
export function playClick(): void {}
export function playSuccess(): void {}
export function playNotify(): void {}
export function playError(): void {}
export function attachGlobalClickSound(): void {}
