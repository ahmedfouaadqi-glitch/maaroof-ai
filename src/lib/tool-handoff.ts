// Manual tool linking ("handoff"): pass a result from one tool into another.
// Source/Target keys map to anchor IDs on /dashboard.

export type HandoffTarget =
  | "analyze"
  | "suggest"
  | "research"
  | "feasibility"
  | "bizdev"
  | "compare"
  | "outreach"
  | "boost";

export const HANDOFF_TARGETS: HandoffTarget[] = [
  "analyze", "suggest", "research", "feasibility", "bizdev", "compare", "outreach", "boost",
];

export const HANDOFF_LABELS: Record<HandoffTarget, { ar: string; en: string; ku: string }> = {
  analyze:     { ar: "تحليل GEO",        en: "GEO Analysis",     ku: "شیکاری GEO" },
  suggest:     { ar: "مولّد المنشورات",  en: "Post Generator",   ku: "دروستکەری پۆست" },
  research:    { ar: "بحث ذكي",          en: "Smart Research",   ku: "گەڕانی زیرەک" },
  feasibility: { ar: "دراسة جدوى",       en: "Feasibility",      ku: "لێکۆڵینەوە" },
  bizdev:      { ar: "تطوير الأعمال",    en: "BizDev",           ku: "گەشەپێدانی کار" },
  compare:     { ar: "مقارنة المنافسين", en: "Compare",          ku: "بەراوردکردن" },
  outreach:    { ar: "إيميل شركات",      en: "Company Outreach", ku: "ئیمەیڵ" },
  boost:       { ar: "تعزيز العلامة",    en: "Brand Boost",      ku: "بەهێزکردن" },
};

const STORAGE_PREFIX = "geo:handoff:";
const eventName = (t: HandoffTarget) => `geo:reuse-${t}`;

/** Send text into a target tool: dispatches event + persists for late mounts + scrolls/navigates. */
export function sendHandoff(target: HandoffTarget, text: string) {
  try { sessionStorage.setItem(STORAGE_PREFIX + target, text); } catch {}
  window.dispatchEvent(new CustomEvent(eventName(target), { detail: { text } }));
  // navigate to dashboard if not already on a page that hosts the target
  const onDash = window.location.pathname.startsWith("/dashboard");
  const onHomeOk = window.location.pathname === "/" && (target === "analyze" || target === "suggest");
  if (!onDash && !onHomeOk) {
    window.location.href = `/dashboard#${target}`;
    return;
  }
  setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

/** Hook helper: read & clear pending handoff from sessionStorage on mount + listen for live events. */
export function consumeHandoff(target: HandoffTarget): string | null {
  try {
    const v = sessionStorage.getItem(STORAGE_PREFIX + target);
    if (v) sessionStorage.removeItem(STORAGE_PREFIX + target);
    return v;
  } catch { return null; }
}

export function handoffEventName(target: HandoffTarget) { return eventName(target); }
