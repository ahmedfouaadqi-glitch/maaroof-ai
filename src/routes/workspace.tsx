import { buildTaskExportPayload } from "@/lib/maaroof/task-export";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
const LazyAgentOps = lazy(() => import("@/components/maaroof/tabs/AgentOps").then((m) => ({ default: m.AgentOps })));
const LazySchedules = lazy(() => import("@/components/maaroof/SchedulesPanel").then((m) => ({ default: m.SchedulesPanel })));
const LazyApprovals = lazy(() => import("@/components/ApprovalQueue").then((m) => ({ default: m.ApprovalQueue })));
const LazyKnowledgeSpaces = lazy(() => import("@/components/agent/KnowledgeSpaces").then((m) => ({ default: m.KnowledgeSpaces })));
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthGate } from "@/components/AuthGate";
import { AttachmentAnalyzer } from "@/components/workspace/AttachmentAnalyzer";
import { SkillToolsPanel } from "@/components/workspace/SkillToolsPanel";
import { DirectToolsPanel } from "@/components/workspace/DirectToolsPanel";
import { useVisibility } from "@/lib/visibility";
import { HelpTip } from "@/components/workspace/HelpTip";
import { BroadcastPanel } from "@/components/workspace/BroadcastPanel";
import { KnownFactsPanel } from "@/components/workspace/KnownFactsPanel";
import { Dardasha } from "@/components/workspace/Dardasha";
import { isFiveAxisAuditGoal } from "@/lib/maaroof/chat-axis-audit";
import { AssistantMessage } from "@/components/workspace/AssistantMessage";
import { buildTaskGoalFromResult } from "@/lib/maaroof/chat-actions";
import { WorkspaceSwitcher, type Workspace } from "@/components/maaroof/WorkspaceSwitcher";
import { WorkspaceAccountPanel } from "@/components/workspace/WorkspaceAccountPanel";
import { canStartTask, AUTO_RUN_OPTIONS } from "@/lib/maaroof/dardasha";
import { LiveSkillHints } from "@/components/workspace/LiveSkillHints";
import { DebateCard } from "@/components/workspace/DebateCard";
import { LivePipeline } from "@/components/workspace/LivePipeline";
import { domainsInText } from "@/lib/knowledge-facts";
import { OnboardingTour } from "@/components/workspace/OnboardingTour";
import { DelegatedBrowserPanel } from "@/components/workspace/DelegatedBrowserPanel";
import { WorkspaceShell, formatElapsed, NavLink, MORE_ITEMS, type WorkspaceTab } from "@/components/workspace/WorkspaceShell";
import { HistoryPanel, BalancePanel, KnowledgePanel, type PastJob } from "@/components/workspace/WorkspacePanels";
import { supabase } from "@/integrations/supabase/client";
import { resolveInterfacePolicy } from "@/lib/interface-policy";
import { ENGINE_LIST } from "@/lib/ai-engines";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MAAROOF_SKILLS, recommendMaaroofSkills, toolsForSkills, getSkillAccessMode, defaultSkillAccessPolicy, type MaaroofSkill, skillFramework } from "@/lib/maaroof/skill-catalog";
import { phaseLabel, isIntentionalSkip, summarizeToolOutput, taskWeight } from "@/lib/maaroof/event-labels";
import { PulseBadge } from "@/components/motion/effects";
import { useRotatingHint } from "@/lib/workspace-hints";
import { WorkspaceAuditPulse } from "@/components/WorkspaceAuditPulse";
import { SecurityScanCard } from "@/components/SecurityScanCard";
import { WorkspaceSpacesPanel } from "@/components/WorkspaceSpacesPanel";
import { OnboardingWizard } from "@/components/workspace/OnboardingWizard";
import { resolveSkillAccessPolicy, normalizePlanAccessKey } from "@/lib/maaroof/skill-access-policy";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { ExportButtons } from "@/components/ExportButtons";
import { GeoScopeSelector, isGeoScopeConfigured, toServerGeoScope, type GeoScope } from "@/components/GeoScopeSelector";
import { getCostPreview, type CostPreview } from "@/lib/tokens.functions";
import {
  ArrowUp, BrainCircuit, Check, ChevronDown, CircleAlert, Clock3, FileText,
  LoaderCircle, ListChecks, Plus, Search, Sparkles, Square, Target, TrendingUp,
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
  validateSearch: (s: Record<string, unknown>): { tab?: string; skill?: string; tool?: string; domain?: string } => ({ ...(typeof s.domain === "string" ? { domain: s.domain.slice(0, 100) } : {}), ...(typeof s.tab === "string" ? { tab: s.tab } : {}), ...(typeof s.skill === "string" ? { skill: s.skill } : {}), ...(typeof s.tool === "string" ? { tool: s.tool } : {}) }),
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
    phase: "مرحلة", toolStarted: "بدأت أداة", toolDone: "نتيجة أداة", skipped: "متخطى عن قصد", final: "اكتملت المهمة",
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
    phase: "Phase", toolStarted: "Tool started", toolDone: "Tool result", skipped: "Skipped on purpose", final: "Task completed",
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
    phase: "قۆناغ", toolStarted: "ئامراز دەستی پێکرد", toolDone: "ئەنجامی ئامراز", skipped: "بە مەبەست تێپەڕێنرا", final: "ئەرکەکە تەواو بوو",
    clarify: "معروف پێویستی بە زانیاری زیاترە", sendAnswer: "ناردنی وەڵام", answerPlaceholder: "وەڵام بنووسە…",
    runAgain: "ئەرکی نوێ", unknown: "ئەرکەکە نوێ کرایەوە", modelCount: "مۆدێل هەڵبژێردرا",
  },
} as const;

const SKILL_ICONS = {
  search: Search, chart: TrendingUp, target: Target, sparkles: Sparkles, trending: TrendingUp, compass: BrainCircuit,
};

function WorkspacePage() {
  const { user, loading, session, profile: authProfile } = useAuth();
  const canUseKnowledgeSpaces = useVisibility().isAgentFeatureVisible("knowledge");
  const { lang } = useI18n();
  const navigate = useNavigate();
  const locale: SkillLocale = lang === "en" || lang === "ku" ? lang : "ar";
  const c = COPY[locale];
  const [goal, setGoal] = useState("");
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const [geoScope, setGeoScope] = useState<GeoScope>({ scope: "auto" });
  const [chatPrefill, setChatPrefill] = useState<{ text: string; taskId: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [reportTaskDraft, setReportTaskDraft] = useState(false);
  const [reportGoalSnapshot, setReportGoalSnapshot] = useState("");
  const [pendingApproved, setPendingApproved] = useState("");
  useEffect(() => {
    const saved = (authProfile as any)?.geo_scope;
    if (saved && typeof saved.scope === "string") setGeoScope(saved as GeoScope);
    else if (user?.id) setGeoScope({ scope: "auto" });
  }, [user?.id, JSON.stringify((authProfile as any)?.geo_scope)]);
  useEffect(() => { try { setGoal(localStorage.getItem("ws-goal-draft:" + (activeWorkspaceId || "main")) || ""); } catch { setGoal(""); } }, [activeWorkspaceId]);
  useEffect(() => { try { const key = "ws-goal-draft:" + (activeWorkspaceId || "main"); if (goal) localStorage.setItem(key, goal); else localStorage.removeItem(key); } catch {} }, [goal, activeWorkspaceId]);
  const rotatingHint = useRotatingHint(locale, goal.length > 0);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [liveProbe, setLiveProbe] = useState(true);
  const [runOpts, setRunOpts] = useState<{ salvage_on_failure: boolean; focused_plan: boolean; parallel_tools: boolean }>({ salvage_on_failure: false, focused_plan: false, parallel_tools: false });
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("ws-run-options") || "null"); if (v && typeof v === "object") setRunOpts((o) => ({ ...o, ...v })); } catch {} }, []);
  const setOpt = (k: "salvage_on_failure" | "focused_plan" | "parallel_tools", v: boolean) => setRunOpts((o) => { const n = { ...o, [k]: v }; try { localStorage.setItem("ws-run-options", JSON.stringify(n)); } catch {} return n; });
  const [resumeFrom, setResumeFrom] = useState<{ id: string; reused: number; total: number; left?: number; leftTokens?: number; balance?: number | null } | null>(null);
  async function prepareResume(id: string) {
    setResumeFrom({ id, reused: 0, total: 0 });
    const { data } = await (supabase as any).from("maaroof_job_events").select("payload").eq("job_id", id).eq("event_type", "tool_result").limit(200);
    const { data: cat } = await (supabase as any).from("maaroof_job_events").select("payload").eq("job_id", id).eq("event_type", "tool_catalog").order("seq", { ascending: false }).limit(1);
    const { reusableResults, remainingCost } = await import("@/lib/maaroof/jobs");
    const payloads = (data || []).map((e: any) => e.payload);
    const tools = new Set(payloads.map((p: any) => p?.tool).filter(Boolean));
    const reused = Object.keys(reusableResults(payloads));
    const catalog = cat?.[0]?.payload;
    const planned: string[] = (catalog?.tools || []).filter((t: any) => t?.selected).map((t: any) => String(t.key));
    const prices: Record<string, number> = {};
    for (const t of catalog?.tools || []) prices[String(t.key)] = Number(t.cost) || 0;
    const rc = remainingCost(planned.length ? planned : Array.from(tools) as string[], reused, prices);
    setResumeFrom({ id, reused: reused.length, total: tools.size, left: rc.tools.length, leftTokens: rc.tokens, balance: catalog?.balance ?? null });
  }
  const [selectedModels, setSelectedModels] = useState<string[]>(ENGINE_LIST.map((engine) => engine.key));
  const [running, setRunning] = useState(false);
  // Explicit approval from «دردشة» starts the task once the goal state has updated.
  useEffect(() => { if (canStartTask({ approved: !!pendingApproved, goal, running }) && goal === pendingApproved) { setPendingApproved(""); void start(); } }, [pendingApproved, goal, running]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [clarification, setClarification] = useState("");
  const [clarifyField, setClarifyField] = useState("");
  const [error, setError] = useState("");
  const [showActivity, setShowActivity] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => { if (!running) return; const id = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(id); }, [running]);
  const [mode, setMode] = useState<"execution" | "recommendation" | "simulation">("execution");
  const [costRun, setCostRun] = useState<CostPreview | null>(null);
  const [costProbe, setCostProbe] = useState<CostPreview | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [policy, setPolicy] = useState<{ enabled: boolean; available_interfaces: string[]; default_ui: "workbench" | "professional"; show_professional_link: boolean; allowed_modes: Array<"execution" | "recommendation" | "simulation">; show_live_engine_picker: boolean; enabled_skills: string[]; skill_access: Record<string, "self_service" | "contact" | "disabled"> }>({ enabled: true, available_interfaces: ["workbench", "professional"], default_ui: "workbench", show_professional_link: true, allowed_modes: ["execution", "recommendation", "simulation"], show_live_engine_picker: true, enabled_skills: MAAROOF_SKILLS.map(skill => skill.key), skill_access: defaultSkillAccessPolicy() });
  const watcherRef = useState<{ current: number }>({ current: 0 })[0];
  const search = Route.useSearch();
  const TABS: WorkspaceTab[] = ["main", "history", "balance", "knowledge", "interview", "pulse", "models", "settings", "browser", "skills", "tools", "extras", "more"];
  const legacyTab = search.tab === "ops" || search.tab === "channels" ? "extras" : search.tab === "approvals" ? "interview" : search.tab;
  const tab: WorkspaceTab = TABS.includes(legacyTab as WorkspaceTab) ? (legacyTab as WorkspaceTab) : "main";
  const goMain = () => navigate({ to: "/workspace", search: {} });
  async function openPastJob(j: PastJob) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    watcherRef.current += 1;
    setChatPrefill(null);
    setEvents([]); setError(""); setJobId(j.id); setGoal(j.goal || "");
    setRunning(!["completed", "failed", "cancelled"].includes(j.status));
    goMain();
    try { await watchJob(j.id, 0, token, false); } catch (e: any) { setRunning(false); setError(String(e?.message || c.failed)); }
  }
  function continuePastJob(j: PastJob) {
    watcherRef.current += 1;
    setEvents([]); setJobId(null); setRunning(false); setError("");
    const statusLabel = j.status;
    const text = locale === "en"
      ? `Continue the previous task using its saved context.\nOriginal goal: ${j.goal}\nPrevious status: ${statusLabel}\nReview recorded evidence and successful tool outputs, distinguish completed findings from missing steps, and propose the next action. Do not assume the previous attempt succeeded.`
      : locale === "ku"
        ? `ئەرکی پێشوو بە بەکارهێنانی پاشبنەمای پاشەکەوتکراو بەردەوام بکە.\nئامانجی سەرەکی: ${j.goal}\nدۆخی پێشوو: ${statusLabel}\nبەڵگە و ئەنجامە پاشەکەوتکراوەکان بپشکنە، هەنگاوە تەواوبووەکان لە هەنگاوە ماوەکان جیا بکەرەوە، و هەنگاوی داهاتوو پێشنیار بکە. گریمانە مەکە هەوڵی پێشوو سەرکەوتوو بووە.`
        : `استكمل المهمة السابقة بالاستناد إلى سياقها المحفوظ.\nالهدف الأصلي: ${j.goal}\nحالة المحاولة السابقة: ${statusLabel}\nراجع الأدلة ونتائج الأدوات المسجلة، وميّز ما اكتمل عما بقي، ثم اقترح الخطوة التالية. لا تفترض أن المحاولة السابقة نجحت.`;
    setChatPrefill({ text, taskId: j.id });
    // Preparing reuse is read-only; execution still requires the user's approval in Dardasha.
    void prepareResume(j.id);
    if (Array.isArray(j.request_payload?.selected_skills)) {
      setSelectedSkills(j.request_payload.selected_skills.filter((key: unknown) => typeof key === "string"));
    }
    goMain();
    setTimeout(() => document.getElementById("dardasha-message-input")?.focus(), 50);
  }

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/workspace" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle(),
      user?.id ? supabase.from("profiles").select("subscription_tier,is_subscribed,subscription_expires_at,ui_visibility").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
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
      const effectiveInterfacePolicy = resolveInterfacePolicy(value, profile?.ui_visibility?.interface);
      const availableInterfaces = effectiveInterfacePolicy.available_interfaces;
      setPolicy(old => ({ ...old, ...value, ...effectiveInterfacePolicy, skill_access: effectiveSkillAccess }));
      if (!availableInterfaces.includes("workbench")) {
        navigate({ to: availableInterfaces.includes("professional") ? "/dashboard" : "/", replace: true });
      }
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

  useEffect(() => {
    const k = search.skill;
    if (k && MAAROOF_SKILLS.some((x) => x.key === k)) setSelectedSkills((cur) => (cur.includes(k) ? cur : [...cur, k]));
  }, [search.skill]);
  const [skillView, setSkillView] = useState<"suggested" | "all">("suggested");
  const allSkills = useMemo(() => MAAROOF_SKILLS.map((skill) => ({ skill, access: policy.enabled_skills.includes(skill.key) ? getSkillAccessMode(skill, policy.skill_access) : "disabled" as const })), [policy.enabled_skills, policy.skill_access]);
  const recommendations = useMemo(() => {
    const isSelfService = (skill: MaaroofSkill) => policy.enabled_skills.includes(skill.key) && getSkillAccessMode(skill, policy.skill_access) === "self_service";
    const enabled = MAAROOF_SKILLS.filter(isSelfService);
    const matched = recommendMaaroofSkills(goal, MAAROOF_SKILLS.length).filter(isSelfService);
    return (matched.length ? matched : enabled).slice(0, 3);
  }, [goal, policy.enabled_skills, policy.skill_access]);
  const tools = useMemo(() => toolsForSkills(selectedSkills), [selectedSkills]);
  const finalEvent = [...events].reverse().find((event) => event.type === "final");
  const backgroundActivity = running ? "running" : error ? "failed" : finalEvent ? "success" : events.length > 0 ? "analyzing" : "idle";
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.maaroofActivity = backgroundActivity;
    window.dispatchEvent(new CustomEvent("maaroof:background-state", { detail: { state: backgroundActivity } }));
    const resetSuccess = backgroundActivity === "success"
      ? window.setTimeout(() => {
          if (root.dataset.maaroofActivity !== "success") return;
          root.dataset.maaroofActivity = "idle";
          window.dispatchEvent(new CustomEvent("maaroof:background-state", { detail: { state: "idle" } }));
        }, 3000)
      : undefined;
    return () => { if (resetSuccess !== undefined) window.clearTimeout(resetSuccess); };
  }, [backgroundActivity]);
  useEffect(() => () => {
    document.documentElement.dataset.maaroofActivity = "idle";
    window.dispatchEvent(new CustomEvent("maaroof:background-state", { detail: { state: "idle" } }));
  }, []);
  const isAxisAuditGoal = isFiveAxisAuditGoal(goal);
  const axisAuditTask = isAxisAuditGoal ? {
    status: (running ? "running" : error ? "failed" : finalEvent ? "complete" : "ready") as "ready" | "running" | "complete" | "failed",
    goal,
    events,
    finalText: String(finalEvent?.data?.text || finalEvent?.data?.message || ""),
    error,
  } : undefined;
  /** Real per-engine status read only from recorded task events; unknown engines stay "checked on run". */
  const engineStatus = useMemo(() => {
    const out: Record<string, "ok" | "failed"> = {};
    const walk = (v: any, depth: number) => {
      if (!v || typeof v !== "object" || depth > 5) return;
      if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
      const key = typeof v.engine === "string" ? v.engine : typeof v.engine_key === "string" ? v.engine_key : null;
      if (key && ENGINE_LIST.some((e) => e.key === key)) {
        if (v.error || v.ok === false || v.status === "failed") out[key] = "failed";
        else if (v.ok === true || v.status === "ok" || v.status === "completed" || typeof v.answer === "string") out[key] = "ok";
      }
      for (const k in v) walk(v[k], depth + 1);
    };
    events.forEach((e) => walk(e.data, 0));
    return out;
  }, [events]);
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

  function handleWorkspaceChange(ws: Workspace | null) {
    if (running && ws?.id !== activeWorkspaceId) return;
    try {
      const previousKey = "ws-goal-draft:" + (activeWorkspaceId || "main");
      if (goal) localStorage.setItem(previousKey, goal); else localStorage.removeItem(previousKey);
      setGoal(localStorage.getItem("ws-goal-draft:" + (ws?.id || "main")) || "");
    } catch { setGoal(""); }
    setActiveWorkspace(ws);
    setSelectedSkills([]); setEvents([]); setJobId(null); setResumeFrom(null);
    setError(""); setClarification(""); setClarifyField(""); setPendingApproved(""); setSkillAsk([]);
  }

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
          void import("@/lib/sound").then((m) => m.playNotify()).catch(() => {});
          setClarification("");
        }
        if (eventType === "error") setError(String(parsed?.message || c.failed));
      } catch {
        // Ignore malformed SSE frames; a valid frame must never crash the workspace.
      }
    }
    return remaining;
  }

  async function watchJob(id: string, after: number, token: string, allWorkspaces = false) {
    watcherRef.current += 1;
    const watcherId = watcherRef.current;
    let cursor = after;
    let failures = 0;
    const { shouldRetryPoll, pollBackoffMs } = await import("@/lib/maaroof/jobs");
    while (watcherRef.current === watcherId) {
      let response: Response | null = null;
      try {
        // Always read the freshest token: background refreshes must not break tracking.
        const { data: s } = await supabase.auth.getSession();
        const tk = s.session?.access_token || token;
        const query = new URLSearchParams({ id, after: String(cursor) });
        if (allWorkspaces) query.set("all_workspaces", "1");
        else query.set("workspace_id", activeWorkspaceId || "");
        response = await fetch("/api/maaroof-jobs?" + query.toString(), {
          headers: { Authorization: "Bearer " + tk },
          cache: "no-store",
        });
      } catch {
        response = null;
      }
      if (!response || !response.ok) {
        if (shouldRetryPoll(response ? response.status : null)) {
          failures += 1;
          await new Promise(resolve => setTimeout(resolve, pollBackoffMs(failures)));
          continue; // transient: keep watching from the same cursor
        }
        const body = await response!.json().catch(() => ({}));
        throw new Error(String(body?.error || c.failed));
      }
      failures = 0;
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
            void import("@/lib/sound").then((m) => m.playNotify()).catch(() => {});
            setClarification("");
          }
          if (event.type === "error") setError(String(event.data?.message || c.failed));
        }
      }
      const status = String(body?.job?.status || "running");
      const autoNext = body?.job?.auto_resume_job_id || body?.job?.request_payload?.auto_resume_job_id;
      if (!allWorkspaces && status === "failed" && typeof autoNext === "string" && /^[0-9a-f-]{36}$/i.test(autoNext)) {
        // The runner stopped; Maaroof resumed automatically from the last successful step at no extra charge.
        setEvents(current => [...current, { type: "narration", data: { text: locale === "en" ? "The runner stopped; resuming automatically from the last successful step (no extra charge)…" : locale === "ku" ? "بەردەوامبوونی خۆکار لە دوایین هەنگاوی سەرکەوتوو…" : "توقف المنفّذ؛ معروف يستأنف تلقائياً من آخر خطوة ناجحة دون خصم إضافي…" }, at: Date.now() } as WorkspaceEvent]);
        setJobId(autoNext);
        id = autoNext; cursor = 0;
        continue;
      }
      if ((status === "completed" || status === "failed" || status === "cancelled") && incoming.length >= 200) {
        // History endpoint pages events in batches; keep reading until the last page.
        continue;
      }
      if (status === "completed" || status === "failed" || status === "cancelled") {
        void import("@/lib/sound").then((s) => (status === "completed" ? s.playSuccess() : status === "failed" ? s.playError() : null)).catch(() => {});
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
      const response = await fetch("/api/maaroof-jobs?workspace_id=" + encodeURIComponent(activeWorkspaceId || ""), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      if (!response.ok || !active) return;
      const body = await response.json();
      const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
      const now = Date.now();
      const recent = jobs.find((job: any) => job.status === "dispatching" || job.status === "queued" || job.status === "running")
;
      void now;
      if (!active) return;
      if (!recent) { setRunning(false); setJobId(null); setEvents([]); return; }
      setJobId(String(recent.id));
      setGoal(String(recent.goal || ""));
      setMode(["execution", "recommendation", "simulation"].includes(recent.mode) ? recent.mode : "execution");
      const payload = recent.request_payload || {};
      setSelectedSkills(Array.isArray(payload.selected_skills) ? payload.selected_skills.filter((key: unknown) => typeof key === "string") : []);
      setRunning(recent.status === "dispatching" || recent.status === "queued" || recent.status === "running");
      setError("");
      setEvents([]);
      try { await watchJob(String(recent.id), 0, token); } catch (e: any) { if (active) { setRunning(false); setError(String(e?.message || c.failed)); } }
    })().catch(() => {});
    return () => { active = false; watcherRef.current += 1; };
    // Only re-attach when the signed-in user changes; token refreshes must not cancel a running task's tracking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, activeWorkspaceId]);

  const [skillAsk, setSkillAsk] = useState<string[]>([]);
  async function start(clarifications?: Record<string, string>, skillsOverride?: string[]) {
    if (!goal.trim() || running || !user || !policy.allowed_modes.includes(mode)) return;
    if (!isGeoScopeConfigured(geoScope)) {
      setError(locale === "en" ? "Choose the required country and region/city before starting." : locale === "ku" ? "پێش دەستپێکردن وڵات و ناوچە/شار دیاری بکە." : "حدّد الدولة والمنطقة أو المدينة المطلوبة قبل بدء المهمة.");
      return;
    }
    if (liveProbe && selectedModels.length === 0) {
      setError(locale === "en" ? "Select at least one model or turn off live checking." : locale === "ku" ? "مۆدێلێک هەڵبژێرە یان پشکنینی ڕاستەوخۆ ناچالاک بکە." : "اختر نموذجاً واحداً على الأقل أو أوقف الفحص المباشر.");
      return;
    }
    setReportTaskDraft(false);
    setReportGoalSnapshot("");
    setRunning(true);
    setError("");
    setSkillAsk([]);
    setEvents([]);
    setJobId(null);
    try {
      let token = (await supabase.auth.getSession()).data.session?.access_token || session?.access_token;
      if (!token) throw new Error("auth_required");
      const post = (tk: string) => fetch("/api/maaroof", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk },
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
          workspace_id: activeWorkspaceId,
          geo_scope: toServerGeoScope(geoScope),
          selected_skills: skillsOverride || selectedSkills,
          run_options: AUTO_RUN_OPTIONS,
          resume_job_id: resumeFrom?.id,
          keep_alive: true,
        }),
      });
      let response = await post(token);
      if (response.status === 401) {
        // Sign-in token may have just expired: refresh once and retry before failing.
        const refreshed = (await supabase.auth.refreshSession()).data.session?.access_token;
        if (refreshed) { token = refreshed; response = await post(token); }
      }
      const liveJob = response.ok ? response.headers.get("x-maaroof-job") : null;
      if (liveJob && response.body) {
        // Hold the connection open (keeps the server run alive) while polling recorded events.
        setJobId(liveJob); setResumeFrom(null);
        const reader = response.body.getReader();
        const drain = (async () => { try { while (!(await reader.read()).done) {} } catch {} })();
        await watchJob(liveJob, 0, token);
        try { await reader.cancel(); } catch {}
        void drain;
        return;
      }
      // If the queue table is unavailable, the server streams the run directly instead of failing.
      if (response.ok && (response.headers.get("content-type") || "").includes("text/event-stream")) {
        setJobId(null);
        setResumeFrom(null);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("inline_stream_unavailable");
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer = parseEventStreamChunk(buffer + decoder.decode(chunk.value, { stream: true }));
          }
          buffer = parseEventStreamChunk(buffer + decoder.decode() + "\n\n");
        } finally {
          reader.releaseLock();
        }
        setRunning(false);
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (response.ok && body?.needs_skill) {
        setSkillAsk(Array.isArray(body.options) ? body.options : []); setRunning(false);
        setError(locale === "en" ? "Choose a skill below so Maaroof knows what to run — nothing was charged." : locale === "ku" ? "تواناییەک لە خوارەوە هەڵبژێرە — هیچ نەکێشرا." : "اختر مهارة من الأسفل ليعرف معروف ما يشغّله — لم يُخصم شيء.");
        return;
      }
      if (!response.ok || !body?.job_id) {
        const message = body?.message?.[locale] || body?.message?.ar || (body?.error === "auth_required" ? (locale === "en" ? "Your session expired. Please sign in again." : locale === "ku" ? "دانیشتنەکەت بەسەرچوو، دووبارە بچۆ ژوورەوە." : "انتهت جلسة الدخول، يرجى تسجيل الدخول مجدداً.") : body?.error) || c.failed;
        throw new Error(String(message));
      }
      setJobId(String(body.job_id)); setResumeFrom(null);
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

  function eventSummary(event: WorkspaceEvent): string {
    const d = event.data || {};
    if (event.type === "phase") return phaseLabel(d.phase, locale as any) || c.unknown;
    if (event.type === "tool_call") return String(d.reason || toolLabel(d.tool || ""));
    if (event.type === "tool_result") {
      if (isIntentionalSkip(d)) return c.skipped;
      const readable = summarizeToolOutput(d.output, locale as any);
      if (readable) return readable;
      return d.ok ? c.toolDone : c.failed;
    }
    if (event.type === "error") return String(d.message || c.failed);
    if (event.type === "clarify") return String(d.question || c.clarify);
    if (event.type === "skill_choice") {
      const names = (Array.isArray(d.skills) ? d.skills : []).map((k: string) => { const sk = MAAROOF_SKILLS.find((x) => x.key === k); const why = d.reasons?.[k]; return (sk?.label[locale] || k) + (why && why !== "user_selected" ? ` (${why})` : ""); }).join("، ");
      return d.kind === "selected" ? `${locale === "en" ? "Skills you chose" : locale === "ku" ? "تواناکانی هەڵبژێردراو" : "المهارات التي اخترتها"}: ${names}` : `${locale === "en" ? "Chose these skills because the task mentions" : locale === "ku" ? "ئەم توانایانە هەڵبژێردران چونکە ئەرکەکە باسی دەکات" : "اخترت هذه المهارات لأن المهمة تذكر"}: ${names}`;
    }
    return String(d.text || d.message || d.phase || c.unknown);
  }

  if (loading || !user) return <AuthGate state={loading ? "loading" : "signed-out"} title={c.eyebrow} redirect="/workspace" />;

  return (
    <div className={`maaroof-workspace-page min-h-screen ${tab === "main" ? "is-main-chat" : ""}`}>
      <SiteHeader />
      <OnboardingTour lang={locale} />
      <WorkspaceShell locale={locale} tab={tab} autoCollapse={running}>
      <div className={`maaroof-workspace-switcher-wrap px-4 pt-4 md:px-0 ${tab === "main" ? "is-main-chat-switcher" : ""}`}><WorkspaceSwitcher onChange={handleWorkspaceChange} disabled={running} /></div>
      {tab === "history" && <div className="px-4 py-6 md:px-0 md:py-10"><HistoryPanel lang={locale} workspaceId={activeWorkspaceId} onOpen={(j) => void openPastJob(j)} onContinue={continuePastJob} /></div>}
      {tab === "balance" && <div className="px-4 py-6 md:px-0 md:py-10"><BalancePanel lang={locale} /></div>}
      {tab === "knowledge" && <div className="px-4 py-6 md:px-0 md:py-10"><KnowledgePanel lang={locale} workspaceId={activeWorkspaceId} /><KnownFactsPanel lang={locale} workspaceId={activeWorkspaceId} /><BroadcastPanel lang={locale} workspaceId={activeWorkspaceId} />{canUseKnowledgeSpaces && <section className="mt-4 rounded-2xl border border-border bg-card p-5"><Suspense fallback={null}><LazyKnowledgeSpaces userId={user?.id ?? null} workspaceId={activeWorkspaceId} /></Suspense></section>}</div>}
      {tab === "interview" && <div className="px-4 py-6 md:px-0 md:py-10"><OnboardingWizard lang={locale as any} workspaceId={activeWorkspaceId} /><WorkspaceAccountPanel workspace={activeWorkspace} lang={locale} onSaved={(saved) => setActiveWorkspace(saved as Workspace)} /><WorkspaceSpacesPanel lang={locale} workspaceId={activeWorkspaceId} /><div className="mt-4"><AttachmentAnalyzer lang={locale} context="interview" /></div><section className="mt-4 rounded-2xl border border-border bg-card p-5"><h2 className="mb-1 font-semibold">{locale === "en" ? "Approvals" : locale === "ku" ? "ڕەزامەندییەکان" : "الموافقات"}</h2><p className="mb-3 text-xs text-muted-foreground">{locale === "en" ? "Actions waiting for your decision before Maaroof runs them." : locale === "ku" ? "کردارەکان چاوەڕێی بڕیاری تۆن." : "إجراءات تنتظر قرارك قبل أن ينفذها معروف."}</p><Suspense fallback={null}><LazyApprovals /></Suspense></section><section className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-5"><h2 className="font-semibold">{locale === "en" ? "Teach once, work forever" : locale === "ku" ? "جارێک فێرم بکە" : "علّمني مرة… أعمل للأبد"}</h2><p className="mt-1 text-xs text-muted-foreground">{locale === "en" ? "What you teach Maaroof here is saved in the Knowledge space and reused in every task for this account." : locale === "ku" ? "ئەوەی فێری معروفی دەکەیت لە شوێنی زانیاری پاشەکەوت دەکرێت." : "ما تعلّمه لمعروف يُحفظ في مساحة المعرفة ويُستخدم في كل مهمة حسب طبيعة حسابك."}</p><KnownFactsPanel lang={locale} workspaceId={activeWorkspaceId} /></section></div>}
      {tab === "pulse" && <div className="px-4 py-6 md:px-0 md:py-10"><WorkspaceAuditPulse lang={locale} workspaceId={activeWorkspaceId} onTask={(text) => { setGoal(text); goMain(); }} /><SecurityScanCard lang={locale} /></div>}
      {tab === "models" && <div className="px-4 py-6 md:px-0 md:py-10"><section className="rounded-2xl border border-border bg-card p-5">
        <h1 className="font-display text-xl font-bold">{c.models}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{locale === "en" ? "All ten models are questioned by default. Connection status is confirmed live when a task runs, never assumed." : locale === "ku" ? "هەر دە مۆدێلەکە بە شێوەی بنەڕەت پرسیاریان لێدەکرێت. دۆخی پەیوەندی لە کاتی جێبەجێکردندا پشتڕاست دەکرێتەوە." : "تُسأل النماذج العشرة افتراضياً. حالة الربط تُؤكَّد فعلياً عند تشغيل المهمة ولا تُفترض مسبقاً."}</p>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={liveProbe} onChange={(e) => setLiveProbe(e.target.checked)} className="mt-1 accent-primary" /><span>{c.liveProbe}</span></label>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ENGINE_LIST.map((engine) => { const on = selectedModels.includes(engine.key); const st = engineStatus[engine.key]; return (
            <label key={engine.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${on ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/40"}`}>
              <input type="checkbox" checked={on} onChange={(e) => setSelectedModels((cur) => e.target.checked ? [...cur, engine.key] : cur.filter((k) => k !== engine.key))} className="accent-primary" />
              <span className="flex-1 font-medium">{engine.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st === "ok" ? "bg-success/15 text-success" : st === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{st === "ok" ? (locale === "en" ? "Connected" : locale === "ku" ? "پەیوەستە" : "متصل") : st === "failed" ? (locale === "en" ? "Unavailable" : locale === "ku" ? "بەردەست نییە" : "متعذر") : (locale === "en" ? "Checked on run" : locale === "ku" ? "لە کاتی کار" : "يُفحص عند التشغيل")}</span>
            </label>); })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedModels(ENGINE_LIST.map((e) => e.key))} className="rounded-lg border px-3 py-1.5 text-xs">{c.all}</button>
          <button type="button" onClick={() => setSelectedModels([])} className="rounded-lg border px-3 py-1.5 text-xs">{c.clear}</button>
          <span className="ms-auto self-center text-xs text-muted-foreground">{selectedModels.length} {c.modelCount}</span>
          <button type="button" onClick={goMain} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">{locale === "en" ? "Back to task" : locale === "ku" ? "گەڕانەوە بۆ ئەرک" : "العودة إلى المهمة"}</button>
        </div>
      </section></div>}
      {tab === "settings" && <div className="px-4 py-6 md:px-0 md:py-10"><section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h1 className="font-display text-xl font-bold">{locale === "en" ? "Settings" : locale === "ku" ? "ڕێکخستن" : "الإعدادات"}</h1>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><span className="text-sm">{locale === "en" ? "Interface language" : locale === "ku" ? "زمانی ڕووکار" : "لغة الواجهة"}</span><LanguageSwitcher /></div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><span className="text-sm">{locale === "en" ? "Day / night mode" : locale === "ku" ? "دۆخی ڕۆژ / شەو" : "الوضع النهاري / الليلي"}</span><ThemeToggle /></div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><span className="min-w-0 truncate text-sm">{user.email}</span><Link to="/profile" className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">{locale === "en" ? "Full profile" : locale === "ku" ? "پرۆفایلی تەواو" : "الملف الكامل"}</Link></div>
      </section></div>}
      {tab === "skills" && <div className="px-4 py-6 md:px-0 md:py-10"><SkillToolsPanel lang={locale} skill={search.skill} tool={search.tool} workspaceId={activeWorkspaceId} /></div>}
      {tab === "tools" && <div className="px-4 py-6 md:px-0 md:py-10"><DirectToolsPanel lang={locale} tool={search.tool} workspaceId={activeWorkspaceId} /></div>}
      {tab === "extras" && <div className="space-y-4 px-4 py-6 md:px-0 md:py-10"><section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">{locale === "en" ? "Publishing channels" : locale === "ku" ? "کەناڵەکانی بڵاوکردنەوە" : "قنوات النشر"}</h2><Suspense fallback={null}><LazyAgentOps section="channels" /></Suspense></section><section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">{locale === "en" ? "Scheduling" : locale === "ku" ? "خشتە" : "الجدولة"}</h2><Suspense fallback={null}><LazySchedules workspaceId={activeWorkspaceId} defaultPrompt={goal} /></Suspense></section><section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-1 font-semibold">{locale === "en" ? "Scheduled agent tasks" : locale === "ku" ? "ئەرکە خشتەکراوەکان" : "مهام الوكيل المجدولة"}</h2><p className="mb-3 text-xs text-muted-foreground">{locale === "en" ? "Tip: just write “every week…” in your goal and Maaroof will propose a schedule or ask you." : locale === "ku" ? "تەنها بنووسە «هەموو هەفتەیەک…»." : "تلميح: اكتب «كل أسبوع…» في هدفك وسيقترح معروف الجدولة أو يسألك عنها."}</p><Suspense fallback={null}><LazyAgentOps section="tasks" /></Suspense></section></div>}
      {tab === "browser" && <div className="px-4 py-6 md:px-0 md:py-10"><DelegatedBrowserPanel lang={locale} initialDomain={search.domain} initialPurpose={search.domain ? goal.trim().slice(0, 200) : undefined} /></div>}
      {tab === "more" && <div className="grid gap-2 px-4 py-6">{MORE_ITEMS.map((n) => <div key={n.tab || n.to} className="rounded-xl border border-border bg-card"><NavLink n={n} locale={locale} on={false} compact={false} /></div>)}</div>}
      <main id="skills" className={`maaroof-workspace-main px-4 py-5 md:px-0 md:py-7 xl:py-8 ${tab === "main" ? "is-main-chat-main" : "hidden"}`}>
        <header className="rb-workspace-fade relative isolate mb-5 flex flex-wrap items-center gap-3 md:mb-6">
          <div aria-hidden className="ws-aurora" />
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

        {(finalEvent || events.length > 0) && !running && (
          <div className="mb-4 flex justify-end"><button type="button" onClick={() => { watcherRef.current += 1; setEvents([]); setJobId(null); setGoal(""); setError(""); setTimeout(() => document.getElementById("workspace-goal")?.focus(), 50); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus className="size-4" />{locale === "en" ? "Start a new task" : locale === "ku" ? "دەستپێکردنی ئەرکی نوێ" : "بدء مهمة جديدة"}</button><button type="button" onClick={() => { const prev = goal; const prevJob = jobId; const prevDone = events.some((e: any) => e.type === "final"); watcherRef.current += 1; setEvents([]); setJobId(null); if (prevJob && !prevDone) void prepareResume(prevJob); setError(""); setGoal((locale === "en" ? "Follow-up on: " : locale === "ku" ? "بەردەوامی: " : "استكمالاً لمهمة: ") + prev + "\n"); setTimeout(() => document.getElementById("workspace-goal")?.focus(), 50); }} className="ms-2 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">{locale === "en" ? "Continue" : locale === "ku" ? "بەردەوامبوون" : "استكمال"}</button></div>
        )}
        {((!finalEvent && !running && events.length === 0) || isAxisAuditGoal) && <div className="maaroof-chat-frame mb-4"><Dardasha
            lang={locale}
            workspaceId={activeWorkspaceId}
            workspaceContext={activeWorkspace}
            busyTask={running}
            geoScope={geoScope}
            onGeoScopeChange={setGeoScope}
            chatPrefill={chatPrefill}
            onPrefillConsumed={() => setChatPrefill(null)}
            axisAuditTask={axisAuditTask}
            onPrepareTask={(t) => {
              setGoal(t);
              setMode("execution");
              setPendingApproved("");
              setResumeFrom(null);
              setError("");
              setReportTaskDraft(false);
              setReportGoalSnapshot("");
              setShowAdvanced(true);
              window.setTimeout(() => document.getElementById("workspace-goal")?.focus(), 60);
            }}
          /></div>}
        {!running && showAdvanced && ((!finalEvent && events.length === 0) || reportTaskDraft) && (
          <section className="rb-workspace-fade rb-workspace-delay-1 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="order-1 min-w-0 space-y-4 lg:order-none">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
                <label htmlFor="workspace-goal" className="mb-2 block text-sm font-semibold">{locale === "en" ? "Your goal" : locale === "ku" ? "ئامانجەکەت" : "هدفك"}</label>
                {reportTaskDraft && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs"><span>{locale === "en" ? "Task draft created from the report. Review the scope and cost before starting." : locale === "ku" ? "ئەرک لە ڕاپۆرتەکەوە ئامادە کراوە؛ پێش دەستپێکردن تێچوو و سنوورەکە بپشکنە." : "أُعدّت مسودة المهمة من التقرير. راجع النطاق والتكلفة قبل البدء."}</span><button type="button" onClick={() => { setGoal(reportGoalSnapshot); setReportTaskDraft(false); setReportGoalSnapshot(""); setShowAdvanced(false); }} className="font-semibold text-primary hover:underline">{locale === "en" ? "Cancel conversion" : locale === "ku" ? "هەڵوەشاندنەوە" : "إلغاء التحويل"}</button></div>}
                {goal && <div className="mb-2 flex justify-end"><button type="button" onClick={() => { setGoal(""); setSelectedSkills([]); setResumeFrom(null); setTimeout(() => document.getElementById("workspace-goal")?.focus(), 30); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"><Plus className="size-3.5" />{locale === "en" ? "New blank task" : locale === "ku" ? "ئەرکی نوێی بەتاڵ" : "مهمة جديدة فارغة"}</button></div>}
                <textarea id="workspace-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={rotatingHint} disabled={running} rows={4} className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" />
                {selectedSkills.length === 0 && <LiveSkillHints text={goal} lang={locale} onPick={(k) => setSelectedSkills([k])} />}
                <div className="mt-3">
                  <GeoScopeSelector compact value={geoScope} onChange={setGeoScope} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div role="radiogroup" aria-label={c.mode} className="inline-flex flex-wrap rounded-xl border border-border p-0.5 text-xs">
                    {([{ key: "execution", label: c.execute }, { key: "recommendation", label: c.recommendMode }, { key: "simulation", label: c.simulate }] as const).filter(item => policy.allowed_modes.includes(item.key)).map(item => (
                      <button key={item.key} type="button" role="radio" aria-checked={mode === item.key} onClick={() => setMode(item.key)} className={`rounded-lg px-3 py-1.5 font-semibold transition ${mode === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{item.label}</button>
                    ))}
                  </div>
                  <HelpTip id="mode" lang={locale} />
                  <button type="button" onClick={() => void start()} disabled={!goal.trim() || running || costLoading || !policy.allowed_modes.includes(mode) || (!!costRun && !estimateFitsQuota)} className="ms-auto inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    {running ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}{c.run}
                  </button>
                </div>
                {resumeFrom && !running && <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">{resumeFrom.reused === 0 && <span className="block mb-1 font-semibold text-warning">{locale === "en" ? "The earlier attempt saved no tool results, so this resume starts from the beginning at the full expected cost." : locale === "ku" ? "هیچ ئەنجامێک پاشەکەوت نەکرابوو، لە سەرەتاوە دەست پێدەکات." : "المحاولة السابقة لم تحفظ أي نتيجة أداة، لذا سيبدأ الاستكمال من البداية بالكلفة المتوقعة كاملة."}</span>}<span className="font-semibold">{locale === "en" ? `Smart resume: ${resumeFrom.reused} earlier result(s) will be reused at no extra charge; Maaroof runs only what is missing.` : locale === "ku" ? `بەردەوامبوونی زیرەک: ${resumeFrom.reused} ئەنجام دووبارە بەکاردێتەوە بێ تێچوو.` : `استكمال ذكي: سيُعاد استخدام ${resumeFrom.reused} نتيجة سابقة دون خصم جديد عليها، ويُشغّل معروف ما نقص فقط.`}</span>{resumeFrom.left != null && <span className="block mt-1">{locale === "en" ? `Remaining: ${resumeFrom.left} tool(s), about ${resumeFrom.leftTokens} tokens${resumeFrom.balance != null ? ` of your ${resumeFrom.balance} balance` : ""}, charged only on success.` : locale === "ku" ? `ماوە: ${resumeFrom.left} ئامراز، نزیکەی ${resumeFrom.leftTokens} تۆکن${resumeFrom.balance != null ? ` لە باڵانسی ${resumeFrom.balance}` : ""}.` : `المتبقي: ${resumeFrom.left} أداة، بكلفة متوقعة نحو ${resumeFrom.leftTokens} توكن${resumeFrom.balance != null ? ` من رصيدك ${resumeFrom.balance}` : ""}، تُخصم بعد النجاح فقط.`}</span>} <button type="button" onClick={() => setResumeFrom(null)} className="ms-2 underline">{locale === "en" ? "Start fresh instead" : locale === "ku" ? "لە سەرەتاوە" : "ابدأ من الصفر بدلاً من ذلك"}</button></div>}
                <p className="mt-2 text-xs text-muted-foreground">{c.ask}</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold">{c.suggested} <HelpTip id="skills" lang={locale} /></h2>
                    <p className="mt-1 text-xs text-muted-foreground">{c.skillsHint}</p>
                    <div role="tablist" className="mt-2 inline-flex rounded-lg border border-border p-0.5 text-xs">
                      {(["suggested", "all"] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={skillView === v} onClick={() => setSkillView(v)} className={`rounded-md px-3 py-1 font-semibold ${skillView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{v === "suggested" ? (locale === "en" ? "Suggested" : locale === "ku" ? "پێشنیارکراو" : "المقترحة") : `${locale === "en" ? "All" : locale === "ku" ? "هەموو" : "الكل"} (${MAAROOF_SKILLS.length})`}</button>)}
                    </div>
                  </div>
                  <Sparkles className="size-5 text-primary" />
                </div>
                <div className="@container"><div className="grid gap-3 transition-all duration-300 @sm:grid-cols-2 @[33rem]:grid-cols-3">
                  {skillView === "suggested"
                    ? recommendations.map((skill) => <SkillCard key={skill.key} skill={skill} accessMode={getSkillAccessMode(skill, policy.skill_access)} locale={locale} selected={selectedSkills.includes(skill.key)} onToggle={() => toggleSkill(skill.key)} labelAdd={c.add} labelAdded={c.added} />)
                    : allSkills.map(({ skill, access }) => <SkillCard key={skill.key} skill={skill} accessMode={access} locale={locale} selected={selectedSkills.includes(skill.key)} onToggle={() => access === "self_service" && toggleSkill(skill.key)} labelAdd={c.add} labelAdded={c.added} />)}
                </div></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedSkills.map((key) => {
                    const skill = MAAROOF_SKILLS.find((item) => item.key === key);
                    return skill ? <button key={key} type="button" onClick={() => toggleSkill(key)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary">{skill.label[locale]} <X className="size-3" /></button> : null;
                  })}
                  {selectedSkills.length === 0 && <p className="text-xs text-muted-foreground">{c.automatic}</p>}
                </div>
                {tools.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{c.selectedTools}: {tools.map(toolLabel).join("، ")}</p>}
              </div>
              <AttachmentAnalyzer lang={locale} onResult={(text) => setGoal((g) => (g ? g + "\n\n" : "") + (locale === "en" ? "Attached file analysis:\n" : "تحليل الملف المرفق:\n") + text.slice(0, 1500))} />
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
            <aside className="order-2 space-y-3 lg:order-none lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl border border-border bg-card p-4">
                <h2 className="flex items-center gap-2 font-semibold">{c.costEstimate} <HelpTip id="cost" lang={locale} /></h2>
                {(() => { const w = taskWeight(Math.max(1, selectedSkills.length || 3), liveProbe ? 10 : 1); const lbl = { light: { ar: "خفيفة", en: "Light", ku: "سووک" }, medium: { ar: "متوسطة", en: "Medium", ku: "مامناوەند" }, deep: { ar: "عميقة", en: "Deep", ku: "قووڵ" } }[w][locale]; const pct = w === "light" ? 33 : w === "medium" ? 66 : 100; return (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">{locale === "en" ? "Task weight" : locale === "ku" ? "قورسایی ئەرک" : "وزن المهمة"}</span><span className="font-semibold">{lbl}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                  </div>); })()}
                {costLoading ? <p className="mt-2 text-xs text-muted-foreground">{locale === "en" ? "Calculating…" : locale === "ku" ? "خەمڵاندن…" : "جارٍ الحساب…"}</p> : costRun ? <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{c.mode}</span><span className="font-semibold tabular-nums">{costRun.total} {c.tokens}</span></div>
                  {costProbe && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{c.probeCost} ({costProbe.units})</span><span className="font-semibold tabular-nums">{costProbe.total} {c.tokens}</span></div>}
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-2"><span className="font-medium">{c.balance}</span><span className="tabular-nums">{costRun.balance} {c.tokens}</span></div>
                  {costRun.metered && !estimateFitsQuota && <p role="alert" className="text-xs text-destructive">{locale === "en" ? "The estimated session and live-check cost exceeds your current balance or remaining quota." : locale === "ku" ? "تێچووی خەمڵێنراو لە باڵانس یان سنووری ماوە زیاترە." : "التكلفة التقديرية للجلسة والفحص تتجاوز الرصيد أو الحصة المتبقية."}</p>}
                  {costRun.dailyRemaining != null && <p className="text-xs text-muted-foreground">{locale === "en" ? "Daily quota remaining" : locale === "ku" ? "سنووری ڕۆژانەی ماوە" : "المتبقي من الحصة اليومية"}: {costRun.dailyRemaining} {c.tokens}</p>}
                  {costRun.monthlyRemaining != null && <p className="text-xs text-muted-foreground">{locale === "en" ? "Monthly quota remaining" : locale === "ku" ? "سنووری مانگانەی ماوە" : "المتبقي من الحصة الشهرية"}: {costRun.monthlyRemaining} {c.tokens}</p>}
                  <p className="text-xs leading-5 text-muted-foreground">{c.toolCostNote}</p>
                </div> : <p className="mt-2 text-xs text-muted-foreground">{c.ask}</p>}
              </div>
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

            {(running || events.length > 0) && <LivePipeline events={events} running={running} lang={locale as any} />}

            {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}

            <DebateCard data={[...events].reverse().find((e: any) => e.type === "debate")?.data} locale={locale} />
            {finalEvent && <div className="rounded-2xl border border-primary/25 bg-card p-5 md:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-primary"><FileText className="size-5" /><h2 className="font-semibold">{c.result}</h2></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { const reportText = String(finalEvent.data?.text || finalEvent.data?.message || c.noResults); setReportGoalSnapshot(goal.trim()); setGoal(buildTaskGoalFromResult({ language: locale === "en" || locale === "ku" ? locale : "ar", originalRequest: goal.trim(), answer: reportText })); setMode("execution"); setPendingApproved(""); setResumeFrom(null); setError(""); setReportTaskDraft(true); setShowAdvanced(true); window.setTimeout(() => document.getElementById("workspace-goal")?.focus(), 60); }} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"><ListChecks className="size-3.5" />{locale === "en" ? "Turn report into task" : locale === "ku" ? "ڕاپۆرت بکە بە ئەرک" : "حوّل التقرير إلى مهمة"}</button><ExportButtons toolKey="maaroof" build={() => buildTaskExportPayload({ title: c.result, goal: reportTaskDraft && reportGoalSnapshot ? reportGoalSnapshot : goal.trim(), finalText: String(finalEvent.data?.text || finalEvent.data?.message || ""), results: events.filter((e) => e.type === "tool_result").map((e) => ({ tool: String(e.data?.tool || ""), ok: e.data?.ok !== false, output: e.data?.output })), lang: (locale === "en" || locale === "ku" ? locale : "ar") as any })} /></div></div>
              <AssistantMessage content={String(finalEvent.data?.text || finalEvent.data?.message || c.noResults)} lang={locale === "en" || locale === "ku" ? locale : "ar"} />
              {domainsInText(String(finalEvent.data?.text || "")).length > 0 && <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-2 text-muted-foreground">{locale === "en" ? "Want Maaroof to read one of these pages to understand it better? It opens only after you grant temporary read-only access." : locale === "ku" ? "دەتەوێت معروف ئەم پەڕانە بخوێنێتەوە؟ تەنها دوای ڕێگەپێدانت." : "هل تريد أن يقرأ معروف إحدى هذه الصفحات لفهمها أكثر؟ لا يبدأ إلا بعد تفويضك المؤقت للقراءة فقط."}</p>
                <div className="flex flex-wrap gap-2">{domainsInText(String(finalEvent.data?.text || "")).map((d) => <button key={d} onClick={() => navigate({ to: "/workspace", search: { tab: "browser", domain: d } })} className="rounded-full border border-primary/40 px-3 py-1 text-primary">{d}</button>)}</div>
              </div>}
            </div>}

            {!finalEvent && !running && !error && <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{c.noResults}</div>}

            {skillAsk.length > 0 && !running && (
              <div className="rounded-2xl border border-primary/30 bg-card p-4">
                <p className="mb-3 font-semibold">{locale === "en" ? "Your task doesn't say which skill fits. Which one do you want?" : locale === "ku" ? "ئەرکەکە ڕوون ناکاتەوە کام توانا گونجاوە. کامیان دەتەوێت؟" : "لم توضّح المهمة المهارة المناسبة. أيّها تريد؟"}</p>
                <div className="flex flex-wrap gap-2">{skillAsk.map((k) => { const sk = MAAROOF_SKILLS.find((x) => x.key === k); return sk ? <button key={k} type="button" onClick={() => { setSelectedSkills([k]); void start(undefined, [k]); }} className="rounded-full border border-primary/40 px-3 py-1.5 text-sm text-primary hover:bg-primary/10">{sk.label[locale]}</button> : null; })}</div>
              </div>
            )}
            {clarifyEvents.length > 0 && !running && (
              <form className="rounded-2xl border border-primary/30 bg-card p-4" onSubmit={(event) => { event.preventDefault(); if (clarifyField && clarification.trim()) void start({ [clarifyField]: clarification.trim() }); }}>
                <label className="mb-2 block font-semibold">{c.clarify}</label>
                <input value={clarification} onChange={(event) => setClarification(event.target.value)} placeholder={c.answerPlaceholder} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <button type="submit" disabled={!clarification.trim()} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{c.sendAnswer}</button>
              </form>
            )}

            <div className="rounded-2xl border border-border bg-card p-4">
              <button type="button" onClick={() => setShowActivity((show) => !show)} className="flex w-full items-center justify-between gap-2 text-start font-semibold">
                <span className="flex items-center gap-2"><Clock3 className="size-4" />{c.activity} ({phaseEvents.length + toolEvents.length}){events.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground" aria-label="elapsed">{formatElapsed((running ? nowTick : events[events.length - 1].at) - events[0].at)}</span>}</span>
                <ChevronDown className={`size-4 transition-transform ${showActivity ? "rotate-180" : ""}`} />
              </button>
              {showActivity && <div className="mt-4 space-y-2">
                {events.filter((event) => ["phase", "tool_call", "tool_result", "error", "clarify", "done"].includes(event.type)).map((event, index) => (
                  <div key={`${event.at}-${index}`} className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
                    <span className="mt-0.5 shrink-0"><PulseBadge label="" state={isIntentionalSkip(event.data) ? "skipped" : event.type === "error" || event.data?.ok === false ? "failed" : event.type === "tool_result" || event.type === "done" ? "done" : running && index === events.length - 1 ? "running" : "done"} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold"><span>{event.type === "phase" ? c.phase : event.type === "tool_call" ? c.toolStarted : event.type === "tool_result" ? (isIntentionalSkip(event.data) ? c.skipped : c.toolDone) : event.type === "clarify" ? c.clarify : event.type === "error" ? c.failed : c.unknown}{event.data?.tool ? ` · ${toolLabel(event.data.tool)}` : ""}</span><span className="shrink-0 font-mono font-normal tabular-nums text-muted-foreground">+{formatElapsed(event.at - events[0].at)}</span></div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{eventSummary(event)}</div>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          </section>
        )}
      </main>
      </WorkspaceShell>
    </div>
  );
}

function SkillCard({ skill, accessMode, locale, selected, onToggle, labelAdd, labelAdded }: {
  skill: MaaroofSkill; accessMode: "self_service" | "contact" | "disabled"; locale: SkillLocale; selected: boolean; onToggle: () => void; labelAdd: string; labelAdded: string;
}) {
  const Icon = SKILL_ICONS[skill.icon];
  if (accessMode === "disabled") {
    return (
      <div className="flex h-full items-start gap-3 rounded-xl border border-dashed border-border p-4 opacity-70">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">{skill.label[locale]}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{skill.description[locale]}</span><span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px]">{locale === "en" ? "Not enabled on your account" : locale === "ku" ? "بۆ هەژمارەکەت چالاک نییە" : "غير مفعّلة لحسابك"}</span></span>
      </div>
    );
  }
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
    <div onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`); }} className={`rb-workspace-skill rb-spotlight group flex h-full items-start gap-3 rounded-xl border p-4 text-start transition ${selected ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{skill.label[locale]}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{skill.description[locale]}</span>
        <SkillDetails skill={skill} locale={locale} />
        <button type="button" onClick={onToggle} aria-pressed={selected} className={`mt-3 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${selected ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}{selected ? labelAdded : labelAdd}</button>
      </span>
    </div>
  );
}

function SkillDetails({ skill, locale }: { skill: MaaroofSkill; locale: SkillLocale }) {
  const f = skillFramework(skill, locale);
  const L = (ar: string, en: string, ku: string) => (locale === "en" ? en : locale === "ku" ? ku : ar);
  const rows: [string, string][] = [[L("الهدف", "Goal", "ئامانج"), f.goal], [L("المصادر", "Sources", "سەرچاوە"), f.sources], [L("الخطة", "Plan", "پلان"), f.plan], [L("الكلفة", "Cost", "تێچوو"), f.cost], [L("الأدلة", "Evidence", "بەڵگە"), f.evidence], [L("النتيجة", "Output", "ئەنجام"), f.output], [L("الخطوة التالية", "Next step", "هەنگاوی داهاتوو"), f.nextStep]];
  return (
    <details className="mt-2 text-[11px] leading-4 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
      <summary className="cursor-pointer font-semibold text-primary">{L("تفاصيل", "Details", "وردەکاری")}</summary>
      <dl className="mt-1 space-y-1">{rows.map(([k, v]) => <div key={k}><dt className="inline font-semibold text-foreground">{k}: </dt><dd className="inline">{v}</dd></div>)}</dl>
    </details>
  );
}


