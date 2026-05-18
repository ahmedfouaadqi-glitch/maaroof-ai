// Best-effort devtools / inspection deterrent for production.
// Note: a determined user with browser tooling cannot be fully blocked —
// this layer raises friction (disables right-click, common shortcuts,
// and detects open devtools to blank the page).

let attached = false;

export function attachDevtoolsGuard() {
  if (attached) return;
  if (typeof window === "undefined") return;

  // Skip in dev / Lovable preview iframe (so editing still works).
  const isProd = (import.meta as any).env?.PROD === true;
  const inLovablePreview =
    /lovable\.app$/i.test(window.location.hostname) === false
      ? false
      : window.location.hostname.includes("preview") ||
        new URLSearchParams(window.location.search).has("__lovable_token") ||
        window.self !== window.top;
  if (!isProd) return;
  if (inLovablePreview) return;

  attached = true;

  const block = (e: Event) => { e.preventDefault(); e.stopPropagation(); return false; };

  // Right-click
  document.addEventListener("contextmenu", block, { capture: true });

  // Text selection on body (keep inputs/textareas usable)
  document.addEventListener("selectstart", (e) => {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (el as any)?.isContentEditable) return;
    e.preventDefault();
  }, { capture: true });

  // Drag (image saving)
  document.addEventListener("dragstart", block, { capture: true });

  // Devtools / view-source shortcuts
  document.addEventListener("keydown", (e) => {
    const k = e.key?.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (
      e.key === "F12" ||
      (ctrl && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
      (ctrl && (k === "u" || k === "s"))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture: true });

  // Devtools-open detection (window size diff heuristic)
  let warned = false;
  const showBlock = () => {
    if (warned) return;
    warned = true;
    try {
      document.documentElement.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b0f1a;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
        '<div><h1 style="font-size:22px;margin:0 0 8px">Developer tools are disabled</h1>' +
        '<p style="opacity:.7;font-size:14px;margin:0">Please close the inspector to continue.</p></div></div>';
    } catch { /* noop */ }
  };

  const check = () => {
    const threshold = 160;
    const widthGap = window.outerWidth - window.innerWidth > threshold;
    const heightGap = window.outerHeight - window.innerHeight > threshold;
    if (widthGap || heightGap) showBlock();
  };
  setInterval(check, 1000);

  // Console open detector via getter trick
  try {
    const probe: any = {};
    Object.defineProperty(probe, "id", { get() { showBlock(); return ""; } });
    setInterval(() => { console.debug(probe); console.clear(); }, 2000);
  } catch { /* noop */ }
}
