// Lightweight browser+device fingerprint (no external deps)
// Combines stable signals into a SHA-256 hash.

export async function computeFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";
  const nav: any = window.navigator;
  const scr = window.screen;
  const parts = [
    nav.userAgent || "",
    nav.language || "",
    (nav.languages || []).join(",") || "",
    nav.platform || "",
    nav.hardwareConcurrency ?? "",
    nav.deviceMemory ?? "",
    nav.maxTouchPoints ?? "",
    `${scr.width}x${scr.height}x${scr.colorDepth}`,
    new Date().getTimezoneOffset(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    canvasSignal(),
  ];
  const text = parts.join("|");
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canvasSignal(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("geo-iraq-fp", 2, 2);
    return c.toDataURL().slice(-64);
  } catch { return ""; }
}
