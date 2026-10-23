import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Lock, RotateCw } from "lucide-react";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

export type BrowserView = { url: string; screenshot: string | null; markdown: string; links: string[]; title?: string | null };

/** Real-page viewer inside the safe browser: address bar, back/forward, scrolling capture of the actual page. */
export function BrowserViewer({ lang, history, index, onIndex, onOpen, busy, isAllowed }: {
  lang: L; history: BrowserView[]; index: number; onIndex: (i: number) => void;
  onOpen: (url: string) => void; busy: boolean; isAllowed: (url: string) => boolean;
}) {
  const view = history[index];
  const scroller = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  // Auto-scroll while Maaroof "reads" the page (respects reduced motion).
  useEffect(() => {
    const el = scroller.current; if (!el || !view) return;
    el.scrollTop = 0; setProgress(0);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0; const start = performance.now(); const dur = 9000;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      el.scrollTop = p * (el.scrollHeight - el.clientHeight); setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const stop = () => cancelAnimationFrame(raf);
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, 600);
    el.addEventListener("wheel", stop, { once: true }); el.addEventListener("touchstart", stop, { once: true });
    return () => { clearTimeout(timer); stop(); };
  }, [view?.url, view?.screenshot]);

  if (!view) return null;
  const onScroll = () => { const el = scroller.current; if (el) setProgress(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)); };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div dir="ltr" className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-2 py-2">
        <button aria-label="back" disabled={index <= 0} onClick={() => onIndex(index - 1)} className="rounded-md p-1.5 hover:bg-accent disabled:opacity-30"><ArrowLeft className="size-4" /></button>
        <button aria-label="forward" disabled={index >= history.length - 1} onClick={() => onIndex(index + 1)} className="rounded-md p-1.5 hover:bg-accent disabled:opacity-30"><ArrowRight className="size-4" /></button>
        <button aria-label="reload" disabled={busy} onClick={() => onOpen(view.url)} className="rounded-md p-1.5 hover:bg-accent disabled:opacity-30"><RotateCw className={`size-4 ${busy ? "animate-spin" : ""}`} /></button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs">
          <Lock className="size-3 shrink-0 text-success" /><span className="truncate font-mono">{view.url}</span>
        </div>
        <a href={view.url} target="_blank" rel="noopener noreferrer" aria-label={tr(lang, "افتح في تبويب جديد", "Open in new tab", "لە تابی نوێ")} className="rounded-md p-1.5 hover:bg-accent"><ExternalLink className="size-4" /></a>
      </div>
      <div className="h-1 bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      <div ref={scroller} onScroll={onScroll} className="h-[28rem] overflow-y-auto bg-background">
        {view.screenshot
          ? <img src={view.screenshot} alt={view.title || view.url} className="w-full" />
          : <><div className="sticky top-0 flex items-center justify-between gap-2 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-xs"><span>{tr(lang, "عرض نصي — اللقطة غير متاحة لهذه الصفحة", "Text view — no page capture available", "پیشاندانی دەق — وێنە بەردەست نییە")}</span><button disabled={busy} onClick={() => onOpen(view.url)} className="rounded-md border border-border px-2 py-0.5 disabled:opacity-40">{tr(lang, "حاول بلقطة مجدداً", "Retry capture", "دووبارە")}</button></div><pre dir="auto" className="whitespace-pre-wrap p-4 text-sm leading-7">{view.markdown || tr(lang, "لا يوجد محتوى مقروء.", "No readable content.", "ناوەڕۆک نییە.")}</pre></>}
      </div>
      {view.links.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-t border-border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{tr(lang, "روابط في الصفحة (المفوّضة فقط قابلة للفتح)", "Links on the page (only granted ones open)", "بەستەرەکان")}</p>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {view.links.slice(0, 30).map((l) => {
              const ok = isAllowed(l);
              return <button key={l} disabled={!ok || busy} onClick={() => onOpen(l)} title={ok ? l : tr(lang, "خارج التفويض", "Outside grant", "دەرەوەی ڕێگەپێدان")}
                className="max-w-[16rem] truncate rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40">{l.replace(/^https?:\/\//, "")}</button>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}
