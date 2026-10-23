import { Suspense, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { TOOL_UI, toolName } from "@/components/workspace/SkillToolsPanel";
import { SpotlightCard, ShinyText } from "@/components/motion/effects";
import { useVisibility } from "@/lib/visibility";

type L = "ar" | "en" | "ku";
const T = {
  ar: { title: "الأدوات المباشرة", sub: "شغّل أي أداة مباشرة بنفس منطقها وخصمها من رصيدك بعد النجاح فقط.", search: "ابحث عن أداة…", back: "كل الأدوات", none: "لا توجد أداة مطابقة" },
  en: { title: "Direct tools", sub: "Run any tool directly with the same logic; balance is charged only on success.", search: "Search tools…", back: "All tools", none: "No matching tool" },
  ku: { title: "ئامرازە ڕاستەوخۆکان", sub: "هەر ئامرازێک ڕاستەوخۆ بەکاربهێنە؛ تەنها لە سەرکەوتندا باڵانس دەبڕدرێت.", search: "گەڕان…", back: "هەموو ئامرازەکان", none: "هیچ ئامرازێک نییە" },
};

/** Direct tools tab: grid of every real tool UI, opened inline. Presentation only. */
export function DirectToolsPanel({ lang, tool }: { lang: L; tool?: string }) {
  const c = T[lang];
  const vis = useVisibility();
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const keys = useMemo(() => Object.keys(TOOL_UI).filter((k) => k === "report" || vis.isToolVisible(k)), [vis]);
  const shown = keys.filter((k) => toolName(k, lang).toLowerCase().includes(q.trim().toLowerCase()));
  const Tool = tool && keys.includes(tool) ? TOOL_UI[tool] : undefined;

  if (Tool) {
    return (
      <div className="space-y-4">
        <Link to="/workspace" search={{ tab: "tools" }} className="text-xs text-primary hover:underline">{c.back}</Link>
        <h2 className="text-lg font-semibold">{toolName(tool!, lang)}</h2>
        <section className="rounded-2xl border border-border bg-card p-5">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}><Tool /></Suspense>
        </section>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold"><ShinyText>{c.title}</ShinyText></h2>
        <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.search} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      {shown.length === 0 && <p className="text-sm text-muted-foreground">{c.none}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((k, i) => (
          <motion.div key={k} layout initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : i * 0.04, duration: 0.3 }} whileHover={reduce ? undefined : { rotateX: 3, rotateY: -3, scale: 1.02 }} style={{ transformPerspective: 800 }}>
            <Link to="/workspace" search={{ tab: "tools", tool: k }} className="block">
              <SpotlightCard className="p-4">
                <div className="text-sm font-semibold">{toolName(k, lang)}</div>
              </SpotlightCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
