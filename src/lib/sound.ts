/**
 * MAAROOF Ai global audio policy.
 *
 * Audio is permanently disabled at application level. These exports remain
 * as no-op compatibility shims so existing callers cannot emit sound.
 * Do not reintroduce Web Audio, HTML audio playback, or user sound toggles.
 */

export function isSoundEnabled(): boolean {
  return false;
}

export function setSoundEnabled(_on: boolean): void {
  // Intentionally disabled. Remove the legacy preference if it exists.
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem("geo:sound");
  } catch {
    // Storage may be unavailable; audio remains disabled regardless.
  }
}

export function playClick(): void {
  // Audio disabled globally.
}

export function playSuccess(): void {
  // Audio disabled globally.
}

export function playNotify(): void {
  // Audio disabled globally.
}

export function playError(): void {
  // Audio disabled globally.
}

export function attachGlobalClickSound(): void {
  // Intentionally do not register any sound-producing event listeners.
}
