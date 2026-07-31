import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Activity, Sparkles, Search, ClipboardList, TrendingUp, Megaphone, Trophy, Share2, Bell, Target, FlaskConical, FileText, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/test-rail")({
  component: TestRailPage,
});

const tools = [
  { key: "analyze", icon: <Activity className="size-5" />, title: "أداة التحليل" },
  { key: "suggest", icon: <Sparkles className="size-5" />, title: "اقتراح المنشورات" },
  { key: "compare", icon: <Search className="size-5" />, title: "مقارنة المنافسين" },
  { key: "feasibility", icon: <ClipboardList className="size-5" />, title: "الجدوى" },
  { key: "bizdev", icon: <TrendingUp className="size-5" />, title: "تطوير الأعمال" },
  { key: "boost", icon: <Megaphone className="size-5" />, title: "تعزيز العلامة" },
  { key: "applied", icon: <Trophy className="size-5" />, title: "الترتيب التطبيقي" },
  { key: "social", icon: <Share2 className="size-5" />, title: "التحليل الاجتماعي" },
  { key: "monitor", icon: <Bell className="size-5" />, title: "مراقبة المنافسين" },
  { key: "strategist", icon: <Target className="size-5" />, title: "الاستراتيجي الجغرافي" },
  { key: "whatif", icon: <FlaskConical className="size-5" />, title: "ماذا لو" },
  { key: "report", icon: <FileText className="size-5" />, title: "منشئ التقارير" },
];

function TestRailPage() {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const updateScrollState = () => {
    const el = railRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft;
    const end = maxScroll - el.scrollLeft;
    setCanScrollStart(start > 1);
    setCanScrollEnd(end > 1);
  };

  const scrollRail = (dir: "start" | "end") => {
    const el = railRef.current;
    if (!el) return;
    const distance = Math.max(120, el.clientWidth * 0.55);
    const delta = dir === "end" ? distance : -distance;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen p-6" dir="rtl">
      <h1 className="mb-4 text-xl font-bold">Test Rail Scroll</h1>
      <div className="relative flex items-center rounded-3xl border border-border/70 bg-card/60 p-2 backdrop-blur">
        <button
          type="button"
          onClick={() => scrollRail("start")}
          disabled={!canScrollStart}
          aria-label="تمرير للخلف"
          className={`absolute left-0 z-10 inline-grid size-7 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground ${
            canScrollStart ? "opacity-100" : "pointer-events-none opacity-40"
          }`}
        >
          <ChevronRight className="size-3.5" />
        </button>

        <div ref={railRef} className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-9 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            >
              <span className="[&>svg]:size-3.5">{tool.icon}</span>
              <span className="max-w-[10rem] truncate">{tool.title}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollRail("end")}
          disabled={!canScrollEnd}
          aria-label="تمرير للأمام"
          className={`absolute right-0 z-10 inline-grid size-7 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground ${
            canScrollEnd ? "opacity-100" : "pointer-events-none opacity-40"
          }`}
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        canScrollStart: {String(canScrollStart)} | canScrollEnd: {String(canScrollEnd)}
      </p>
    </div>
  );
}
