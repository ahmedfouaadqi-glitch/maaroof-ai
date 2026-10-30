import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { Link } from "@tanstack/react-router";
import { MAAROOF_SKILLS, skillFramework } from "@/lib/maaroof/skill-catalog";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { useVisibility } from "@/lib/visibility";

type L = "ar" | "en" | "ku";

export const TOOL_UI: Record<string, LazyExoticComponent<ComponentType<any>>> = {
  analyze: lazy(() => import("@/components/Sandbox").then((m) => ({ default: m.Sandbox }))),
  suggest: lazy(() => import("@/components/PostSuggester").then((m) => ({ default: m.PostSuggester }))),
  compare: lazy(() => import("@/components/CompetitorCompare").then((m) => ({ default: m.CompetitorCompare }))),
  known: lazy(() => import("@/components/KnownDiscovery").then((m) => ({ default: m.KnownDiscovery }))),
  feasibility: lazy(() => import("@/components/FeasibilityStudy").then((m) => ({ default: m.FeasibilityStudy }))),
  bizdev: lazy(() => import("@/components/BizDev").then((m) => ({ default: m.BizDev }))),
  brand_boost: lazy(() => import("@/components/BrandBoostAgent").then((m) => ({ default: m.BrandBoostAgent }))),
  applied_ranking: lazy(() => import("@/components/AppliedRanking").then((m) => ({ default: m.AppliedRanking }))),
  social_analysis: lazy(() => import("@/components/SocialAnalysis").then((m) => ({ default: m.SocialAnalysis }))),
  competitor_monitor: lazy(() => import("@/components/CompetitorMonitor").then((m) => ({ default: m.CompetitorMonitor }))),
  geo_strategist: lazy(() => import("@/components/GeoStrategist").then((m) => ({ default: m.GeoStrategist }))),
  what_if: lazy(() => import("@/components/WhatIfSimulator").then((m) => ({ default: m.WhatIfSimulator }))),
  visibility: lazy(() => import("@/components/AIVisibility").then((m) => ({ default: m.AIVisibility }))),
  research: lazy(() => import("@/components/SmartResearch").then((m) => ({ default: m.SmartResearch }))),
  company_email: lazy(() => import("@/components/CompanyOutreach").then((m) => ({ default: m.CompanyOutreach }))),
  security_scan: lazy(() => import("@/components/SecurityScanCard").then((m) => ({ default: (p: any) => m.SecurityScanCard({ lang: p?.lang || "ar" }) }))),
  keyword_intelligence: lazy(() => import("@/components/KeywordIntelligence").then((m) => ({ default: m.KeywordIntelligence }))),
  report: lazy(() => import("@/components/ReportBuilder").then((m) => ({ default: m.ReportBuilder }))),
};

const T = {
  ar: { title: "المهارات وأدواتها", pick: "اختر مهارة لترى أدواتها", tools: "الأدوات", open: "فتح", viaTask: "تعمل ضمن المهام فقط", report: "منشئ التقارير", back: "كل المهارات" },
  en: { title: "Skills and their tools", pick: "Pick a skill to see its tools", tools: "Tools", open: "Open", viaTask: "Runs inside tasks only", report: "Report builder", back: "All skills" },
  ku: { title: "کارامەییەکان و ئامرازەکانیان", pick: "کارامەیییەک هەڵبژێرە", tools: "ئامرازەکان", open: "کردنەوە", viaTask: "تەنها لە ئەرکەکاندا", report: "دروستکەری ڕاپۆرت", back: "هەموو کارامەییەکان" },
};

const EXTRA_NAMES: Record<string, Record<L, string>> = {
  security_scan: { ar: "الفحص الأمني", en: "Security Scan", ku: "پشکنینی ئاسایش" },
};

export function toolName(key: string, l: L): string {
  if (key === "report") return T[l].report;
  if (EXTRA_NAMES[key]) return EXTRA_NAMES[key][l];
  const t = TOOL_CATALOG.find((x) => x.key === key);
  return t?.labels[l] ?? key;
}

/** Skills tab: each skill opens its real tools inline, same components and logic as before. */
export function SkillToolsPanel({ lang, skill, tool, workspaceId = null }: { lang: L; skill?: string; tool?: string; workspaceId?: string | null }) {
  const c = T[lang];
  const vis = useVisibility();
  const s = MAAROOF_SKILLS.find((x) => x.key === skill);
  const Tool = tool ? TOOL_UI[tool] : undefined;
  const visible = (k: string) => k === "report" || vis.isToolVisible(k);

  if (!s && tool !== "report") {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">{c.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{c.pick}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MAAROOF_SKILLS.map((x) => (
            <Link key={x.key} to="/workspace" search={{ tab: "skills", skill: x.key }} className="rounded-xl border border-border p-3 transition hover:border-primary/40">
              <div className="text-sm font-semibold">{x.label[lang]}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{x.description[lang]}</p>
            </Link>
          ))}
          <Link to="/workspace" search={{ tab: "skills", tool: "report" }} className="rounded-xl border border-dashed border-border p-3 text-sm font-semibold hover:border-primary/40">{c.report}</Link>
        </div>
      </section>
    );
  }

  const f = s ? skillFramework(s, lang) : null;
  return (
    <div className="space-y-4">
      <Link to="/workspace" search={{ tab: "skills" }} className="text-xs text-primary hover:underline">{c.back}</Link>
      {s && f && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">{s.label[lang]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{f.goal}</p>
          <h3 className="mt-4 text-xs font-semibold text-primary">{c.tools}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.tools.filter(visible).map((k) => TOOL_UI[k]
              ? <Link key={k} to="/workspace" search={{ tab: "skills", skill: s.key, tool: k }} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${tool === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{toolName(k, lang)}</Link>
              : <span key={k} className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground" title={c.viaTask}>{toolName(k, lang)} · {c.viaTask}</span>)}
          </div>
        </section>
      )}
      {Tool && tool && visible(tool) && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}><Tool lang={lang} workspaceId={workspaceId} /></Suspense>
        </section>
      )}
    </div>
  );
}
