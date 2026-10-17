import { useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Clock3,
  LoaderCircle,
  MessageSquareText,
  Pause,
  Play,
  RefreshCw,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  INTERVIEW_DOMAINS,
  INTERVIEW_TARGET_TYPES,
  type InterviewAnswerStatus,
  type InterviewDomain,
  type InterviewLocale,
  type InterviewProgress,
  type InterviewQuestion,
  type InterviewState,
  type InterviewTargetType,
} from "@/lib/maaroof/interview-engine";

type Locale = "ar" | "en" | "ku";
type WorkspaceOption = { id: string; name: string; kind: string };
type InterviewSummary = {
  id: string;
  workspace_id: string | null;
  target_type: InterviewTargetType;
  target_name: string;
  domains: InterviewDomain[];
  locale: InterviewLocale;
  status: string;
  version: number;
  updated_at: string;
};
type InterviewSession = InterviewSummary & {
  user_id: string;
  initial_goal: string | null;
  questions_snapshot: InterviewQuestion[];
  state: InterviewState;
  current_question_id: string | null;
  completed_at: string | null;
  created_at: string;
};
type InterviewApiResponse = {
  interview?: InterviewSession;
  interviews?: InterviewSummary[];
  next_question?: InterviewQuestion | null;
  progress?: InterviewProgress;
  data_complete?: boolean;
  error?: string;
  current_version?: number;
};

const TARGET_LABELS: Record<InterviewTargetType, Record<Locale, string>> = {
  individual: { ar: "مستخدم فردي", en: "Individual", ku: "بەکارهێنەری تاک" },
  creator: { ar: "صانع محتوى", en: "Content creator", ku: "دروستکەری ناوەڕۆک" },
  company: { ar: "شركة", en: "Company", ku: "کۆمپانیا" },
  agency: { ar: "وكالة", en: "Agency", ku: "ئاژانس" },
  client: { ar: "عميل", en: "Client", ku: "کڕیار" },
  brand: { ar: "علامة تجارية", en: "Brand", ku: "براند" },
  project: { ar: "مشروع", en: "Project", ku: "پڕۆژە" },
  task: { ar: "مهمة", en: "Task", ku: "ئەرک" },
};

const DOMAIN_LABELS: Record<InterviewDomain, Record<Locale, string>> = {
  general: { ar: "عام", en: "General", ku: "گشتی" },
  seo: { ar: "SEO", en: "SEO", ku: "SEO" },
  aeo: { ar: "AEO", en: "AEO", ku: "AEO" },
  geo: { ar: "GEO", en: "GEO", ku: "GEO" },
  gseo: { ar: "GSEO", en: "GSEO", ku: "GSEO" },
};

const COPY: Record<Locale, Record<string, string>> = {
  ar: {
    title: "المقابلات والأسئلة الذكية",
    subtitle: "مقابلة حسب نوع الجهة والمهمة. تُحفظ الإجابات ويمكن متابعة الجلسة لاحقاً.",
    open: "فتح المقابلات",
    close: "إخفاء المقابلات",
    target: "نوع الجهة أو الهدف",
    targetName: "اسم الجهة أو العلامة أو المشروع",
    targetNameHint: "مثال: شركة معروف أو عميل الوكالة",
    workspace: "مساحة العمل (اختياري)",
    personalWorkspace: "مقابلة شخصية",
    domains: "مجالات العمل",
    domainHint: "اختر مجالاً أو أكثر للمقابلة.",
    start: "بدء مقابلة جديدة",
    starting: "جارٍ إنشاء المقابلة...",
    current: "السؤال الحالي",
    previous: "الإجابات السابقة",
    answer: "إجابتك",
    answerPlaceholder: "اكتب إجابتك...",
    send: "حفظ الإجابة والمتابعة",
    skip: "تخطي السؤال",
    unknown: "لا أعرف حالياً",
    pause: "حفظ ومتابعة لاحقاً",
    finish: "إنهاء المقابلة",
    resume: "فتح / متابعة",
    loading: "جارٍ التحميل...",
    saved: "المقابلات المحفوظة",
    noSessions: "لا توجد مقابلات محفوظة بعد.",
    progress: "تقدم الإجابات",
    done: "اكتملت المقابلة",
    missingData: "انتهت المقابلة، لكن بقيت معلومات مطلوبة بلا إجابة مؤكدة. ستظل فجوات البيانات واضحة.",
    completeData: "تمت الإجابة عن الأسئلة المطلوبة.",
    paused: "متوقفة مؤقتاً",
    in_progress: "قيد التنفيذ",
    completed: "مكتملة",
    abandoned: "مؤرشفة",
    auth: "انتهت جلسة الدخول. سجّل الدخول ثم حاول مجدداً.",
    genericError: "تعذر تنفيذ العملية. تحقق من الاتصال وصلاحياتك، ثم حاول مجدداً.",
    storageError: "تعذر قراءة جلسات المقابلة. تحقق من تهيئة ترحيل قاعدة البيانات في بيئة الاختبار.",
    nameRequired: "أدخل اسماً للجهة أو المشروع قبل بدء المقابلة.",
    requiredAnswer: "أدخل إجابتك قبل المتابعة.",
    selectWorkspaceHint: "اختر مساحة عمل لربط المقابلة بالوكالة أو الشركة. من دونها تحفظ الجلسة في حسابك الشخصي.",
    ownerRequired: "تحتاج إلى صلاحية مالك أو محرر في مساحة العمل المحددة.",
    details: "تحديث القائمة",
    count: "إجابة",
  },
  en: {
    title: "Guided interviews",
    subtitle: "Context-aware interviews. Answers are saved so you can resume later.",
    open: "Open interviews",
    close: "Hide interviews",
    target: "Entity or target type",
    targetName: "Entity, brand, or project name",
    targetNameHint: "Example: Maaroof company or an agency client",
    workspace: "Workspace (optional)",
    personalWorkspace: "Personal interview",
    domains: "Workstreams",
    domainHint: "Choose one or more workstreams.",
    start: "Start new interview",
    starting: "Creating interview...",
    current: "Current question",
    previous: "Previous answers",
    answer: "Your answer",
    answerPlaceholder: "Enter your answer...",
    send: "Save answer and continue",
    skip: "Skip question",
    unknown: "I don't know yet",
    pause: "Save and continue later",
    finish: "Finish interview",
    resume: "Open / resume",
    loading: "Loading...",
    saved: "Saved interviews",
    noSessions: "No saved interviews yet.",
    progress: "Answer progress",
    done: "Interview completed",
    missingData: "The interview ended with required information still missing. Those data gaps remain visible.",
    completeData: "All required questions have been answered.",
    paused: "Paused",
    in_progress: "In progress",
    completed: "Completed",
    abandoned: "Archived",
    auth: "Your sign-in session expired. Sign in and try again.",
    genericError: "The operation failed. Check your connection and access, then try again.",
    storageError: "Could not load interviews. Verify that the database migration is applied in the test environment.",
    nameRequired: "Enter an entity or project name before starting.",
    requiredAnswer: "Enter an answer before continuing.",
    selectWorkspaceHint: "Select a workspace to associate this interview with a company or agency. Otherwise, it stays in your personal account.",
    ownerRequired: "You need an editor or owner role for that workspace.",
    details: "Refresh list",
    count: "answers",
  },
  ku: {
    title: "چاوپێکەوتنە ڕێنماییکراوەکان",
    subtitle: "چاوپێکەوتن بەپێی لایەن و ئامانج. وەڵامەکان دەپارێزرێن و دواتر دەتوانیت بەردەوام بیت.",
    open: "کردنەوەی چاوپێکەوتنەکان",
    close: "شاردنەوەی چاوپێکەوتنەکان",
    target: "جۆری لایەن یان ئامانج",
    targetName: "ناوی لایەن یان پڕۆژە",
    targetNameHint: "نموونە: کۆمپانیای معروف یان کڕیاری ئاژانس",
    workspace: "شوێنی کار (ئارەزوومەندانە)",
    personalWorkspace: "چاوپێکەوتنی کەسی",
    domains: "بوارەکانی کار",
    domainHint: "یەک یان زیاتر لە بوارەکان هەڵبژێرە.",
    start: "دەستپێکردنی چاوپێکەوتنی نوێ",
    starting: "چاوپێکەوتن دروست دەکرێت...",
    current: "پرسیاری ئێستا",
    previous: "وەڵامەکانی پێشوو",
    answer: "وەڵامەکەت",
    answerPlaceholder: "وەڵامەکەت بنووسە...",
    send: "پاشەکەوتکردن و بەردەوامبوون",
    skip: "بازدان لە پرسیار",
    unknown: "هێشتا نازانم",
    pause: "پاشەکەوتکردن بۆ دواتر",
    finish: "تەواوکردنی چاوپێکەوتن",
    resume: "کردنەوە / بەردەوامبوون",
    loading: "بارکردن...",
    saved: "چاوپێکەوتنە پاشەکەوتکراوەکان",
    noSessions: "هێشتا چاوپێکەوتنی پاشەکەوتکراو نییە.",
    progress: "پێشکەوتنی وەڵامەکان",
    done: "چاوپێکەوتن تەواو بوو",
    missingData: "چاوپێکەوتن تەواو بوو، بەڵام هێشتا زانیاریی پێویست نەزانراوە. بۆشاییەکان دیار دەمێننەوە.",
    completeData: "هەموو پرسیارە پێویستەکان وەڵام دراون.",
    paused: "وەستاوە بۆ کاتێکی تر",
    in_progress: "لە جێبەجێکردندایە",
    completed: "تەواوبوو",
    abandoned: "ئەرشیفکراو",
    auth: "دانیشتنی چوونەژوورەوە کۆتایی هاتووە. دووبارە بچۆ ژوورەوە.",
    genericError: "کارەکە سەرکەوتوو نەبوو. پەیوەندی و دەسەڵاتەکان بپشکنە و دووبارە هەوڵ بدەوە.",
    storageError: "نەتوانرا چاوپێکەوتنەکان بخوێنرێنەوە. دڵنیابە لە جێبەجێکردنی migration لە تاقیگە.",
    nameRequired: "پێش دەستپێکردن ناوی لایەن یان پڕۆژە بنووسە.",
    requiredAnswer: "پێش بەردەوامبوون وەڵام بنووسە.",
    selectWorkspaceHint: "شوێنی کاری هەڵبژێرە بۆ بەستنی چاوپێکەوتن بە ئاژانس یان کۆمپانیا؛ ئەگەر نەهەڵبژێریت لە هەژماری کەسیت دەپارێزرێت.",
    ownerRequired: "بۆ ئەو شوێنی کارە دەسەڵاتی دەستکاریکەر یان خاوەنت پێویستە.",
    details: "نوێکردنەوەی لیست",
    count: "وەڵام",
  },
};

function text(locale: Locale, key: string): string {
  return COPY[locale][key] || COPY.ar.genericError;
}

function apiError(locale: Locale, code: string | undefined): string {
  if (code === "auth_required") return text(locale, "auth");
  if (code === "interview_list_failed" || code === "interview_lookup_failed") {
    return text(locale, "storageError");
  }
  if (code === "workspace_access_denied") return text(locale, "ownerRequired");
  return text(locale, "genericError");
}

export function InterviewPanel({
  locale,
  userId,
  initialGoal,
  getAccessToken,
}: {
  locale: Locale;
  userId: string;
  initialGoal: string;
  getAccessToken: () => Promise<string | null>;
}) {
  const c = (key: string) => text(locale, key);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<InterviewSummary[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [targetType, setTargetType] = useState<InterviewTargetType>("individual");
  const [targetName, setTargetName] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [domains, setDomains] = useState<InterviewDomain[]>(["general"]);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [nextQuestion, setNextQuestion] = useState<InterviewQuestion | null>(null);
  const [progress, setProgress] = useState<InterviewProgress | null>(null);
  const [dataComplete, setDataComplete] = useState(false);
  const [answer, setAnswer] = useState("");

  async function tokenOrThrow(): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("auth_required");
    return token;
  }

  async function loadSessions() {
    setLoadingList(true);
    try {
      const token = await tokenOrThrow();
      const response = await fetch("/api/maaroof-interviews", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({})) as InterviewApiResponse;
      if (!response.ok) throw new Error(body.error || "interview_list_failed");
      setSessions(Array.isArray(body.interviews) ? body.interviews : []);
    } catch (e) {
      setError(apiError(locale, e instanceof Error ? e.message : undefined));
    } finally {
      setLoadingList(false);
    }
  }

  async function loadWorkspaces() {
    setLoadingWorkspaces(true);
    try {
      const [{ data: owned, error: ownError }, { data: memberships, error: memberError }] = await Promise.all([
        supabase.from("workspaces").select("id,name,kind").eq("owner_id", userId),
        supabase.from("workspace_members").select("workspace_id,role").eq("user_id", userId),
      ]);
      if (ownError) throw ownError;

      const ids = new Set<string>((owned || []).map((workspace) => workspace.id));
      if (!memberError) {
        for (const row of memberships || []) {
          if (row.role === "owner" || row.role === "editor") ids.add(row.workspace_id);
        }
      }

      let sharedRows: WorkspaceOption[] = [];
      if (ids.size > 0) {
        const { data, error: sharedError } = await supabase
          .from("workspaces").select("id,name,kind").in("id", [...ids]);
        if (sharedError) throw sharedError;
        sharedRows = data || [];
      }

      const unique = new Map<string, WorkspaceOption>();
      for (const item of [...(owned || []), ...sharedRows]) unique.set(item.id, item);
      setWorkspaces([...unique.values()].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setWorkspaces([]);
    } finally {
      setLoadingWorkspaces(false);
    }
  }

  async function openPanel() {
    const next = !open;
    setOpen(next);
    setError("");
    if (next) await Promise.all([loadSessions(), loadWorkspaces()]);
  }

  async function startInterview() {
    if (busy) return;
    if (!targetName.trim()) {
      setError(c("nameRequired"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const token = await tokenOrThrow();
      const response = await fetch("/api/maaroof-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          target_type: targetType,
          target_name: targetName.trim(),
          domains,
          locale,
          goal: initialGoal.trim() || undefined,
          workspace_id: workspaceId || null,
        }),
      });
      const body = await response.json().catch(() => ({})) as InterviewApiResponse;
      if (!response.ok || !body.interview) throw new Error(body.error || "interview_create_failed");
      setSession(body.interview);
      setNextQuestion(body.next_question || null);
      setProgress(body.progress || null);
      setDataComplete(false);
      setAnswer("");
      await loadSessions();
    } catch (e) {
      setError(apiError(locale, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function openSession(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await tokenOrThrow();
      const response = await fetch("/api/maaroof-interviews?id=" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      let body = await response.json().catch(() => ({})) as InterviewApiResponse;
      if (!response.ok || !body.interview) throw new Error(body.error || "interview_lookup_failed");

      if (body.interview.status === "paused" || body.interview.status === "abandoned") {
        const resumed = await fetch("/api/maaroof-interviews", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({
            id,
            expected_version: body.interview.version,
            action: "status",
            status: "in_progress",
          }),
        });
        const resumedBody = await resumed.json().catch(() => ({})) as InterviewApiResponse;
        if (!resumed.ok || !resumedBody.interview) {
          throw new Error(resumedBody.error || "interview_resume_failed");
        }
        body = resumedBody;
      }

      setSession(body.interview);
      setNextQuestion(body.next_question || null);
      setProgress(body.progress || null);
      setDataComplete(body.data_complete === true);
      setAnswer("");
    } catch (e) {
      setError(apiError(locale, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(status: InterviewAnswerStatus) {
    if (!session || !nextQuestion || busy) return;
    if (status === "answered" && !answer.trim()) {
      setError(c("requiredAnswer"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const token = await tokenOrThrow();
      const response = await fetch("/api/maaroof-interviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          id: session.id,
          expected_version: session.version,
          action: "answer",
          answer: {
            questionId: nextQuestion.id,
            status,
            ...(status === "answered" ? { value: answer.trim() } : {}),
          },
        }),
      });
      const body = await response.json().catch(() => ({})) as InterviewApiResponse;
      if (!response.ok || !body.interview) throw new Error(body.error || "interview_update_failed");
      setSession(body.interview);
      setNextQuestion(body.next_question || null);
      setProgress(body.progress || null);
      setDataComplete(body.data_complete === true);
      setAnswer("");
      await loadSessions();
    } catch (e) {
      setError(apiError(locale, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: "paused" | "completed") {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await tokenOrThrow();
      const response = await fetch("/api/maaroof-interviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          id: session.id,
          expected_version: session.version,
          action: "status",
          status,
        }),
      });
      const body = await response.json().catch(() => ({})) as InterviewApiResponse;
      if (!response.ok || !body.interview) throw new Error(body.error || "interview_update_failed");

      if (status === "paused") {
        setSession(null);
        setNextQuestion(null);
        setProgress(null);
        setDataComplete(false);
        setAnswer("");
      } else {
        setSession(body.interview);
        setNextQuestion(body.next_question || null);
        setProgress(body.progress || null);
        setDataComplete(body.data_complete === true);
      }
      await loadSessions();
    } catch (e) {
      setError(apiError(locale, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  function toggleDomain(domain: InterviewDomain) {
    setDomains((current) => {
      if (domain === "general") return ["general"];
      const next = current.includes(domain)
        ? current.filter((item) => item !== domain && item !== "general")
        : [...current.filter((item) => item !== "general"), domain];
      return next.length ? next : ["general"];
    });
  }

  const direction = locale === "en" ? "ltr" : "rtl";
  const selectedAnswerCount = session
    ? Object.values(session.state.answers).filter((item) => item.status === "answered").length
    : 0;

  return (
    <section dir={direction} className="mb-7 overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => void openPanel()}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-start md:p-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquareText className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{c("title")}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{c("subtitle")}</span>
        </span>
        <span className="hidden rounded-full border border-border px-2.5 py-1 text-xs sm:inline-flex">
          {open ? c("close") : c("open")}
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border p-4 md:p-5">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!session ? (
            <div className="grid gap-4 rounded-xl border border-border p-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{c("target")}</label>
                  <select
                    value={targetType}
                    onChange={(event) => setTargetType(event.target.value as InterviewTargetType)}
                    disabled={busy}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    {INTERVIEW_TARGET_TYPES.map((type) => (
                      <option key={type} value={type}>{TARGET_LABELS[type][locale]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{c("targetName")}</label>
                  <input
                    value={targetName}
                    onChange={(event) => setTargetName(event.target.value)}
                    maxLength={200}
                    placeholder={c("targetNameHint")}
                    disabled={busy}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{c("workspace")}</label>
                  <select
                    value={workspaceId}
                    onChange={(event) => setWorkspaceId(event.target.value)}
                    disabled={busy || loadingWorkspaces}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    <option value="">{c("personalWorkspace")}</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name} · {workspace.kind}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted-foreground">{c("selectWorkspaceHint")}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-sm font-medium">{c("domains")}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{c("domainHint")}</p>
                  <div className="flex flex-wrap gap-2">
                    {INTERVIEW_DOMAINS.map((domain) => {
                      const selected = domains.includes(domain);
                      return (
                        <button
                          key={domain}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleDomain(domain)}
                          disabled={busy}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:bg-muted/40"}`}
                        >
                          {DOMAIN_LABELS[domain][locale]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {initialGoal.trim() && (
                    <p className="max-w-md text-xs text-muted-foreground">
                      {locale === "en"
                        ? "The current workspace goal will be used as the interview objective."
                        : locale === "ku"
                          ? "ئامانجی ئێستای شوێنی کار وەک ئامانجی چاوپێکەوتن بەکاردێت."
                          : "سيُستخدم الهدف المكتوب في مساحة العمل بوصفه هدف المقابلة."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void startInterview()}
                    disabled={busy || !targetName.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
                    {busy ? c("starting") : c("start")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{session.target_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {TARGET_LABELS[session.target_type]?.[locale] || session.target_type} · {session.domains.map((domain) => DOMAIN_LABELS[domain][locale]).join(" · ")}
                  </p>
                  {session.workspace_id && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {workspaces.find((workspace) => workspace.id === session.workspace_id)?.name || c("workspace")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {session.status !== "completed" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus("paused")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"
                    >
                      <Pause className="size-3.5" />{c("pause")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => { setSession(null); setNextQuestion(null); setProgress(null); setDataComplete(false); setAnswer(""); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"
                  >
                    <RefreshCw className="size-3.5" />{c("start")}
                  </button>
                </div>
              </div>

              {progress && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{c("progress")}</span>
                    <span>{progress.requiredAnswered}/{progress.requiredTotal}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.completionPercent}%` }} />
                  </div>
                </div>
              )}

              {nextQuestion ? (
                <form
                  className="rounded-xl border border-primary/25 bg-primary/[0.025] p-4"
                  onSubmit={(event) => { event.preventDefault(); void submitAnswer("answered"); }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{c("current")}</p>
                  <h3 className="mt-2 text-base font-semibold leading-7">{nextQuestion.prompt[locale] || nextQuestion.prompt.ar}</h3>
                  <label className="mb-1.5 mt-4 block text-sm font-medium">{c("answer")}</label>
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    rows={3}
                    maxLength={10000}
                    placeholder={c("answerPlaceholder")}
                    disabled={busy}
                    className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="submit" disabled={busy || !answer.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{c("send")}
                    </button>
                    {nextQuestion.canSkip !== false && (
                      <button type="button" disabled={busy} onClick={() => void submitAnswer("skipped")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
                        {c("skip")}
                      </button>
                    )}
                    {nextQuestion.allowUnknown !== false && (
                      <button type="button" disabled={busy} onClick={() => void submitAnswer("unknown")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
                        <CircleHelp className="size-4" />{c("unknown")}
                      </button>
                    )}
                  </div>
                </form>
              ) : session.status === "completed" ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 font-semibold"><Check className="size-4" />{c("done")}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{dataComplete ? c("completeData") : c("missingData")}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border p-4">
                  <p className="font-semibold">{c("previous")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {locale === "en"
                      ? "Required questions have been handled. Finish to save this interview as completed."
                      : locale === "ku"
                        ? "پرسیارە پێویستەکان مامەڵەیان لەگەڵ کرا. بۆ تەواوکردن، چاوپێکەوتنەکە کۆتایی پێبهێنە."
                        : "تم التعامل مع الأسئلة المطلوبة. أنهِ المقابلة لحفظها بالحالة النهائية."}
                  </p>
                  <button type="button" onClick={() => void updateStatus("completed")} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{c("finish")}
                  </button>
                </div>
              )}

              {session.questions_snapshot.some((question) => session.state.answers[question.id]) && (
                <details className="rounded-xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {c("previous")} ({selectedAnswerCount} {c("count")})
                  </summary>
                  <div className="mt-3 space-y-3">
                    {session.questions_snapshot.map((question) => {
                      const record = session.state.answers[question.id];
                      if (!record) return null;
                      const response = record.status === "answered"
                        ? String(Array.isArray(record.value) ? record.value.join(", ") : record.value ?? "")
                        : record.status === "skipped"
                          ? c("skip")
                          : c("unknown");
                      return (
                        <div key={question.id} className="border-s-2 border-border ps-3">
                          <p className="text-sm font-medium">{question.prompt[locale] || question.prompt.ar}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{response}</p>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">{c("saved")}</h3>
              <button type="button" onClick={() => void loadSessions()} disabled={loadingList || busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50">
                {loadingList ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}{c("details")}
              </button>
            </div>
            {loadingList ? (
              <p className="text-sm text-muted-foreground">{c("loading")}</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c("noSessions")}</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {sessions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void openSession(item.id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-start transition hover:bg-muted/30 disabled:opacity-50 ${session?.id === item.id ? "border-primary/40 bg-primary/5" : "border-border"}`}
                  >
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.target_name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {TARGET_LABELS[item.target_type]?.[locale] || item.target_type} · {c(item.status)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Date(item.updated_at).toLocaleDateString(locale)}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-primary">{c("resume")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
