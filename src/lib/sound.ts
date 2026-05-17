/**
 * Lightweight sound system using Web Audio API.
 * - Zero asset files, zero network cost.
 * - User-controlled via localStorage flag `geo:sound`.
 * - Auto-attaches click sound to any <button>, <a>, or [data-sound="click"] element.
 */

const STORAGE_KEY = "geo:sound";

let ctx: AudioContext | null = null;
let attached = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  // default ON for first-time visitors
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "1";
}

export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch {}
  window.dispatchEvent(new Event("geo:sound-changed"));
}

function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.04) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g).connect(c.destination);
  const now = c.currentTime;
  g.gain.linearRampToValueAtTime(gain, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  o.start(now);
  o.stop(now + durationMs / 1000 + 0.02);
}

export function playClick() {
  if (!isSoundEnabled()) return;
  tone(880, 50, "triangle", 0.025);
}

export function playSuccess() {
  if (!isSoundEnabled()) return;
  tone(660, 110, "sine", 0.05);
  setTimeout(() => tone(990, 160, "sine", 0.05), 90);
}

export function playNotify() {
  if (!isSoundEnabled()) return;
  tone(540, 90, "triangle", 0.04);
  setTimeout(() => tone(720, 140, "triangle", 0.04), 80);
}

export function playError() {
  if (!isSoundEnabled()) return;
  tone(220, 180, "sawtooth", 0.04);
}

/**
 * Global delegation: play a click tone for any user-initiated click on
 * buttons/links. Idempotent — safe to call multiple times.
 */
export function attachGlobalClickSound() {
  if (attached || typeof document === "undefined") return;
  attached = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!isSoundEnabled()) return;
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      const el = tgt.closest("button, a, [role='button'], [data-sound='click']");
      if (!el) return;
      // skip disabled
      if ((el as HTMLButtonElement).disabled) return;
      playClick();
    },
    { passive: true }
  );
}
