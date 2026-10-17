import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthGate } from "@/components/AuthGate";
import { MAAROOF_SKILLS, recommendMaaroofSkills, toolsForSkills } from "@/lib/maaroof/skill-catalog";
import { ENGINE_KEYS } from "@/lib/ai-engines";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, BarChart3, Check, Compass, FileSearch, LoaderCircle, Search, Sparkles, Target, TrendingUp, X, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/workbench")({
  head: () => ({ meta: [
    { title: "مساحة العمل الذكية — MAAROOF Ai" },
    { name: "description", content: "حوّل هدفك إلى عمل منظم باستخدام مهارات معروف وأدواته الحالية." },
    { name: "robots", content: "noindex,follow" },
  ] }),
  component: () => <I18nProvider><AuthProvider><WorkbenchPage /></AuthProvider></I18nProvider>,
});

type RunEvent = { type: string; data: any; at: number };
const ICONS = { search: Search, chart: BarChart3, target: Target, sparkles: Sparkles, trending: TrendingUp, compass: Compass } as const;
const COPY = {
  ar: {
    eyebrow: "مساحة العمل الذكية", title: "ما الذي تريد إنجازه؟", subtitle: "صف النتيجة التي تريد الوصول إليها. يساعدك معروف في اختيار المهارات والأدوات المناسبة، ثم يعرض ما حدث بوضوح.",
    placeholder: "مثال: حلّل السوق العراقي واكتشف فرص النمو لعلامتي خلال 3 أشهر…", skills: "مهارات مقترحة", choose: "اختر المهارات التي تريد استخدامها", suggestions: "اقتراحات حسب هدفك", modes: "طريقة العمل", execute: "تنفيذ فعلي", recommend: "خطة وتوصية", simulate: "محاكاة", scope: "نطاق العمل", auto: "تلقائي", world: "عالمي", engines: "فحص مباشر عبر محركات الذكاء", enginesHint: "اختياري، وقد يستهلك رصيداً إضافياً. عدد المحركات المتاح تحدده خطتك وإعدادات الإدارة.", live: "تضمين الفحص المباشر", run: "ابدأ العمل", running: "معروف يعمل على طلبك…", cancel: "إيقاف العرض", steps: "سير العمل", result: "النتيجة", noResult: "سيظهر هنا ما ينجزه معروف أثناء العمل.", signTitle: "سجّل الدخول للمتابعة", signDesc: "تحتاج مساحة العمل إلى حسابك لحفظ جلساتك واستخدام صلاحياتك ورصيدك.", professional: "واجهة المحترفين", history: "جلساتك السابقة", empty: "اكتب هدفاً واضحاً للبدء.", selected: "مهارة مختارة", selectedPlural: "مهارات مختارة", error: "تعذر إكمال الطلب.", planning: "فهم الطلب والتخطيط", tool_call: "تنفيذ خطوة", tool_result: "نتيجة خطوة", council: "مراجعة الخبراء", reflection: "مراجعة النتيجة", final: "النتيجة النهائية", done: "اكتمل العمل", phase: "مرحلة العمل", clarify: "يحتاج معروف إلى توضيح", cost: "الكلفة لا تُقدّر هنا قبل أن يخطط معروف؛ تُطبّق أسعار الأدوات وصلاحيات حسابك الحالية.", sources: "المصادر والنتائج تبقى مرتبطة بما نفذه النظام فعلياً؛ لا تُعرض الخطوات المقترحة كأنها نُفذت.", home: "العودة للرئيسية"
  },
  en: {
    eyebrow: "Intelligent workbench", title: "What do you want to accomplish?", subtitle: "Describe the outcome you need. Maaroof helps select relevant skills and existing tools, then shows what actually happened.",
    placeholder: "Example: Analyze the Iraqi market and find growth opportunities for my brand over 3 months…", skills: "Suggested skills", choose: "Choose the skills you want to use", suggestions: "Suggestions based on your goal", modes: "Work mode", execute: "Execute", recommend: "Plan & recommend", simulate: "Simulate", scope: "Scope", auto: "Automatic", world: "Global", engines: "Live AI engine check", enginesHint: "Optional and may use additional balance. Available engines depend on your plan and admin policy.", live: "Include live check", run: "Start work", running: "Maaroof is working on your request…", cancel: "Stop waiting", steps: "Workflow", result: "Result", noResult: "Your work and results will appear here.", signTitle: "Sign in to continue", signDesc: "Your workbench uses your account to save sessions and enforce your current permissions and balance.", professional: "Professional interface", history: "Your previous sessions", empty: "Describe a clear goal to get started.", selected: "skill selected", selectedPlural: "skills selected", error: "The request could not be completed.", planning: "Understanding and planning", tool_call: "Executing step", tool_result: "Step result", council: "Expert review", reflection: "Reviewing outcome", final: "Final result", done: "Work completed", phase: "Work phase", clarify: "Maaroof needs clarification", cost: "Cost is not estimated here before Maaroof plans. Existing tool prices and account permissions remain authoritative.", sources: "Sources and results reflect actual execution. Proposed steps are not presented as completed work.", home: "Back to home"
  },
  ku: {
    eyebrow: "شوێنی کاری زیرەک", title: "دەتەوێت چی ئەنجام بدەیت؟", subtitle: "ئەنجامەکە ڕوون بکەرەوە. مەعروف یارمەتیت دەدات تواناکانی گونجاو هەڵبژێرێت و ئەوەی بەڕاستی کراوە پیشان بدات.",
    placeholder: "نموونە: بازاڕی عێراق شیکاری بکە و دەرفەتی گەشە بۆ براندەکەم بدۆزەرەوە…", skills: "تواناکانی پێشنیارکراو", choose: "تواناکانی دڵخواز هەڵبژێرە", suggestions: "پێشنیار بەپێی ئامانج", modes: "شێوازی کار", execute: "جێبەجێکردن", recommend: "پلان و پێشنیار", simulate: "هاوشێوەکردن", scope: "مەودا", auto: "خۆکار", world: "جیهانی", engines: "پشکنینی ڕاستەوخۆی مۆدێلەکان", enginesHint: "ئارەزوومەندانەیە و لەوانەیە باڵانسی زیاتر بەکاربهێنێت.", live: "پشکنینی ڕاستەوخۆ زیاد بکە", run: "دەستپێکردن", running: "مەعروف لەسەر داواکارییەکەت کار دەکات…", cancel: "وەستاندن", steps: "ڕەوتی کار", result: "ئەنجام", noResult: "ئەنجامەکان لێرە دەردەکەون.", signTitle: "بچۆ ژوورەوە", signDesc: "بۆ پاشەکەوتکردنی دانیشتن و جێبەجێکردنی مۆڵەتەکانت.", professional: "ڕووکاری پسپۆڕان", history: "دانیشتنەکانی پێشوو", empty: "ئامانجێکی ڕوون بنووسە.", selected: "توانا هەڵبژێردرا", selectedPlural: "توانا هەڵبژێردرا", error: "داواکارییەکە تەواو نەبوو.", planning: "تێگەیشتن و پلان", tool_call: "جێبەجێکردنی هەنگاو", tool_result: "ئەنجامی هەنگاو", council: "پێداچوونەوەی پسپۆڕان", reflection: "پێداچوونەوەی ئەنجام", final: "ئەنجامی کۆتایی", done: "کار تەواو بوو", phase: "قۆناغی کار", clarify: "مەعروف ڕوونکردنەوە دەوێت", cost: "تێچوو دوای پلانکردنی مەعروف دیاری دەکرێت.", sources: "ئەنجامەکان تەنیا ئەوە پیشان دەدەن کە بەڕاستی جێبەجێ کراوە.", home: "گەڕانەوە"
  }
} as const;

function WorkbenchPage() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const language = (lang === "en" || lang === "ku" ? lang : "ar") as keyof typeof COPY;
  const t = COPY[language];
  const [goal, setGoal] = useState("");
  const [chosenSkills, setChosenSkills] = useState<string[]>([]);
  const [mode, setMode] = useState<"execution" | "recommendation" | "simulation">("execution");
  const [world, setWorld] = useState(false);
  const [live, setLive] = useState(false);
  const [engines, setEngines] = useState<string[]>([...ENGINE_KEYS]);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const suggestions = useMemo(() => recommendMaaroofSkills(goal, 3), [goal]);
  const skillLabels = (skill: typeof MAAROOF_SKILLS[number]) => skill.label[language];
  const toolKeys = toolsForSkills(chosenSkills.length ? chosenSkills : suggestions.map(s => s.key));
  const final = [...events].reverse().find(e => e.type === "final")?.data?.text;
  const safeText = (value: unknown) => typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);

  async function run() {
    if (!goal.trim() || running || !user) return;
    setError(""); setEvents([]); setRunning(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setRunning(false); setError(t.error); return; }
    const ctl = new AbortController(); abortRef.current = ctl;
    try {
      const response = await fetch("/api/maaroof", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          goal: goal.trim(), lang: language, execution_mode: mode,
          live_probe: live,
          probe_engines: live ? engines : undefined,
          auto_select_probe_engines: false,
          clarifications: { tools: toolKeys.join(",") },
          geo_scope: world ? { mode: "world" } : { mode: "auto" }
        }),
        signal: ctl.signal
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.message?.[language] || payload?.message?.ar || payload?.error || t.error);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n"); buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          let type = "message"; let data = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event: ")) type = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          try { setEvents(prev => [...prev, { type, data: JSON.parse(data), at: Date.now() }]); } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || t.error);
    } finally { setRunning(false); abortRef.current = null; }
  }

  if (loading || !user) return <AuthGate state={loading ? "loading" : "signed-out"} title={t.signTitle} redirect="/workbench" />;

  return (
    <div className="min-h-screen" dir={language === "en" ? "ltr" : "rtl"}>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-7 md:px-6 md:py-10">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"><Sparkles className="size-3.5" />{t.eyebrow}</div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{t.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">{t.subtitle}</p>
          </div>
          <Link to="/maaroof" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-primary/50"><ShieldCheck className="size-4" />{t.professional}<ArrowRight className="size-4" /></Link>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
              <label htmlFor="work-goal" className="mb-3 block text-sm font-semibold">{t.title}</label>
              <textarea id="work-goal" value={goal} onChange={e => { setGoal(e.target.value); setChosenSkills([]); }} placeholder={t.placeholder} rows={5} maxLength={2000} disabled={running} className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{goal.length}/2000</span><span>{t.cost}</span></div>
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">{t.skills}</h2><span className="text-xs text-muted-foreground">{t.choose}</span></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MAAROOF_SKILLS.map(skill => {
                    const Icon = ICONS[skill.icon];
                    const active = (chosenSkills.length ? chosenSkills : suggestions.map(s => s.key)).includes(skill.key);
                    const recommended = suggestions.some(s => s.key === skill.key);
                    return <button key={skill.key} type="button" disabled={running} onClick={() => setChosenSkills(old => { const base = old.length ? old : suggestions.map(s => s.key); const next = base.includes(skill.key) ? base.filter(k => k !== skill.key) : [...base, skill.key]; return next; })} className={`group flex min-h-28 items-start gap-3 rounded-xl border p-3 text-start transition ${active ? "border-primary/60 bg-primary/5 shadow-sm" : "border-border bg-background/50 hover:border-primary/30"}`}>
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="size-5" /></span>
                      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">{skillLabels(skill)}{active && <Check className="size-3.5 text-primary" />}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{skill.description[language]}</span>{recommended && <span className="mt-2 inline-block text-[10px] font-medium text-primary">{t.suggestions}</span>}</span>
                    </button>;
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{chosenSkills.length || suggestions.length} {chosenSkills.length === 1 ? t.selected : t.selectedPlural}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 md:p-6">
              <h2 className="mb-3 font-semibold">{t.modes}</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {([{key:"execution",label:t.execute},{key:"recommendation",label:t.recommend},{key:"simulation",label:t.simulate}] as const).map(item => <button key={item.key} type="button" disabled={running} onClick={() => setMode(item.key)} className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${mode===item.key?"border-primary bg-primary/10 text-primary":"border-border hover:bg-muted/60"}`}>{item.label}</button>)}
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" checked={world} onChange={e=>setWorld(e.target.checked)} disabled={running} className="size-4 accent-primary" /><span><span className="block text-sm font-medium">{t.scope}</span><span className="text-xs text-muted-foreground">{world?t.world:t.auto}</span></span></label>
              <div className="mt-4 rounded-xl border border-border p-3">
                <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)} disabled={running} className="mt-1 size-4 accent-primary" /><span><span className="block text-sm font-medium">{t.engines}</span><span className="text-xs leading-5 text-muted-foreground">{t.enginesHint}</span></span></label>
                {live && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{ENGINE_KEYS.map(key=><label key={key} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-2 text-xs"><input type="checkbox" checked={engines.includes(key)} onChange={e=>setEngines(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))} disabled={running} className="accent-primary" />{key==="chatgpt"?"ChatGPT":key.charAt(0).toUpperCase()+key.slice(1)}</label>)}</div>}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-lg text-xs leading-5 text-muted-foreground">{t.sources}</p>
                <button type="button" onClick={run} disabled={running||!goal.trim()||(live&&engines.length===0)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{running?<LoaderCircle className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}{running?t.running:t.run}</button>
              </div>
              {running && <button type="button" onClick={()=>abortRef.current?.abort()} className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><X className="size-3.5"/>{t.cancel}</button>}
              {error && <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
            </div>
          </section>

          <aside className="min-w-0">
            <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4"><div><h2 className="font-semibold">{t.steps}</h2><p className="mt-1 text-xs text-muted-foreground">{running?t.running:t.result}</p></div>{running&&<LoaderCircle className="size-5 animate-spin text-primary"/>}</div>
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
                {!events.length && !error && <div className="flex min-h-56 flex-col items-center justify-center text-center"><span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-7"/></span><p className="max-w-xs text-sm leading-6 text-muted-foreground">{t.noResult}</p></div>}
                {events.map((event,i)=>{
                  const title = event.type==="phase" ? (event.data?.phase || t.phase) : event.type==="plan" ? t.planning : event.type==="tool_call" ? t.tool_call : event.type==="tool_result" ? t.tool_result : event.type==="council" ? t.council : event.type==="reflection" ? t.reflection : event.type==="final" ? t.final : event.type==="done" ? t.done : event.type==="clarify" ? t.clarify : event.type;
                  const detail = event.type==="final" ? event.data?.text : event.type==="tool_call" ? (event.data?.reason || event.data?.tool) : event.type==="tool_result" ? (event.data?.ok===false ? t.error : event.data?.tool || "") : event.type==="phase" ? (event.data?.message || event.data?.phase) : event.type==="error" ? event.data?.message : event.type==="clarify" ? event.data?.question : event.type==="done" ? "" : "";
                  return <div key={event.at+"-"+i} className="rounded-xl border border-border bg-background/70 p-3"><div className="flex items-start gap-2"><span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${event.type==="error"?"bg-destructive/10 text-destructive":"bg-primary/10 text-primary"}`}>{event.type==="error"?<X className="size-3.5"/>:<Check className="size-3.5"/>}</span><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{title}</div>{detail && <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">{safeText(detail).slice(0,5000)}</div>}{event.type==="tool_result"&&event.data?.output!=null&&<details className="mt-2"><summary className="cursor-pointer text-xs text-primary">عرض التفاصيل</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{safeText(event.data.output).slice(0,10000)}</pre></details>}</div></div></div>;
                })}
                {final && <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><h3 className="mb-2 font-semibold">{t.result}</h3><div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm leading-7 dark:prose-invert">{final}</div></div>}
              </div>
              <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground"><Link to="/" className="hover:text-primary">{t.home}</Link><span className="mx-2">·</span><Link to="/profile" className="hover:text-primary">الملف الشخصي</Link><span className="mx-2">·</span><Link to="/maaroof" className="hover:text-primary">{t.professional}</Link></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
