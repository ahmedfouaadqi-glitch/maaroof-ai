// Architecture & Concept: Ahmed Maaroof
// Balanced inspection deterrent for production.
// - Text selection, copy and right-click stay allowed (normal usability).
// - F12 / Inspect / View-source shortcuts are blocked and the user sees a
//   short, polite notice explaining why. The page is never blanked, so
//   iPhone/iPad/Safari (whose toolbars change window size) are never locked.

let attached = false;

const MSG: Record<string, string> = {
  ar: "أدوات المطورين معطلة في هذه المنصة لحماية بيانات الحسابات والأدوات. يمكنك النسخ والتظليل بشكل طبيعي.",
  en: "Developer tools are disabled on this platform to protect account and tool data. Copying and selecting text still work.",
  ku: "ئامرازەکانی گەشەپێدەر لەم پلاتفۆرمەدا ناچالاکن بۆ پاراستنی داتاکان. کۆپیکردن و هەڵبژاردنی دەق کار دەکات.",
};

function notice() {
  try {
    const lang = (document.documentElement.lang || "ar").slice(0, 2);
    const text = MSG[lang] || MSG.ar;
    let el = document.getElementById("__dt_notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "__dt_notice";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;z-index:2147483647;left:50%;bottom:24px;transform:translateX(-50%);max-width:92vw;padding:10px 16px;border-radius:12px;background:rgba(15,20,40,.95);color:#e5e7eb;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4);text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.dir = lang === "en" ? "ltr" : "rtl";
    el.style.display = "block";
    window.clearTimeout((el as any)._t);
    (el as any)._t = window.setTimeout(() => { if (el) el.style.display = "none"; }, 4000);
  } catch { /* noop */ }
}

export function attachDevtoolsGuard() {
  if (attached) return;
  if (typeof window === "undefined") return;

  const isProd = (import.meta as any).env?.PROD === true;
  const host = window.location.hostname;
  const inLovablePreview =
    /lovable\.app$/i.test(host) &&
    (host.includes("preview") ||
      new URLSearchParams(window.location.search).has("__lovable_token") ||
      window.self !== window.top);
  if (!isProd || inLovablePreview) return;

  attached = true;

  document.addEventListener("keydown", (e) => {
    const k = e.key?.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const blocked =
      e.key === "F12" ||
      (ctrl && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
      (e.metaKey && e.altKey && (k === "i" || k === "j" || k === "c" || k === "u")) ||
      (ctrl && k === "u");
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      notice();
    }
  }, { capture: true });
}
