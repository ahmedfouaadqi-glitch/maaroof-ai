import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthGate } from "@/components/AuthGate";
import { InterviewPanel } from "@/components/workspace/InterviewPanel";
import { supabase } from "@/integrations/supabase/client";
import { ENGINE_LIST } from "@/lib/ai-engines";
import { MAAROOF_SKILLS, recommendMaaroofSkills, toolsForSkills, getSkillAccessMode, defaultSkillAccessPolicy, type MaaroofSkill } from "@/lib/maaroof/skill-catalog";
import { resolveSkillAccessPolicy, normalizePlanAccessKey } from "@/lib/maaroof/skill-access-policy";
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
  const { user, loading, session, profile } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const locale: SkillLocale = lang === "en" || lang === "ku" ? lang : "ar";
  const c = COPY[locale];
  const getInterviewAccessToken = useCallback(async () => {
    if (session?.access_token) return session.access_token;
    const result = await supabase.auth.getSession();
    return result.data.session?.access_token ?? null;
  }, [session?.access_token]);
  const [goal, setGoal] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [liveProbe, setLiveProbe] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(ENGINE_LIST.map((engine) => engine.key));
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [clarification, setClarification] = useState("");
  const [clarifyField, setClarifyField] = useState("");
  const [error, setError] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [mode, setMode] = useState<"execution" | "recommendation" | "simulation">("execution");
  const [costRun, setCostRun] = useState<CostPreview | null>(null);
  const [costProbe, setCostProbe] = useState<CostPreview | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [policy, setPolicy] = useState<{ enabled: boolean; available_interfaces: string[]; default_ui: "workbench" | "professional"; show_professional_link: boolean; allowed_modes: Array<"execution" | "recommendation" | "simulation">; show_live_engine_picker: boolean; enabled_skills: string[]; skill_access: Record<string, "self_service" | "contact" | "disabled"> }>({ enabled: true, available_interfaces: ["workbench", "professional"], default_ui: "workbench", show_professional_link: true, allowed_modes: ["execution", "recommendation", "simulation"], show_live_engine_picker: true, enabled_skills: MAAROOF_SKILLS.map(skill => skill.key), skill_access: defaultSkillAccessPolicy() });
  const watcherRef = useState<{ current: number }>({ current: 0 })[0];

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/workspace" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle(),
      user?.id ? supabase.from("profiles").select("subscription_tier,is_subscribed,subscription_expires_at").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([settingsResult, profileResult]) => {
      if (!active) return;
      const value = settingsResult.data?.value && typeof settingsResult.data.value === "object" ? settingsResult.data.value as any : {};
      const profile = profileResult.data as any;
      const activeSubscription = !!profile?.is_subscribed && (!profile.subscription_expires_at || new Date(profile.subscription_expires_at).getTime() > Date.now());
      const planKey = activeSubscription ? normalizePlanAccessKey(profile?.subscription_tier) : "";
      const effectiveSkillAccess = resolveSkillAccessPolicy({
        globalPolicy: value.skill_access && typeof value.skill_access === "object" ? value.skill_access : {},
        byPlan: value.skill_access_by_plan && typeof value.skill_access_by_plan === "object" ? value.skill_access_by_plan : {},
        byUser: value.skill_access_by_user && typeof value.skill_access_by_user === "object" ? value.skill_access_by_user : {},
        planKey,
        userId: user?.id,
      });
      const availableInterfaces = Array.isArray(value.available_interfaces) ? value.available_interfaces : value.enabled === false ? ["professional"] : ["workbench", "professional"];
      setPolicy(old => ({ ...old, ...value, skill_access: effectiveSkillAccess, available_interfaces: availableInterfaces }));
      if (!availableInterfaces.includes("workbench")) navigate({ to: availableInterfaces.includes("professional") ? "/maaroof" : "/", replace: true });
      if (Array.isArray(value.enabled_skills)) setSelectedSkills(current => current.filter(key => value.enabled_skills.includes(key) && getSkillAccessMode(MAAROOF_SKILLS.find(skill => skill.key === key)!, effectiveSkillAccess) === "self_service"));
      if (Array.isArray(value.allowed_modes) && value.allowed_modes.length) setMode(current => value.allowed_modes.includes(current) ? current : value.allowed_modes[0]);
    }).catch(() => {});
    return () => { active = false; };
  }, [navigate, user?.id]);

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
    const isSelfService = (skill: MaaroofSkill) => policy.enabled_skills.includes(skill.key) && getSkillAccessMode(skill, policy.skill_access) === "self_service";
    const enabled = MAAROOF_SKILLS.filter(isSelfService);
    const matched = recommendMaaroofSkills(goal, MAAROOF_SKILLS.length).filter(isSelfService);
    return (matched.length ? matched : enabled).slice(0, 3);
  }, [goal, policy.enabled_skills, policy.skill_access]);
  const tools = useMemo(() => toolsForSkills(selectedSkills), [selectedSkills]);
  const finalEvent = [...events].reverse().find((event) => event.type === "final");
  const phaseEvents = events.filter((event) => event.type === "phase");
  const toolEvents = events.filter((event) => event.type === "tool_call" || event.type === "tool_result");
  const clarifyEvents = events.filter((event) => event.type === "clarify");
  const toolCatalog = [...events].reverse().find((event) => event.type === "tool_catalog")?.data;
  const estimatedTotal = (costRun?.total || 0) + (liveProbe ? (costProbe?.total || 0) : 0);
  const estimateFitsQuota = !!costRun && costRun.enough && (!liveProbe || !costProbe || costProbe.enough) &&
    (!costRun.metered || (
      costRun.balance >= estimatedTotal &&
      (costRun.dailyRemaining == null || costRun.dailyRemaining >= estimatedTotal) &&
      (costRun.monthlyRemaining == null || costRun.monthlyRemaining >= estimatedTotal)
    ));

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

  async function watchJob(id: string, after: number, token: string) {
    watcherRef.current += 1;
    const watcherId = watcherRef.current;
    let cursor = after;
    while (watcherRef.current === watcherId) {
      const response = await fetch("/api/maaroof-jobs?id=" + encodeURIComponent(id) + "&after=" + cursor, {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(String(body?.error || c.failed));
      }
      const body = await response.json();
      const incoming = Array.isArray(body?.events) ? body.events : [];
      if (incoming.length) {
        const mapped = incoming.map((item: any) => ({
          type: String(item.event_type || "message"),
          data: item.payload || {},
          at: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
        } as WorkspaceEvent));
        setEvents(current => [...current, ...mapped]);
        cursor = Math.max(cursor, ...incoming.map((item: any) => Number(item.seq) || 0));
        for (const event of mapped) {
          if (event.type === "clarify") {
            setClarifyField(String(event.data?.field || ""));
            setClarification("");
          }
          if (event.type === "error") setError(String(event.data?.message || c.failed));
        }
      }
      const status = String(body?.job?.status || "running");
      if (status === "completed" || status === "failed" || status === "cancelled") {
        if (status === "failed") setError(String(body?.job?.error || c.failed));
        if (status === "cancelled") setError(locale === "en" ? "Task cancelled." : locale === "ku" ? "ئەرکەکە ڕاگیرا." : "تم إيقاف المهمة.");
        setRunning(false);
        setJobId(id);
        return;
      }
      setRunning(true);
      await new Promise(resolve => setTimeout(resolve, 1800));
    }
  }

  useEffect(() => {
    if (!user?.id || loading) return;
    let active = true;
    (async () => {
      const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!token || !active) return;
      const response = await fetch("/api/maaroof-jobs", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      if (!response.ok || !active) return;
      const body = await response.json();
      const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
      const now = Date.now();
      const recent = jobs.find((job: any) => job.status === "dispatching" || job.status === "queued" || job.status === "running")
        || jobs.find((job: any) => now - new Date(job.created_at).getTime() < 24 * 60 * 60 * 1000);
      if (!recent || !active) return;
      setJobId(String(recent.id));
      setGoal(String(recent.goal || ""));
      setMode(["execution", "recommendation", "simulation"].includes(recent.mode) ? recent.mode : "execution");
      const payload = recent.request_payload || {};
      setSelectedSkills(Array.isArray(payload.selected_skills) ? payload.selected_skills.filter((key: unknown) => typeof key === "string") : []);
      setRunning(recent.status === "dispatching" || recent.status === "queued" || recent.status === "running");
      setError(recent.status === "failed" ? String(recent.error || c.failed) : "");
      try { await watchJob(String(recent.id), 0, token); } catch (e: any) { if (active) { setRunning(false); setError(String(e?.message || c.failed)); } }
    })().catch(() => {});
    return () => { active = false; watcherRef.current += 1; };
  }, [user?.id, loading, session?.access_token]);

  async function start(clarifications?: Record<string, string>) {
    if (!goal.trim() || running || !user || !policy.allowed_modes.includes(mode)) return;
    if (liveProbe && selectedModels.length === 0) {
      setError(locale === "en" ? "Select at least one model or turn off live checking." : locale === "ku" ? "مۆدێلێک هەڵبژێرە یان پشکنینی ڕاستەوخۆ ناچالاک بکە." : "اختر نموذجاً واحداً على الأقل أو أوقف الفحص المباشر.");
      return;
    }
    setRunning(true);
    setError("");
    setEvents([]);
    setJobId(null);
    try {
      const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("auth_required");
      const response = await fetch("/api/maaroof", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
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
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.job_id) {
        const message = body?.message?.[locale] || body?.message?.ar || body?.error || c.failed;
        throw new Error(String(message));
      }
      setJobId(String(body.job_id));
      await watchJob(String(body.job_id), 0, token);
    } catch (e: any) {
      setRunning(false);
      const message = String(e?.message || c.failed);
      setError(message === "background_queue_not_configured"
        ? (locale === "en" ? "Background processing is not configured yet. Ask the administrator to provision the job queue." : locale === "ku" ? "سیستەمی کاری پشتەوە هێشتا ڕێکنەخراوە؛ پەیوەندی بە ئەدمینەوە بکە." : "لم يتم إعداد طابور المهام الخلفية بعد. يرجى إبلاغ الإدارة بإعداده.")
        : message === "background_jobs_migration_required"
          ? (locale === "en" ? "Background-job database migration is required before tasks can run." : locale === "ku" ? "پێویستە مایگرەیشنی بنکەدراوەی ئەرکەکان جێبەجێ بکرێت." : "يلزم تطبيق ترحيل قاعدة بيانات المهام الخلفية قبل التشغيل.")
          : message);
    }
  }

  async function stop() {
    const id = jobId;
    if (!id) { setRunning(false); return; }
    try {
      const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("auth_required");
      await fetch("/api/maaroof-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ job_id: id }),
      });
    } catch (e: any) {
      setError(String(e?.message || c.failed));
    }
  }

  function toolLabel(key: string) {
    const tool = TOOL_CATALOG.find((item) => item.key === key);
    return tool?.labels[locale] || tool?.labels.ar || key;
  }

  function phaseLabel(value: unknown): string {
    const key = String(value || "");
    const labels: Record<string, Record<SkillLocale, string>> = {
      envision: { ar: "التصور", en: "Envision", ku: "خەیاڵکردن" },
      planning: { ar: "التخطيط", en: "Planning", ku: "پلاندانان" },
      council: { ar: "المجلس", en: "Council", ku: "ئەنجوومەن" },
      reflection: { ar: "حل التعارض", en: "Conflict resolution", ku: "چارەسەری ناکۆکی" },
      reflect: { ar: "حل التعارض", en: "Conflict resolution", ku: "چارەسەری ناکۆکی" },
      reconciliation: { ar: "حل التعارض", en: "Conflict resolution", ku: "چارەسەری ناکۆکی" },
      recommendation: { ar: "التوصية", en: "Recommendation", ku: "پێشنیار" },
      execution: { ar: "التنفيذ", en: "Execution", ku: "جێبەجێکردن" },
    };
    return labels[key]?.[locale] || key || c.unknown;
  }

  function eventSummary(event: WorkspaceEvent): string {
    const d = event.data || {};
    if (event.type === "phase") return phaseLabel(d.phase);
    if (event.type === "tool_call") return String(d.reason || toolLabel(d.tool || ""));
    if (event.type === "tool_result") {
      const output = d.output;
      if (output && typeof output === "object" && !Array.isArray(output)) {
        const skipped = output.skipped;
        if (typeof skipped === "string") {
          const reasonLabels: Record<string, Record<SkillLocale, string>> = {
            live_probe_disabled_by_user: {
              ar: "تم التخطي بناءً على اختيار المستخدم؛ لم يُشغّل الفحص المباشر.",
              en: "Intentionally skipped by user; no live probe was run.",
              ku: "بەپێی هەڵبژاردەی بەکارهێنەر تێپەڕێندرا؛ پشکنینی ڕاستەوخۆ نەکرا.",
            },
          };
          return reasonLabels[skipped]?.[locale] || (locale === "ar" ? `تم تخطي الأداة: ${skipped}` : locale === "ku" ? `ئامرازەکە تێپەڕێندرا: ${skipped}` : `Tool intentionally skipped: ${skipped}`);
        }
        const candidate = output.summary || output.answer || output.text || output.message ||
          output.recommendation || output.strategy || output.comparison || output.result;
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 500);
        const details = [output.winner, output.conclusion, output.recommendation?.summary]
          .filter((value) => typeof value === "string" && value.trim());
        if (details.length) return details.join(" — ").slice(0, 500);
      }
      if (typeof output === "string" && output.trim()) return output.trim().slice(0, 500);
      return d.ok ? c.toolDone : c.failed;
    }
    if (event.type === "error") return String(d.message || c.failed);
    if (event.type === "clarify") return String(d.question || c.clarify);
    return String(d.text || d.message || d.phase || c.unknown);
  }

  function isIntentionalSkip(event: WorkspaceEvent): boolean {
    const output = event.data?.output;
    return event.type === "tool_result" && !!output && typeof output === "object" &&
      (typeof output.skipped === "string" || output.error === "live_probe_disabled_by_user");
  }

  if (loading || !user) return <AuthGate state={loading ? "loading" : "signed-out"} title={c.eyebrow} redirect="/workspace" />;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <header className="rb-workspace-fade mb-7 flex flex-wrap items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <BrainCircuit className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{c.eyebrow}</p>
            <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">{c.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{c.subtitle}</p>
          </div>
          {policy.show_professional_link && policy.available_interfaces.includes("professional") && <Link to="/maaroof" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"><Wrench className="size-4" />{c.professional}</Link>}
        </header>

        <InterviewPanel
          locale={locale}
          userId={user.id}
          profileEntityType={(profile as any)?.entity_type ?? null}
          profileInterviewPersona={profile?.interview_persona ?? null}
          initialGoal={goal}
          getAccessToken={getInterviewAccessToken}
        />

        {!finalEvent && events.length === 0 && (
          <section className="rb-workspace-fade rb-workspace-delay-1 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
                <label htmlFor="workspace-goal" className="mb-2 block text-sm font-semibold">{locale === "en" ? "Your goal" : locale === "ku" ? "ئامانجەکەت" : "هدفك"}</label>
                <textarea id="workspace-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={c.placeholder} disabled={running} rows={5} className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xl text-xs text-muted-foreground">{c.ask}</p>
                  <button type="button" onClick={() => void start()} disabled={!goal.trim() || running || costLoading || !policy.allowed_modes.includes(mode) || (!!costRun && !estimateFitsQuota)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
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
                  {recommendations.map((skill) => <SkillCard key={skill.key} skill={skill} accessMode={getSkillAccessMode(skill, policy.skill_access)} locale={locale} selected={selectedSkills.includes(skill.key)} onToggle={() => toggleSkill(skill.key)} labelAdd={c.add} labelAdded={c.added} />)}
                  {MAAROOF_SKILLS.filter(skill => policy.enabled_skills.includes(skill.key) && getSkillAccessMode(skill, policy.skill_access) === "contact" && recommendMaaroofSkills(goal, MAAROOF_SKILLS.length).some(match => match.key === skill.key)).map(skill => <SkillCard key={skill.key} skill={skill} accessMode={getSkillAccessMode(skill, policy.skill_access)} locale={locale} selected={false} onToggle={() => {}} labelAdd={c.add} labelAdded={c.added} />)}
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
                  {costRun.metered && !estimateFitsQuota && <p role="alert" className="text-xs text-destructive">{locale === "en" ? "The estimated session and live-check cost exceeds your current balance or remaining quota." : locale === "ku" ? "تێچووی خەمڵێنراو لە باڵانس یان سنووری ماوە زیاترە." : "التكلفة التقديرية للجلسة والفحص تتجاوز الرصيد أو الحصة المتبقية."}</p>}
                  {costRun.dailyRemaining != null && <p className="text-xs text-muted-foreground">{locale === "en" ? "Daily quota remaining" : locale === "ku" ? "سنووری ڕۆژانەی ماوە" : "المتبقي من الحصة اليومية"}: {costRun.dailyRemaining} {c.tokens}</p>}
                  {costRun.monthlyRemaining != null && <p className="text-xs text-muted-foreground">{locale === "en" ? "Monthly quota remaining" : locale === "ku" ? "سنووری مانگانەی ماوە" : "المتبقي من الحصة الشهرية"}: {costRun.monthlyRemaining} {c.tokens}</p>}
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
          <section className="rb-workspace-fade space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${running ? "animate-pulse bg-primary" : error ? "bg-destructive" : "bg-emerald-500"}`} /><span className="font-semibold">{running ? c.working : error ? c.failed : c.ready}</span></div>
              {running && <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-xs text-destructive"><Square className="size-3" />{c.stop}</button>}
              {!running && <button type="button" onClick={() => { setEvents([]); setError(""); setGoal(""); setSelectedSkills([]); setJobId(null); }} className="rounded-lg border px-3 py-2 text-xs">{c.runAgain}</button>}
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
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${(event.type === "error" || (event.data?.ok === false && !isIntentionalSkip(event))) ? "bg-destructive" : event.type === "tool_result" && !isIntentionalSkip(event) ? "bg-emerald-500" : "bg-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">{event.type === "phase" ? c.phase : event.type === "tool_call" ? c.toolStarted : event.type === "tool_result" ? (isIntentionalSkip(event) ? (locale === "ar" ? "تخطٍ مقصود" : locale === "ku" ? "تێپەڕاندنی مەبەستدار" : "Intentional skip") : c.toolDone) : event.type === "clarify" ? c.clarify : event.type === "error" ? c.failed : c.unknown}{event.data?.tool ? ` · ${toolLabel(event.data.tool)}` : ""}</div>
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

function SkillCard({ skill, accessMode, locale, selected, onToggle, labelAdd, labelAdded }: {
  skill: MaaroofSkill; accessMode: "self_service" | "contact" | "disabled"; locale: SkillLocale; selected: boolean; onToggle: () => void; labelAdd: string; labelAdded: string;
}) {
  const Icon = SKILL_ICONS[skill.icon];
  if (accessMode === "contact") {
    return (
      <div className="rb-workspace-skill flex h-full flex-col rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{skill.label[locale]}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{skill.description[locale]}</span>
          </span>
        </div>
        <Link to="/contact" className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
          {locale === "en" ? "Contact us for this service" : locale === "ku" ? "بۆ ئەم خزمەتگوزارییە پەیوەندیمان پێوە بکە" : "تواصل معنا لطلب هذه الخدمة"}
        </Link>
      </div>
    );
  }
  return (
    <button type="button" onClick={onToggle} aria-pressed={selected} className={`rb-workspace-skill group flex h-full items-start gap-3 rounded-xl border p-4 text-start transition ${selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{skill.label[locale]}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{skill.description[locale]}</span>
        <span className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}>{selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}{selected ? labelAdded : labelAdd}</span>
      </span>
    </button>
  );
}
