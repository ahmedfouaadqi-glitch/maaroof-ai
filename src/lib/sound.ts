/** MAAROOF Ai global audio policy: all application audio is permanently disabled. */
export function isSoundEnabled(): boolean { return false; }
export function setSoundEnabled(_on: boolean): void { try { if (typeof localStorage !== "undefined") localStorage.removeItem("geo:sound"); } catch {} }
export function playClick(): void {}
export function playSuccess(): void {}
export function playNotify(): void {}
export function playError(): void {}
export function attachGlobalClickSound(): void {}
