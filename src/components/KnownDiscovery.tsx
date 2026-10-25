import { useEffect, useMemo, useState } from "react";
import { Loader2, Radar, Bell, ExternalLink, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { ToolResultExport } from "@/components/ToolResultExport";
import { ToolHistory } from "@/components/ToolHistory";
import { GeoScopeSelector, getEffectiveScope } from "@/components/GeoScopeSelector";
import { MkdMap } from "@/components/MkdMap";
import { useAuth } from "@/lib/auth";
import { ENGINE_LOGOS } from "@/components/engine-logos";
import { ENGINE_CATALOG, isEngineKey } from "@/lib/ai-engines";
import { sendHandoff } from "@/lib/tool-handoff";
import { EngineResponseFlow } from "@/components/EngineResponseFlow";

const TX = {
  ar: {
    aiWhy: "هذا الاسم ذكره الذكاء الاصطناعي من ذاكرته، ولم نجد له مصدراً على الويب في سوقك. قد يكون صحيحاً، لكننا لا نعتمده دليلاً حتى يظهر مصدر.", reused: "استخدمنا نتيجة سابقة بتاريخ", refresh: "تحديث الآن", toGeo: "تحليل GEO", toCompare: "مقارنة المختارين",
    market: "السوق", engines: "ذكرته المحركات", step: "مرحلة", steps: ["البحث في مصادر السوق…","سؤال المحركات…","استخراج المنافسين وتصنيفهم…","التحقق من الأدلة…"] as string[],
    intro: "اكتشف من يُنافسك فعلاً — حتى من لم تسمّهم — مع سبب كل علاقة ومصادرها. ما يأتي من ملاحظة الذكاء الاصطناعي وحدها يُوسَم بوضوح ولا يُعدّ موثّقاً.",
    brand: "اسم علامتك", site: "موقعك (اختياري)", sector: "القطاع (اختياري)", quick: "سريع", deep: "عميق", run: "اكتشف المنافسين",
    running: "جارٍ البحث في الويب وتصنيف العلاقات…", why: "لماذا؟", conf: "الثقة", ai: "ملاحظة ذكاء اصطناعي", observed: "مرصود من مصادر", sources: "المصادر",
    watch: "راقب", startWatch: "ابدأ المراقبة للمختارين", watchCost: "كل فحص للمراقبة يُخصم من حصتك", left: "مراقبات متاحة", none: "لم يُعثر على منافسين موثوقين.", started: "تم إنشاء المراقبة. تجدها في أداة «مراقبة المنافسين».",
    filtered: "استُبعد كنتائج كاذبة", map: "خريطة العلاقات",
    cats: { direct: "مباشر", indirect: "غير مباشر", substitute: "بديل", hidden: "خفي", emerging: "ناشئ", perceived: "إدراك الذكاء الاصطناعي", seasonal: "موسمي" },
    errs: { monitor_disabled: "المراقبة غير مفعّلة لحسابك.", monitor_max_watches: "بلغت الحد الأقصى لعدد المراقبات.", monitor_max_competitors: "اخترت منافسين أكثر من المسموح.", monitor_min_frequency: "التكرار أقل من المسموح.", brand_required: "اكتب اسم العلامة." } as Record<string, string>,
  },
  en: {
    aiWhy: "An AI engine named this from its own memory, and we found no web source for it in your market. It may be right, but we don't treat it as evidence until a source appears.", reused: "Reused a previous result from", refresh: "Refresh now", toGeo: "GEO analysis", toCompare: "Compare selected",
    market: "Market", engines: "Named by engines", step: "Step", steps: ["Searching market sources…","Asking AI engines…","Extracting and classifying…","Checking evidence…"] as string[],
    intro: "Discover who actually competes with you — even unnamed rivals — with a reason and sources for every relation. AI-only observations are clearly flagged and never treated as verified.",
    brand: "Your brand", site: "Website (optional)", sector: "Sector (optional)", quick: "Quick", deep: "Deep", run: "Discover competitors",
    running: "Searching the web and classifying relations…", why: "Why?", conf: "Confidence", ai: "AI observation", observed: "Observed in sources", sources: "Sources",
    watch: "Watch", startWatch: "Start monitoring selected", watchCost: "Each monitoring check is charged from your quota", left: "Watches available", none: "No reliable competitors found.", started: "Monitoring created. Find it in the Competitor Monitor tool.",
    filtered: "Filtered as false positives", map: "Relations map",
    cats: { direct: "Direct", indirect: "Indirect", substitute: "Substitute", hidden: "Hidden", emerging: "Emerging", perceived: "AI perception", seasonal: "Seasonal" },
    errs: { monitor_disabled: "Monitoring is disabled for your account.", monitor_max_watches: "You reached the maximum number of watches.", monitor_max_competitors: "Too many competitors selected.", monitor_min_frequency: "Frequency below the allowed minimum.", brand_required: "Enter a brand name." } as Record<string, string>,
  },
  ku: {
    aiWhy: "ئەم ناوە زیرەکی دەستکرد لە بیرەوەری خۆیەوە هێناویەتی و هیچ سەرچاوەیەکی وێبمان لە بازاڕەکەتدا بۆی نەدۆزییەوە. لەوانەیە ڕاست بێت، بەڵام تا سەرچاوەیەک دەرنەکەوێت وەک بەڵگە ناژمێردرێت.", reused: "ئەنجامێکی پێشوومان بەکارهێنا لە", refresh: "ئێستا نوێ بکەرەوە", toGeo: "شیکاری GEO", toCompare: "بەراوردکردنی هەڵبژێردراوەکان",
    market: "بازاڕ", engines: "بزوێنەرەکان ناویان برد", step: "هەنگاو", steps: ["گەڕان لە سەرچاوەکانی بازاڕ…","پرسیار لە بزوێنەرەکان…","دەرهێنان و پۆلێنکردن…","پشکنینی بەڵگەکان…"] as string[],
    intro: "بزانە کێ بەڕاستی ڕکابەرتە — تەنانەت ئەوانەی ناوت نەبردوون — لەگەڵ هۆکار و سەرچاوەی هەر پەیوەندییەک. تێبینی تەنها زیرەکی دەستکرد بە ڕوونی نیشان دەدرێت.",
    brand: "ناوی براندەکەت", site: "ماڵپەڕ (ئارەزوومەندانە)", sector: "کەرت (ئارەزوومەندانە)", quick: "خێرا", deep: "قووڵ", run: "دۆزینەوەی ڕکابەران",
    running: "گەڕان لە وێب و پۆلێنکردنی پەیوەندییەکان…", why: "بۆچی؟", conf: "متمانە", ai: "تێبینی زیرەکی دەستکرد", observed: "لە سەرچاوەکان بینراوە", sources: "سەرچاوەکان",
    watch: "چاودێری", startWatch: "دەستپێکردنی چاودێری بۆ هەڵبژێردراوەکان", watchCost: "هەر پشکنینێکی چاودێری لە بەشەکەت دەبڕدرێت", left: "چاودێری بەردەست", none: "هیچ ڕکابەرێکی متمانەپێکراو نەدۆزرایەوە.", started: "چاودێری دروستکرا. لە ئامرازی چاودێری ڕکابەران بیدۆزەوە.",
    filtered: "وەک ئەنجامی هەڵە لابرا", map: "نەخشەی پەیوەندییەکان",
    cats: { direct: "ڕاستەوخۆ", indirect: "ناڕاستەوخۆ", substitute: "جێگرەوە", hidden: "شاراوە", emerging: "نوێ", perceived: "تێگەیشتنی AI", seasonal: "وەرزی" },
    errs: { monitor_disabled: "چاودێری بۆ هەژمارەکەت ناچالاکە.", monitor_max_watches: "گەیشتیتە زۆرترین ژمارەی چاودێری.", monitor_max_competitors: "ڕکابەری زیاتر لە ڕێگەپێدراو.", monitor_min_frequency: "دووبارەبوونەوە کەمترە لە ڕێگەپێدراو.", brand_required: "ناوی براند بنووسە." } as Record<string, string>,
  },
};

async function post(path: string, body: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || j?.message || "failed");
  return j;
}

export function KnownDiscovery({ workspaceId = null }: { workspaceId?: string | null } = {}) {
  const { lang } = useI18n();
  const L = TX[(lang as "ar" | "en" | "ku") || "ar"] || TX.ar;
  const [brand, setBrand] = useState("");
  const [site, setSite] = useState("");
  const [sector, setSector] = useState("");
  const [depth, setDepth] = useState<"quick" | "deep">("quick");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [note, setNote] = useState("");
  const auth = useAuth() as any;
  const [stage, setStage] = useState(0);

  useEffect(() => { post("/api/competitor-monitor", { action: "policy" }).then(setPolicy).catch(() => {}); }, []);

  // Real server-driven progress via SSE: stages arrive as the run advances.
  const run = async (force = false) => {
    setBusy(true); setErr(""); setNote(""); setPicked([]); setStage(0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await apiFetch("/api/known", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ brand, website: site, sector, depth, lang, force, workspace_id: workspaceId, scope: getEffectiveScope(auth?.profile, "known") }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "failed");
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          const ev = p.match(/^event: (\w+)/m)?.[1];
          const raw = p.match(/^data: (.*)$/m)?.[1];
          if (!ev || !raw) continue;
          let j: any = {};
          try { j = JSON.parse(raw); } catch { continue; }
          if (ev === "progress") setStage(Math.max(0, Math.min(3, Number(j.stage) || 0)));
          else if (ev === "result") setResult(j);
          else if (ev === "error") throw new Error(j.error || "failed");
        }
      }
    } catch (e: any) { setErr(L.errs[e?.message] || e?.message || "failed"); }
    finally { setBusy(false); }
  };

  const startWatch = async () => {
    setErr(""); setNote("");
    try {
      await post("/api/competitor-monitor", { action: "create", workspace_id: workspaceId, brand: result?.brand || brand, competitors: picked, frequency_hours: Math.max(24, policy?.policy?.min_frequency_hours || 24), lang });
      setNote(L.started); setPicked([]);
      post("/api/competitor-monitor", { action: "policy" }).then(setPolicy).catch(() => {});
    } catch (e: any) { setErr(L.errs[e?.message] || e?.message || "failed"); }
  };

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const r of result?.relations || []) (g[r.category] ||= []).push(r);
    return g;
  }, [result]);

  const maxComp = policy?.policy?.max_competitors ?? 5;
  const canWatch = policy?.policy?.enabled !== false;
  const watchesLeft = policy ? Math.max(0, (policy.policy?.max_watches ?? 0) - (policy.active ?? 0)) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <p className="mb-3 text-xs text-muted-foreground">{L.intro}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={L.brand} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={site} onChange={(e) => setSite(e.target.value)} placeholder={L.site} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder={L.sector} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="mt-3"><GeoScopeSelector compact toolKey="known" /></div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["quick", "deep"] as const).map((d) => (
            <button key={d} onClick={() => setDepth(d)} className={`rounded-full border px-3 py-1 text-xs ${depth === d ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{L[d]}</button>
          ))}
          <button onClick={() => run(false)} disabled={busy || brand.trim().length < 2} className="ms-auto inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />} {L.run}
          </button>
        </div>
        {busy && <p className="mt-2 text-xs text-muted-foreground">{L.step} {stage + 1}/4 — {L.steps[stage]}</p>}
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        {note && <p className="mt-2 text-xs text-primary">{note}</p>}
      </div>

      {result && (
        <>
          {result.reused && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
              <span>{L.reused} {new Date(result.reused.from).toLocaleString()}</span>
              <button onClick={() => run(true)} disabled={busy} className="ms-auto rounded-md border border-primary px-2 py-1 text-primary">{L.refresh}</button>
            </div>
          )}
          <div className="flex justify-end"><ToolResultExport toolKey="known" result={result} /></div>
          <p className="text-xs text-muted-foreground">{L.market}: <b className="text-foreground">{result.market}</b>{result.engines_asked?.length ? ` · ${L.engines}: ${result.engines_asked.length}` : ""}</p>
          {result.summary && <p className="rounded-xl border border-border bg-card/40 p-3 text-sm">{result.summary}</p>}
          {result.engine_answers && (
            <EngineResponseFlow
              compact
              answers={[...(result.engines_asked || []), ...Object.keys(result.engine_status || {})].filter((k, i, a) => a.indexOf(k) === i).filter(isEngineKey).map((k: any) => ({ key: k, items: result.engine_answers[k] || [], basis: "measured" as const, status: result.engine_status?.[k] }))}
            />
          )}
          {(result.relations || []).length > 0 && (
            <div>
              <h4 className="mb-1 text-sm font-semibold text-primary">{L.map}</h4>
              <MkdMap brand={result.brand} relations={result.relations} cats={L.cats as any} observedLabel={L.observed} aiLabel={L.ai} />
            </div>
          )}
          {(result.relations || []).length === 0 && <p className="text-sm text-muted-foreground">{L.none}</p>}
          {Object.entries(groups).map(([cat, rows]) => (
            <div key={cat} className="space-y-2">
              <h4 className="text-sm font-semibold text-primary">{(L.cats as any)[cat] || cat} · {rows.length}</h4>
              {rows.map((r: any) => (
                <div key={r.entity_name} className="rounded-xl border border-border bg-card/50 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.entity_name}</span>
                    {r.entity_domain && <span className="text-xs text-muted-foreground">{r.entity_domain}</span>}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{L.conf} {r.confidence}%</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${r.is_ai_observation ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                      {r.is_ai_observation ? <><Sparkles className="inline size-3" /> {L.ai}</> : L.observed}
                    </span>
                    {r.is_ai_observation && (
                      <span className="group relative inline-flex">
                        <span tabIndex={0} className="cursor-help rounded-full border border-accent/40 px-1.5 text-[10px] text-accent">?</span>
                        <span role="tooltip" className="pointer-events-none absolute bottom-full start-0 z-20 mb-1 hidden w-64 rounded-lg border border-border bg-popover p-2 text-[11px] text-popover-foreground shadow-lg group-hover:block group-focus-within:block">{L.aiWhy}</span>
                      </span>
                    )}
                    {result.engines_asked?.length > 0 && (
                      <span className="inline-flex items-center gap-1" title={`${L.engines} ${r.engines?.length || 0}/${result.engines_asked.length}`}>
                        {result.engines_asked.filter(isEngineKey).map((e: any) => {
                          const Logo = ENGINE_LOGOS[e as keyof typeof ENGINE_LOGOS];
                          const on = (r.engines || []).includes(e);
                          return <span key={e} title={ENGINE_CATALOG[e as keyof typeof ENGINE_CATALOG].name} className={`grid size-5 place-items-center rounded-md border border-border bg-background ${on ? "" : "opacity-25 grayscale"}`}><Logo className="size-3.5" /></span>;
                        })}
                      </span>
                    )}
                    <button onClick={() => sendHandoff("analyze", r.entity_domain || r.entity_name)} className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:border-primary hover:text-primary">{L.toGeo}</button>
                    {canWatch && (
                      <label className="ms-auto flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={picked.includes(r.entity_name)} disabled={!picked.includes(r.entity_name) && picked.length >= maxComp}
                          onChange={(e) => setPicked((p) => e.target.checked ? [...p, r.entity_name] : p.filter((x) => x !== r.entity_name))} />
                        <Bell className="size-3" /> {L.watch}
                      </label>
                    )}
                  </div>
                  {r.reason && <p className="mt-1 text-xs text-foreground/80"><b>{L.why}</b> {r.reason}</p>}
                  {r.sources?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      {r.sources.slice(0, 4).map((s: string) => (
                        <a key={s} href={s} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                          <ExternalLink className="size-3" /> {(() => { try { return new URL(s).hostname; } catch { return s; } })()}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {result.filtered?.length > 0 && <p className="text-[11px] text-muted-foreground">{L.filtered}: {result.filtered.map((f: any) => f.name).join("، ")}</p>}
          {canWatch && picked.length > 0 && (
            <div className="sticky bottom-2 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-card p-3 text-xs shadow-lg">
              <span>{L.watchCost}{policy?.cost_tokens ? ` (${policy.cost_tokens})` : ""}</span>
              {watchesLeft !== null && <span className="text-muted-foreground">{L.left}: {watchesLeft}</span>}
              <button onClick={() => sendHandoff("compare", [result.brand, ...picked].join("\n"))} className="rounded-lg border border-primary px-3 py-2 font-semibold text-primary">{L.toCompare}</button>
              <button onClick={startWatch} disabled={watchesLeft === 0} className="ms-auto inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50">
                <Bell className="size-4" /> {L.startWatch} ({picked.length})
              </button>
            </div>
          )}
        </>
      )}
      <ToolHistory toolKey="known" />
    </div>
  );
}
