import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { ENGINE_LIST } from "@/lib/ai-engines";
import { MAAROOF_SKILLS, recommendMaaroofSkills, toolsForSkills, type MaaroofSkill } from "@/lib/maaroof/skill-catalog";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { getCostPreview, type CostPreview } from "@/lib/tokens.functions";
import {
  ArrowUp, BrainCircuit, Check, ChevronDown, CircleAlert, Clock3, FileText,
  LoaderCircle, Plus, Search, Sparkles, Square, Target, TrendingUp,
  Wrench, X,
} from "lucide-react";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "مساحة العمل الذكية · MAAROOF AI" },
      { name: "description", content: "أنجز مهام البحث والتحليل والتخطيط مع معروف، من هدف واضح إلى نتائج قابلة للمراجعة." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => <I18nProvider><AuthProvider><WorkspacePage /></AuthProvider></I18nProvider>,
});

type WorkspaceEvent = { type: string; data: any; at: number };
type SkillLocale = "ar" | "en" | "ku";

const COPY = {
  ar: {
    eyebrow: "مساحة العمل الذكية", title: "ما الذي تريد إنجازه؟",
    subtitle: "اشرح هدفك بلغتك. سيختار معروف طريقة العمل المناسبة، ويمكنك توجيهه بالمهارات والنماذج.",
    placeholder: "مثال: حلّل السوق العراقي واكتشف فرص النمو لعلامتي التجارية…",
    suggested: "مهارات قد تساعدك", selected: "المهارات المختارة", add: "إضافة", added: "مضافة",
    automatic: "دع معروف يختار المهارات المناسبة تلقائياً", skillsHint: "التوصيات الأولية مبنية على كلمات الطلب؛ الاختيار النهائي والتحقق من الأدوات يتمان في الخادم.",
    models: "النماذج", modelsHint: "اختياري — يمكنك طلب فحص مباشر للنماذج. قد يستهلك ذلك رصيداً إضافياً وفق خطتك.",
    liveProbe: "تشغيل فحص مباشر للنماذج المختارة", all: "تحديد الكل", clear: "مسح التحديد",
    run: "ابدأ المهمة", stop: "إيقاف", working: "معروف يعمل على المهمة", mode: "طريقة العمل", execute: "تنفيذ فعلي", recommendMode: "خطة وتوصية", simulate: "محاكاة", costEstimate: "تقدير الكلفة قبل البدء", balance: "الرصيد الحالي", tokens: "توكن", probeCost: "كلفة الفحص المباشر", toolCostNote: "تُضاف كلفة الأدوات التي تُنفّذ فعلياً. قد يقل عدد المحركات الفعلي عن المحدد وفق خطتك وسياسة الإدارة.",
    plan: "خطة العمل", progress: "تقدم التنفيذ", result: "النتيجة", activity: "سجل العمل",
    ready: "جاهز", failed: "تعذر إكمال المهمة", empty: "اكتب هدفاً أو اختر مهارة للبدء.",
    selectedTools: "أدوات مرتبطة بالمهارات المختارة", noTools: "لم تختر مهارات؛ سيحدد معروف الأدوات وفق الهدف.",
    noResults: "ستظهر النتيجة هنا بعد بدء المهمة.", home: "الرئيسية", professional: "واجهة المحترفين",
    ask: "تأكد من أن الطلب واضح قبل بدء التنفيذ. تخضع الأدوات والتكلفة والصلاحيات لسياسات النظام.",
    phase: "مرحلة", toolStarted: "بدأت أداة", toolDone: "نتيجة أداة", final: "اكتملت المهمة",
    clarify: "يحتاج معروف إلى معلومة إضافية", sendAnswer: "إرسال الإجابة", answerPlaceholder: "اكتب إجابتك…",
    runAgain: "مهمة جديدة", unknown: "حدث تحديث في المهمة", modelCount: "نموذج محدد",
  },
  en: {
    eyebrow: "Intelligent workspace", title: "What would you like to accomplish?",
    subtitle: "Describe your goal. Maaroof will plan the work, while you can guide it with skills and models.",
    placeholder: "Example: Analyze the Iraqi market and find growth opportunities for my brand…",
    suggested: "Skills that may help", selected: "Selected skills", add: "Add", added: "Added",
    automatic: "Let Maaroof choose suitable skills automatically", skillsHint: "Initial suggestions use goal keywords; final tool selection and authorization remain server-side.",
    models: "Models", modelsHint: "Optional — live model checks may consume additional balance according to your plan.",
    liveProbe: "Run a live check with selected models", all: "Select all", clear: "Clear selection",
    run: "Start task", stop: "Stop", working: "Maaroof is working", mode: "Work mode", execute: "Execute", recommendMode: "Plan & recommend", simulate: "Simulate", costEstimate: "Estimated cost before starting", balance: "Current balance", tokens: "tokens", probeCost: "Live-check cost", toolCostNote: "Successful tool executions are charged separately. Plan and admin limits may reduce the actual number of engines checked.",
    plan: "Work plan", progress: "Execution progress", result: "Result", activity: "Activity",
    ready: "Ready", failed: "The task could not be completed", empty: "Enter a goal or choose a skill to begin.",
    selectedTools: "Tools associated with selected skills", noTools: "No skills selected; Maaroof will choose tools from the goal.",
    noResults: "Your result will appear here after you start.", home: "Home", professional: "Professional interface",
    ask: "Review your goal before execution. Tool access, cost, and permissions are enforced by the system.",
    phase: "Phase", toolStarted: "Tool started", toolDone: "Tool result", final: "Task completed",
    clarify: "Maaroof needs one more detail", sendAnswer: "Send answer", answerPlaceholder: "Type your answer…",
    runAgain: "New task", unknown: "Task updated", modelCount: "model selected",
  },
  ku: {
    eyebrow: "شوێنی کاری زیرەک", title: "دەتەوێت چی ئەنجام بدەیت؟",
    subtitle: "ئامانجەکەت ڕوون بکەرەوە؛ معروف ڕێگای گونجاو پێشنیار دەکات و تۆ دەتوانیت ئاراستەی بکەیت.",
    placeholder: "نموونە: بازاڕی عێراق شیکار بکە و دەرفەتی گەشە بدۆزەرەوە…",
    suggested: "شارەزاییە پێشنیارکراوەکان", selected: "شارەزاییە هەڵبژێردراوەکان", add: "زیادکردن", added: "زیادکرا",
    automatic: "با معروف بە شێوەی خۆکار شارەزاییەکان هەڵبژێرێت", skillsHint: "پێشنیارە سەرەتاییەکان بە وشەکانی ئامانجەکە دەستنیشان دەکرێن.",
    models: "مۆدێلەکان", modelsHint: "هەڵبژاردەیی — پشکنینی ڕاستەوخۆ ڕەنگە باڵانسی زیاتر بەکاربهێنێت.",
    liveProbe: "پشکنینی ڕاستەوخۆی مۆدێلە هەڵبژێردراوەکان", all: "هەمووی هەڵبژێرە", clear: "پاککردنەوە",
    run: "دەستپێکردن", stop: "وەستاندن", working: "معروف لەسەر ئەرکەکە کار دەکات", mode: "شێوازی کار", execute: "جێبەجێکردن", recommendMode: "پلان و پێشنیار", simulate: "هاوشێوەکردن", costEstimate: "خەمڵاندنی تێچوو پێش دەستپێکردن", balance: "باڵانسی ئێستا", tokens: "تۆکن", probeCost: "تێچووی پشکنینی ڕاستەوخۆ", toolCostNote: "تێچووی ئامرازە جێبەجێکراوەکان بە جیا دەبڕدرێت؛ سنووری پلان و ئەدمین ڕەنگە ژمارەی مۆدێلەکان کەم بکاتەوە.",
    plan: "پلانی کار", progress: "پێشکەوتن", result: "ئەنجام", activity: "تۆماری کار",
    ready: "ئامادەیە", failed: "ئەرکەکە تەواو نەبوو", empty: "ئامانج بنووسە یان شارەزاییەک هەڵبژێرە.",
    selectedTools: "ئامرازە پەیوەندیدارەکان", noTools: "هیچ شارەزاییەک هەڵنەبژێردرا؛ معروف ئامرازەکان هەڵدەبژێرێت.",
    noResults: "دوای دەستپێکردنی ئەرکەکە ئەنجامەکە لێرە دەردەکەوێت.", home: "سەرەتا", professional: "ڕووکار بۆ پسپۆڕان",
    ask: "پێش دەستپێکردن ئامانجەکە بپشکنە؛ دەسەڵات و تێچوو لەلایەن سیستەمەوە کۆنترۆڵ دەکرێن.",
    phase: "قۆناغ", toolStarted: "ئامراز دەستی پێکرد", toolDone: "ئەنجامی ئامراز", final: "ئەرکەکە تەواو بوو",
    clarify: "معروف پێویستی بە زانیاری زیاترە", sendAnswer: "ناردنی وەڵام", answerPlaceholder: "وەڵام بنووسە…",
    runAgain: "ئەرکی نوێ", unknown: "ئەرکەکە نوێ کرایەوە", modelCount: "مۆدێل هەڵبژێردرا",
  },
} as const;

const SKILL_ICONS = {
  search: Search, chart: TrendingUp, target: Target, sparkles: Sparkles, trending: TrendingUp, compass: BrainCircuit,
};

function WorkspacePage() {
  const { user, loading, session } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const locale: SkillLocale = lang === "en" || lang === "ku" ? lang : "ar";
  const c = COPY[locale];
  const [goal, setGoal] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [liveProbe, setLiveProbe] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(ENGINE_LIST.map((engine) => engine.key));
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [clarification, setClarification] = useState("");
  const [clarifyField, setClarifyField] = useState("");
  const [error, setError] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [mode, setMode] = useState<"execution" | "recommendation" | "simulation">("execution");
  const [costRun, setCostRun] = useState<CostPreview | null>(null);
  const [costProbe, setCostProbe] = useState<CostPreview | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [policy, setPolicy] = useState<{ enabled: boolean; show_professional_link: boolean; allowed_modes: Array<"execution" | "recommendation" | "simulation">; show_live_engine_picker: boolean; enabled_skills: string[] }>({ enabled: true, show_professional_link: true, allowed_modes: ["execution", "recommendation", "simulation"], show_live_engine_picker: true, enabled_skills: MAAROOF_SKILLS.map(skill => skill.key) });
  const abortRef = useState<{ current: AbortController | null }>({ current: null })[0];

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/workspace" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    let active = true;
    supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle().then(({ data }) => {
      if (!active || !data?.value || typeof data.value !== "object") return;
      const value = data.value as any;
      setPolicy(old => ({ ...old, ...value }));
      if (Array.isArray(value.enabled_skills)) setSelectedSkills(current => current.filter(key => value.enabled_skills.includes(key)));
      if (Array.isArray(value.allowed_modes) && value.allowed_modes.length) setMode(current => value.allowed_modes.includes(current) ? current : value.allowed_modes[0]);
      if (value.enabled === false) navigate({ to: "/maaroof", replace: true });
    }).catch(() => {});
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setCostLoading(true);
    const toolKey = mode === "recommendation" || mode === "simulation" ? `maaroof.${mode}` : "maaroof";
    Promise.all([
      getCostPreview({ data: { toolKey } }),
      liveProbe && selectedModels.length > 0
        ? getCostPreview({ data: { toolKey: "visibility.probe", units: selectedModels.length } })
        : Promise.resolve(null),
    ]).then(([runPreview, probePreview]) => {
      if (!active) return;
      setCostRun(runPreview);
      setCostProbe(probePreview);
    }).catch(() => {
      if (!active) return;
      setCostRun(null);
      setCostProbe(null);
    }).finally(() => { if (active) setCostLoading(false); });
    return () => { active = false; };
  }, [user?.id, mode, liveProbe, selectedModels.length]);

  const recommendations = useMemo(() => {
    const enabled = MAAROOF_SKILLS.filter(skill => policy.enabled_skills.includes(skill.key));
    const matched = recommendMaaroofSkills(goal, MAAROOF_SKILLS.length).filter(skill => policy.enabled_skills.includes(skill.key));
    return (matched.length ? matched : enabled).slice(0, 3);
  }, [goal, policy.enabled_skills]);
  const tools = useMemo(() => toolsForSkills(selectedSkills), [selectedSkills]);
  const finalEvent = [...events].reverse().find((event) => event.type === "final");
  const phaseEvents = events.filter((event) => event.type === "phase");
  const toolEvents = events.filter((event) => event.type === "tool_call" || event.type === "tool_result");
  const clarifyEvents = events.filter((event) => event.type === "clarify");
  const toolCatalog = [...events].reverse().find((event) => event.type === "tool_catalog")?.data;

  function toggleSkill(key: string) {
    setSelectedSkills((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function parseEventStreamChunk(buffer: string) {
    const blocks = buffer.split("\n\n");
    const remaining = blocks.pop() || "";
    for (const block of blocks) {
      let eventType = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        setEvents((current) => [...current, { type: eventType, data: parsed, at: Date.now() }]);
        if (eventType === "clarify") {
          setClarifyField(String(parsed?.field || ""));
          setClarification("");
        }
        if (eventType === "error") setError(String(parsed?.message || c.failed));
      } catch {
        // Ignore malformed SSE frames; a valid frame must never crash the workspace.
      }
    }
    return remaining;
  }

  async function start(clarifications?: Record<string, string>) {
    if (!goal.trim() || running || !user || !policy.allowed_modes.includes(mode)) return;
    if (liveProbe && selectedModels.length === 0) {
      setError(locale === "en" ? "Select at least one model or turn off live checking." : locale === "ku" ? "مۆدێلێک هەڵبژێرە یان پشکنینی ڕاستەوخۆ ناچالاک بکە." : "اختر نموذجاً واحداً على الأقل أو أوقف الفحص المباشر.");
      return;
    }
    setRunning(true);
    setError("");
    setEvents([]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("auth_required");
      const response = await fetch("/api/maaroof", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          goal: goal.trim(),
          lang: locale,
          execution_mode: mode,
          live_probe: liveProbe,
          use_subagents: true,
          probe_engines: liveProbe ? selectedModels : undefined,
          clarifications: {
            ...(tools.length ? { tools: tools.join(",") } : {}),
            ...(clarifications || {}),
          },
          interface_mode: "workspace",
          selected_skills: selectedSkills,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        const message = body?.message?.[locale] || body?.message?.ar || body?.error || c.failed;
        throw new Error(String(message));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseEventStreamChunk(buffer);
      }
      if (buffer.trim()) parseEventStreamChunk(buffer + "\n\n");
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(String(e?.message || c.failed));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function toolLabel(key: string) {
    const tool = TOOL_CATALOG.find((item) => item.key === key);
    return tool?.labels[locale] || tool?.labels.ar || key;
  }

  function eventSummary(event: WorkspaceEvent): string {
    const d = event.data || {};
    if (event.type === "phase") return String(d.phase || c.unknown);
    if (event.type === "tool_call") return String(d.reason || toolLabel(d.tool || ""));
    if (event.type === "tool_result") {
      const output = d.output;
      if (typeof output === "string") return output.slice(0, 500);
      if (output && typeof output === "object") {
        const candidate = output.summary || output.answer || output.text || output.message;
        if (typeof candidate === "string") return candidate.slice(0, 500);
      }
      return d.ok ? c.toolDone : c.failed;
    }
    if (event.type === "error") return String(d.message || c.failed);
    if (event.type === "clarify") return String(d.question || c.clarify);
    return String(d.text || d.message || d.phase || c.unknown);
  }

  if (loading || !user) return <AuthGate state={loading ? "loading" : "signed-out"} title={c.eyebrow} redirect="/workspace" />;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <header className="mb-7 flex flex-wrap items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <BrainCircuit className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{c.eyebrow}</p>
            <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">{c.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{c.subtitle}</p>
          </div>
          {policy.show_professional_link && <Link to="/maaroof" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"><Wrench className="size-4" />{c.professional}</Link>}
        </header>

        {!finalEvent && events.length === 0 && (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
                <label htmlFor="workspace-goal" className="mb-2 block text-sm font-semibold">{locale === "en" ? "Your goal" : locale === "ku" ? "ئامانجەکەت" : "هدفك"}</label>
                <textarea id="workspace-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={c.placeholder} disabled={running} rows={5} className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xl text-xs text-muted-foreground">{c.ask}</p>
                  <button type="button" onClick={() => void start()} disabled={!goal.trim() || running || costLoading || !policy.allowed_modes.includes(mode) || (!!costRun && !costRun.enough)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    {running ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}{c.run}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{c.suggested}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{c.skillsHint}</p>
                  </div>
                  <Sparkles className="size-5 text-primary" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {recommendations.map((skill) => <SkillCard key={skill.key} skill={skill} locale={locale} selected={selectedSkills.includes(skill.key)} onToggle={() => toggleSkill(skill.key)} labelAdd={c.add} labelAdded={c.added} />)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedSkills.map((key) => {
                    const skill = MAAROOF_SKILLS.find((item) => item.key === key);
                    return skill ? <button key={key} type="button" onClick={() => toggleSkill(key)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary">{skill.label[locale]} <X className="size-3" /></button> : null;
                  })}
                  {selectedSkills.length === 0 && <p className="text-xs text-muted-foreground">{c.automatic}</p>}
                </div>
                {tools.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{c.selectedTools}: {tools.map(toolLabel).join("، ")}</p>}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <h2 className="mb-3 font-semibold">{c.mode}</h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([{ key: "execution", label: c.execute }, { key: "recommendation", label: c.recommendMode }, { key: "simulation", label: c.simulate }] as const).filter(item => policy.allowed_modes.includes(item.key)).map(item => (
                    <button key={item.key} type="button" onClick={() => setMode(item.key)} className={`rounded-xl border px-3 py-2 text-sm transition ${mode === item.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40"}`}>{item.label}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <h2 className="font-semibold">{c.costEstimate}</h2>
                {costLoading ? <p className="mt-2 text-xs text-muted-foreground">{locale === "en" ? "Calculating…" : locale === "ku" ? "خەمڵاندن…" : "جارێک خەمڵاندن…"}</p> : costRun ? <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{c.mode}</span><span className="font-semibold tabular-nums">{costRun.total} {c.tokens}</span></div>
                  {costProbe && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{c.probeCost} ({costProbe.units})</span><span className="font-semibold tabular-nums">{costProbe.total} {c.tokens}</span></div>}
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-2"><span className="font-medium">{c.balance}</span><span className="tabular-nums">{costRun.balance} {c.tokens}</span></div>
                  {costRun.metered && costRun.balance < costRun.total + (costProbe?.total || 0) && <p role="alert" className="text-xs text-destructive">{locale === "en" ? "Your balance may not cover the session and live check." : locale === "ku" ? "لەوانەیە باڵانس بۆ دانیشتن و پشکنین بەس نەبێت." : "قد لا يكفي رصيدك للجلسة والفحص المباشر معاً."}</p>}
                  <p className="text-xs leading-5 text-muted-foreground">{c.toolCostNote}</p>
                </div> : <p className="mt-2 text-xs text-muted-foreground">{c.ask}</p>}
              </div>

              {policy.show_live_engine_picker && <div className="rounded-2xl border border-border bg-card">
                <button type="button" onClick={() => setModelsOpen((open) => !open)} className="flex w-full items-center gap-3 p-4 text-start">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted"><BrainCircuit className="size-5" /></div>
                  <div className="flex-1">
                    <h2 className="font-semibold">{c.models}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{c.modelsHint}</p>
                  </div>
                  <ChevronDown className={`size-4 transition-transform ${modelsOpen ? "rotate-180" : ""}`} />
                </button>
                {modelsOpen && <div className="border-t border-border p-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={liveProbe} onChange={(event) => setLiveProbe(event.target.checked)} className="mt-1 accent-primary" />
                    <span>{c.liveProbe}</span>
                  </label>
                  <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${liveProbe ? "" : "opacity-70"}`}>
                    {ENGINE_LIST.map((engine) => (
                      <label key={engine.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted/40">
                        <input type="checkbox" checked={selectedModels.includes(engine.key)} disabled={!liveProbe} onChange={(event) => setSelectedModels((current) => event.target.checked ? [...current, engine.key] : current.filter((key) => key !== engine.key))} />
                        <span className="flex-1">{engine.name}</span>
                        {selectedModels.includes(engine.key) && <Check className="size-4 text-primary" />}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setSelectedModels(ENGINE_LIST.map((engine) => engine.key))} disabled={!liveProbe} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40">{c.all}</button>
                    <button type="button" onClick={() => setSelectedModels([])} disabled={!liveProbe} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40">{c.clear}</button>
                    <span className="ms-auto self-center text-xs text-muted-foreground">{selectedModels.length} {c.modelCount}</span>
                  </div>
                </div>}
              </div>}
            </div>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <h2 className="font-semibold">{locale === "en" ? "How Maaroof works" : locale === "ku" ? "چۆنیەتی کارکردنی معروف" : "كيف يعمل معروف؟"}</h2>
                <ol className="mt-3 space-y-3 text-sm">
                  {[
                    locale === "en" ? "Understand your goal" : locale === "ku" ? "تێگەیشتن لە ئامانج" : "فهم الهدف",
                    locale === "en" ? "Plan the required steps" : locale === "ku" ? "پلانکردنی هەنگاوەکان" : "تخطيط الخطوات",
                    locale === "en" ? "Run tools and verify results" : locale === "ku" ? "جێبەجێکردن و پشتڕاستکردنەوە" : "تنفيذ الأدوات والتحقق",
                    locale === "en" ? "Present findings and next steps" : locale === "ku" ? "پێشکەشکردنی ئەنجام و هەنگاوی داهاتوو" : "عرض النتائج والخطوة التالية",
                  ].map((label, index) => <li key={label} className="flex items-start gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{index + 1}</span><span>{label}</span></li>)}
                </ol>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 font-semibold"><Target className="size-4 text-primary" />{locale === "en" ? "You stay in control" : locale === "ku" ? "کۆنترۆڵ لە دەست تۆدایە" : "القرار يبقى بيدك"}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{locale === "en" ? "Skills guide the plan; server-side policies still decide what can actually run." : locale === "ku" ? "شارەزاییەکان پلان ئاراستە دەکەن، بەڵام سیاسەتی سێرڤەر دەسەڵاتی جێبەجێکردن دیاری دەکات." : "المهارات توجه الخطة؛ سياسات الخادم تحدد ما يمكن تنفيذه فعلياً."}</p>
              </div>
            </aside>
          </section>
        )}

        {(running || events.length > 0 || error) && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${running ? "animate-pulse bg-primary" : error ? "bg-destructive" : "bg-emerald-500"}`} /><span className="font-semibold">{running ? c.working : error ? c.failed : c.ready}</span></div>
              {running && <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-xs text-destructive"><Square className="size-3" />{c.stop}</button>}
              {!running && <button type="button" onClick={() => { setEvents([]); setError(""); setGoal(""); setSelectedSkills([]); }} className="rounded-lg border px-3 py-2 text-xs">{c.runAgain}</button>}
            </div>

            {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}

            {finalEvent && <div className="rounded-2xl border border-primary/25 bg-card p-5 md:p-6">
              <div className="mb-3 flex items-center gap-2 text-primary"><FileText className="size-5" /><h2 className="font-semibold">{c.result}</h2></div>
              <div className="whitespace-pre-wrap text-sm leading-7">{String(finalEvent.data?.text || finalEvent.data?.message || c.noResults)}</div>
            </div>}

            {!finalEvent && !running && !error && <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{c.noResults}</div>}

            {clarifyEvents.length > 0 && !running && (
              <form className="rounded-2xl border border-primary/30 bg-card p-4" onSubmit={(event) => { event.preventDefault(); if (clarifyField && clarification.trim()) void start({ [clarifyField]: clarification.trim() }); }}>
                <label className="mb-2 block font-semibold">{c.clarify}</label>
                <input value={clarification} onChange={(event) => setClarification(event.target.value)} placeholder={c.answerPlaceholder} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <button type="submit" disabled={!clarification.trim()} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{c.sendAnswer}</button>
              </form>
            )}

            <div className="rounded-2xl border border-border bg-card p-4">
              <button type="button" onClick={() => setShowActivity((show) => !show)} className="flex w-full items-center justify-between gap-2 text-start font-semibold">
                <span className="flex items-center gap-2"><Clock3 className="size-4" />{c.activity} ({phaseEvents.length + toolEvents.length})</span>
                <ChevronDown className={`size-4 transition-transform ${showActivity ? "rotate-180" : ""}`} />
              </button>
              {showActivity && <div className="mt-4 space-y-2">
                {events.filter((event) => ["phase", "tool_call", "tool_result", "error", "clarify", "done"].includes(event.type)).map((event, index) => (
                  <div key={`${event.at}-${index}`} className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${event.type === "error" || event.data?.ok === false ? "bg-destructive" : event.type === "tool_result" ? "bg-emerald-500" : "bg-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">{event.type === "phase" ? c.phase : event.type === "tool_call" ? c.toolStarted : event.type === "tool_result" ? c.toolDone : event.type === "clarify" ? c.clarify : event.type === "error" ? c.failed : c.unknown}{event.data?.tool ? ` · ${toolLabel(event.data.tool)}` : ""}</div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{eventSummary(event)}</div>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function SkillCard({ skill, locale, selected, onToggle, labelAdd, labelAdded }: {
  skill: MaaroofSkill; locale: SkillLocale; selected: boolean; onToggle: () => void; labelAdd: string; labelAdded: string;
}) {
  const Icon = SKILL_ICONS[skill.icon];
  return (
    <button type="button" onClick={onToggle} aria-pressed={selected} className={`group flex h-full items-start gap-3 rounded-xl border p-4 text-start transition ${selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{skill.label[locale]}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{skill.description[locale]}</span>
        <span className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}>{selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}{selected ? labelAdded : labelAdd}</span>
      </span>
    </button>
  );
}
