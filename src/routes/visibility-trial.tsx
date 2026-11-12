import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { computeFingerprint } from "@/lib/fingerprint";
import { AuthGate } from "@/components/AuthGate";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/visibility-trial")({
  head: () => ({
    meta: [
      { title: "Free AI Visibility Trial · MAAROOF Ai" },
      { name: "description", content: "Run a limited live AI visibility sample for a person or organization, with no website required." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => <I18nProvider><AuthProvider><VisibilityTrialPage /></AuthProvider></I18nProvider>,
});

type EngineResult = {
  engine: string; name: string; status: string; mentioned?: boolean | null;
  recommendation?: string; confidence?: string; summary?: string; discovery_answer?: string;
  evidence_basis?: string; strengths?: string[]; gaps?: string[];
  recommendations?: string[]; sources?: string[];
};
type TrialResult = {
  attempt_id: string;
  entity: { name: string; type: string; type_detection: string; category: string | null; market: string | null };
  sample: { planned_engines: number; answered_engines: number; blind_sample_count: number; has_blind_discovery: boolean; is_market_measurement: boolean; note: string };
  metrics: { mention_rate_percent: number | null; recommendation_rate_percent: number | null; blind_sample_count: number; answered_engines: number };
  engines: EngineResult[];
  generated_at: string;
  result_expires_at: string;
};
type Contact = { title?: string; message?: string; email?: string; phone?: string; whatsapp?: string; website?: string; channels?: Array<{ label?: string; url?: string }>; fallbackPath?: string };

const COPY = {
  ar: {
    eyebrow: "تجربة AI Visibility المجانية", title: "اكتشف كيف تظهر هويتك في إجابات الذكاء الاصطناعي",
    intro: "فحص مباشر محدود بثلاثة مسارات نموذجية مستقلة عند توافرها. لا تحتاج إلى موقع إلكتروني أو حسابات تواصل.",
    name: "اسم الشخص أو العلامة أو المؤسسة", nameHint: "اكتب الاسم المعروف الذي تريد فحصه.",
    type: "نوع الكيان", auto: "اكتشاف تلقائي", person: "شخص", org: "مؤسسة / علامة تجارية",
    category: "التخصص أو الفئة (اختياري)", description: "وصف مختصر (اختياري)", market: "السوق المستهدف (اختياري)",
    assets: "روابط رقمية (اختياري)", assetsHint: "يمكن تركها فارغة. ضع كل رابط في سطر منفصل.",
    start: "ابدأ التجربة المجانية", working: "جارٍ تنفيذ الفحص المباشر", auth: "سجّل الدخول للمتابعة",
    security: "يتم التحقق من الاتصال وأهلية التجربة قبل بدء الفحص. لا نستخدم إجابات فحوصات سابقة.",
    unavailable: "التجربة غير متاحة حالياً", unavailableText: "لم يتم التحقق من ثلاثة مسارات مستقلة أو من إعدادات الحماية. لم يبدأ الفحص ولم يُحتسب كاستخدام.", expiredText: "انتهت صلاحية هذا التقرير وحُذفت بياناته المؤقتة.",
    failed: "تعذر إكمال الفحص", retry: "أعد المحاولة بعد التحقق من الاتصال والإعدادات.", requestInProgress: "هذه المحاولة بدأت بالفعل. يمكنك استرجاع تقريرها مرة واحدة عند اكتمالها.",
    report: "تقرير الرؤية المحدود", mention: "معدل ذكر الكيان", recommend: "معدل التوصية", engines: "المسارات التي أجابت", noCategoryMeasurement: "لم تتوفر فئة محايدة لا تتضمن اسم الكيان؛ لذلك لم يُقَس الاكتشاف غير الموجّه أو الظهور العضوي.", discovery: "نتيجة الاكتشاف غير الموجّه", mentionStatus: "ذكر الكيان", recommendationStatus: "التوصية", confidenceStatus: "الثقة", yes: "نعم", no: "لا", conditional: "مشروطة", unknown: "غير محسوم",
    sample: "هذه عينة من ثلاث استجابات حية وليست قياساً شاملاً للسوق أو ترتيباً عاماً.",
    known: "ملخص الاستجابة", basis: "أساس الأدلة", strengths: "إشارات إيجابية", gaps: "المعلومات غير المحسومة", actions: "تحسينات مقترحة", sources: "روابط ذكرتها الاستجابة (غير متحققة مستقلاً)",
    retrieval: "استرجاع التقرير مرة واحدة", retrievalDone: "تم استخدام الاسترجاع الإضافي", expires: "تنتهي صلاحية التقرير", contact: "التواصل مع معروف",
    contactDesc: "تعذر فتح تجربة جديدة ضمن فترة الأهلية الحالية. يمكنك التواصل مع فريق معروف.",
    cooldown: "التجربة غير مؤهلة حالياً", retryAt: "موعد الأهلية التالي",
    noContact: "لم تُضبط قنوات التواصل الإضافية. استخدم صفحة التواصل الرسمية.",
    back: "العودة إلى الرئيسية", status: "الحالة", answered: "تمت الإجابة", error: "لم تصل إجابة",
    entityPerson: "شخص", entityOrg: "مؤسسة", entityUnknown: "غير محسوم",
  },
  en: {
    eyebrow: "Free AI Visibility Trial", title: "See how your identity appears in AI answers",
    intro: "A limited live sample across three independently configured model routes. No website or social accounts are required.",
    name: "Person, brand or organization name", nameHint: "Enter the name people use to identify this entity.",
    type: "Entity type", auto: "Detect automatically", person: "Person", org: "Organization / brand",
    category: "Sector or category (optional)", description: "Short description (optional)", market: "Target market (optional)",
    assets: "Digital links (optional)", assetsHint: "Leave empty if none. Enter one URL per line.",
    start: "Start free trial", working: "Running the live probe", auth: "Sign in to continue",
    security: "Connection and eligibility are checked before the probe starts. Previous probe answers are not reused.",
    unavailable: "Trial is temporarily unavailable", unavailableText: "Three independent routes or security services could not be verified. The probe did not start and was not counted.", expiredText: "This report has expired. Its temporary report data is no longer available.",
    failed: "The probe could not be completed", retry: "Retry after checking connection and configuration.", requestInProgress: "This request has already started. You can retrieve its report once after it finishes.",
    report: "Limited visibility report", mention: "Entity mention rate", recommend: "Recommendation rate", engines: "Routes that answered", noCategoryMeasurement: "No neutral category was supplied, or the category included the target name; unprompted discovery and organic visibility were not measured.", discovery: "Unprompted discovery response", mentionStatus: "Entity mention", recommendationStatus: "Recommendation", confidenceStatus: "Confidence", yes: "Yes", no: "No", conditional: "Conditional", unknown: "Unknown",
    sample: "This is a three-response live sample, not a market-wide measurement or general ranking.",
    known: "Response summary", basis: "Evidence basis", strengths: "Positive signals", gaps: "Unresolved information", actions: "Suggested improvements", sources: "URLs named in the response (not independently verified)",
    retrieval: "Retrieve report once", retrievalDone: "Additional retrieval used", expires: "Report expires", contact: "Contact MAAROOF",
    contactDesc: "A new trial is not eligible during the current access window. You can contact the MAAROOF team.",
    cooldown: "Trial is not eligible yet", retryAt: "Next eligible time",
    noContact: "No additional contact channels are configured. Use the official contact page.",
    back: "Back to home", status: "Status", answered: "Answered", error: "No answer",
    entityPerson: "Person", entityOrg: "Organization", entityUnknown: "Undetermined",
  },
  ku: {
    eyebrow: "تاقیکردنەوەی خۆڕایی AI Visibility", title: "بزانە ناسنامەکەت لە وەڵامە زیرەکەکاندا چۆن دەردەکەوێت",
    intro: "نموونەیەکی سنوورداری ڕاستەوخۆ لە سێ ڕێڕەوی مۆدێلی جیاواز. ماڵپەڕ یان هەژماری تۆڕی کۆمەڵایەتی پێویست نییە.",
    name: "ناوی کەس یان براند یان دامەزراوە", nameHint: "ئەو ناوە بنووسە کە خەڵک پێی دەناسن.",
    type: "جۆری قەوارە", auto: "دۆزینەوەی خۆکار", person: "کەس", org: "دامەزراوە / براند",
    category: "پسپۆڕی یان پۆل (ئارەزوومەندانە)", description: "پوختەیەکی کورت (ئارەزوومەندانە)", market: "بازاڕی ئامانج (ئارەزوومەندانە)",
    assets: "بەستەری دیجیتاڵ (ئارەزوومەندانە)", assetsHint: "ئەگەر نییە بەتاڵی بهێڵەوە. هەر بەستەرێک لە دێڕێکی جیاواز.",
    start: "دەستپێکردنی تاقیکردنەوە", working: "پشکنینی ڕاستەوخۆ ئەنجام دەدرێت", auth: "بچۆ ژوورەوە بۆ بەردەوامبوون",
    security: "پێش پشکنین پەیوەندی و شایستەیی پشتڕاست دەکرێتەوە. وەڵامی پشکنینی پێشووتر بەکارناهێنین.",
    unavailable: "تاقیکردنەوە ئێستا بەردەست نییە", unavailableText: "سێ ڕێڕەوی جیاواز یان خزمەتگوزاری پاراستن پشتڕاست نەکرایەوە. پشکنین دەستی پێنەکرد و حساب نەکرا.", expiredText: "ماوەی ئەم ڕاپۆرتە تەواو بووە و داتاکانی کاتی سڕاونەتەوە.",
    failed: "پشکنین تەواو نەبوو", retry: "دوای پشتڕاستکردنەوەی پەیوەندی و ڕێکخستنەکان دووبارە هەوڵ بدە.", requestInProgress: "ئەم داواکارییە دەستی پێکردووە. دوای تەواوبوونی دەتوانیت ڕاپۆرتەکە یەک جار وەربگریتەوە.",
    report: "ڕاپۆرتی سنوورداری دەرکەوتن", mention: "ڕێژەی باسکردنی قەوارە", recommend: "ڕێژەی پێشنیار", engines: "ڕێڕەوە وەڵامدەرەکان", noCategoryMeasurement: "پۆلێکی بێلایەن کە ناوی قەوارەکەی تێدا نەبێت بەردەست نەبوو؛ بۆیە دۆزینەوەی بێ ئاراستە و دەرکەوتنی سروشتی نەپیوراوە.", discovery: "وەڵامی دۆزینەوەی بێ ئاراستە", mentionStatus: "باسکردنی قەوارە", recommendationStatus: "پێشنیار", confidenceStatus: "متمانە", yes: "بەڵێ", no: "نەخێر", conditional: "بە مەرج", unknown: "نادیار",
    sample: "ئەمە نموونەیەکی سێ وەڵامی ڕاستەوخۆیە، نەک پێوانەی گشتی بازاڕ.",
    known: "پوختەی وەڵام", basis: "بنەمای بەڵگە", strengths: "نیشانە ئەرێنییەکان", gaps: "زانیاریی نادیار", actions: "باشترکردنی پێشنیارکراو", sources: "بەستەرە باسکراوەکان (بە سەربەخۆیی پشتڕاست نەکراونەتەوە)",
    retrieval: "وەرگرتنەوەی ڕاپۆرت یەک جار", retrievalDone: "وەرگرتنەوەی زیادە بەکارهاتووە", expires: "کۆتایی هاتنی ڕاپۆرت", contact: "پەیوەندی بە مەعروف",
    contactDesc: "لە ماوەی ئێستادا تاقیکردنەوەی نوێ شایستە نییە. دەتوانیت پەیوەندی بە تیمی مەعروفەوە بکەیت.",
    noContact: "هیچ ڕێگای پەیوەندیی زیادە ڕێکنەخراوە. پەڕەی فەرمی پەیوەندی بەکاربهێنە.",
    back: "گەڕانەوە بۆ سەرەتا", status: "دۆخ", answered: "وەڵام دراوە", error: "وەڵام نەگەیشت",
    retryAt: "کاتی شایستەبوونی داهاتوو", entityPerson: "کەس", entityOrg: "دامەزراوە", entityUnknown: "دیاری نەکراو",
  },
} as const;

async function trialPayloadSignature(value: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

function VisibilityTrialPage() {
  const { lang } = useI18n();
  const { user, session, loading } = useAuth();
  const l = lang === "ar" || lang === "ku" ? lang : "en";
  const c = COPY[l];
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<"auto" | "person" | "organization">("auto");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [market, setMarket] = useState("");
  const [assetsText, setAssetsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [result, setResult] = useState<TrialResult | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [retrievalUsed, setRetrievalUsed] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    let alive = true;
    void computeFingerprint().then((value) => { if (alive) setDeviceId(value); }).catch(() => {});
    try {
      let value = localStorage.getItem("maaroof_trial_session_v1");
      if (!value) { value = crypto.randomUUID(); localStorage.setItem("maaroof_trial_session_v1", value); }
      if (alive) setSessionId(value);
      const lastAttempt = localStorage.getItem("maaroof_trial_last_attempt");
      if (lastAttempt) setAttemptId(lastAttempt);
    } catch {}
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const check = () => {
      if (Date.now() >= new Date(expiresAt).getTime()) {
        setResult(null);
        setAttemptId(null);
        try { localStorage.removeItem("maaroof_trial_last_attempt"); } catch {}
        setMessage({ kind: "info", text: c.expiredText });
      }
    };
    check();
    const id = window.setInterval(check, 15000);
    return () => window.clearInterval(id);
  }, [expiresAt, c.unavailableText]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.access_token || busy || !deviceId || !sessionId) return;
    setBusy(true); setMessage(null); setContact(null); setRetryAt(null); setResult(null); setRetrievalUsed(false);
    const payload = {
      action: "start", entity_name: entityName, entity_type: entityType,
      category, description, market, language: l,
      assets: assetsText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
    };
    let requestKey = crypto.randomUUID();
    try {
      const signature = await trialPayloadSignature(payload);
      const savedSignature = sessionStorage.getItem("maaroof_trial_pending_signature");
      const savedKey = sessionStorage.getItem("maaroof_trial_pending_key");
      if (savedSignature === signature && savedKey) requestKey = savedKey;
      else {
        sessionStorage.setItem("maaroof_trial_pending_signature", signature);
        sessionStorage.setItem("maaroof_trial_pending_key", requestKey);
      }
    } catch {}
    try {
      const response = await fetch("/api/visibility-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
          "X-Trial-Device": deviceId,
          "X-Trial-Session": sessionId,
        },
        body: JSON.stringify({ ...payload, request_key: requestKey }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (data.contact) setContact(data.contact);
        if (data.retry_at) setRetryAt(data.retry_at);
        if (data.error === "request_already_started" && data.attempt_id) {
          setAttemptId(data.attempt_id);
          try {
            localStorage.setItem("maaroof_trial_last_attempt", data.attempt_id);
            sessionStorage.removeItem("maaroof_trial_pending_signature");
            sessionStorage.removeItem("maaroof_trial_pending_key");
          } catch {}
          setMessage({ kind: "info", text: c.requestInProgress });
          return;
        }
        const errorText = data.error === "three_verified_engine_routes_unavailable" || data.error === "ip_verification_unavailable" || data.error === "trial_security_not_configured"
          ? c.unavailableText
          : data.error === "account_cooldown" || data.error === "entity_cooldown" || data.error === "device_cooldown" || data.error === "session_cooldown" || data.error === "ip_risk_review" || data.error === "connection_not_eligible"
            ? c.contactDesc : c.retry;
        setMessage({ kind: "error", text: errorText });
        return;
      }
      try {
        sessionStorage.removeItem("maaroof_trial_pending_signature");
        sessionStorage.removeItem("maaroof_trial_pending_key");
      } catch {}
      setResult(data.result as TrialResult);
      setAttemptId(data.attempt_id);
      setExpiresAt(data.result_expires_at);
      try { localStorage.setItem("maaroof_trial_last_attempt", data.attempt_id); } catch {}
    } catch {
      setMessage({ kind: "error", text: c.retry });
    } finally {
      setBusy(false);
    }
  };

  const retrieve = async () => {
    if (!attemptId || !session?.access_token || busy) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/visibility-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ action: "retrieve", attempt_id: attemptId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (data.contact) setContact(data.contact);
        setMessage({ kind: data.error === "in_progress" ? "info" : "error", text:
          data.error === "retrieval_exhausted" ? c.contactDesc :
          data.error === "expired" ? c.expiredText :
          data.error === "in_progress" ? c.requestInProgress :
          data.error === "failed" ? c.failed : c.unavailableText });
        if (data.error === "retrieval_exhausted") setRetrievalUsed(true);
        if (data.error === "expired" || data.error === "failed") {
          setAttemptId(null);
          try { localStorage.removeItem("maaroof_trial_last_attempt"); } catch {}
        }
        return;
      }
      setResult(data.result as TrialResult);
      setExpiresAt(data.result_expires_at);
      setRetrievalUsed(true);
      if (data.retrieval_exhausted) setContact(data.contact || null);
    } catch {
      setMessage({ kind: "error", text: c.retry });
    } finally { setBusy(false); }
  };

  if (loading) return <AuthGate state="loading" title={c.eyebrow} redirect="/visibility-trial" />;
  if (!user) return <AuthGate state="signed-out" title={c.eyebrow} redirect="/visibility-trial" />;

  const contactPanel = contact && (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">{contact.title || c.contact}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{contact.message || c.contactDesc}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {contact.phone && <a href={`tel:${contact.phone}`} className="text-primary underline" dir="ltr">{contact.phone}</a>}
        {contact.email && <a href={`mailto:${contact.email}`} className="text-primary underline" dir="ltr">{contact.email}</a>}
        {contact.whatsapp && <a href={contact.whatsapp} target="_blank" rel="noreferrer" className="text-primary underline">WhatsApp <ExternalLink className="inline size-3" /></a>}
        {contact.website && <a href={contact.website} target="_blank" rel="noreferrer" className="text-primary underline">Website <ExternalLink className="inline size-3" /></a>}
        {contact.channels?.map((channel) => channel.url ? <a key={channel.url} href={channel.url} target="_blank" rel="noreferrer" className="text-primary underline">{channel.label || c.contact} <ExternalLink className="inline size-3" /></a> : null)}
        <Link to="/contact" className="text-primary underline">{c.contact}</Link>
      </div>
      {!contact.phone && !contact.email && !contact.whatsapp && !contact.website && !contact.channels?.length && <p className="mt-3 text-xs text-muted-foreground">{c.noContact}</p>}
    </section>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" /> {c.back}
        </Link>
        <div className="mx-auto mt-8 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"><Sparkles className="size-3.5" />{c.eyebrow}</div>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-5xl">{c.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{c.intro}</p>
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-border/70 bg-card/60 p-3 text-start text-xs leading-6 text-muted-foreground">
            <ShieldCheck className="me-2 inline size-4 text-primary" />{c.security}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm md:p-7">
            <label className="block text-sm font-medium">{c.name}
              <input value={entityName} onChange={(e) => setEntityName(e.target.value)} required minLength={2} maxLength={180} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder={c.nameHint} />
            </label>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">{c.type}</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([{ value: "auto", label: c.auto }, { value: "person", label: c.person }, { value: "organization", label: c.org }] as const).map((item) => (
                  <button key={item.value} type="button" onClick={() => setEntityType(item.value)} className={`rounded-xl border px-3 py-2.5 text-xs transition-colors ${entityType === item.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>{item.label}</button>
                ))}
              </div>
            </fieldset>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">{c.category}
                <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="block text-sm font-medium">{c.market}
                <input value={market} onChange={(e) => setMarket(e.target.value)} maxLength={120} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
              </label>
            </div>
            <label className="mt-5 block text-sm font-medium">{c.description}
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={3} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
            </label>
            <label className="mt-5 block text-sm font-medium">{c.assets}
              <textarea value={assetsText} onChange={(e) => setAssetsText(e.target.value)} rows={3} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
              <span className="mt-1 block text-xs text-muted-foreground">{c.assetsHint}</span>
            </label>
            {message && <div role="alert" className={`mt-5 flex gap-2 rounded-xl border p-3 text-sm ${message.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}><TriangleAlert className="mt-0.5 size-4 shrink-0" />{message.text}</div>}
            {contactPanel}
            {retryAt && <p className="mt-3 text-xs text-muted-foreground">{c.retryAt}: <time dir="ltr">{new Date(retryAt).toLocaleString()}</time></p>}
            <button type="submit" disabled={busy || !entityName.trim() || !deviceId || !sessionId} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <><Loader2 className="size-4 animate-spin" />{c.working}</> : <><Sparkles className="size-4" />{c.start}</>}
            </button>
          </form>

          <aside className="h-fit rounded-2xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-primary" />{c.security.split(".")[0]}</div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">{c.sample}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4" />72h report · 5h cooldown</div>
            {attemptId && !retrievalUsed && (
              <button type="button" onClick={retrieve} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary disabled:opacity-50">
                <RefreshCw className="size-3.5" />{c.retrieval}
              </button>
            )}
            {retrievalUsed && <p className="mt-5 text-xs text-muted-foreground"><CheckCircle2 className="me-1 inline size-4 text-primary" />{c.retrievalDone}</p>}
          </aside>
        </div>

        {result && (
          <section className="mx-auto mt-10 max-w-4xl rounded-2xl border border-border bg-card/80 p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-primary">{c.report}</p>
                <h2 className="mt-1 font-display text-2xl font-bold">{result.entity.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{result.entity.type === "person" ? c.entityPerson : result.entity.type === "organization" ? c.entityOrg : c.entityUnknown}</p>
              </div>
              <div className="text-end text-xs text-muted-foreground">{c.expires}:<br /><time dir="ltr">{new Date(expiresAt || result.result_expires_at).toLocaleString()}</time></div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                [c.mention, result.metrics.mention_rate_percent === null ? "—" : result.metrics.mention_rate_percent + "%"],
                [c.recommend, result.metrics.recommendation_rate_percent === null ? "—" : result.metrics.recommendation_rate_percent + "%"],
                [c.engines, result.sample.answered_engines + "/3"],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background p-4"><div className="font-display text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>)}
            </div>
            <p className="mt-4 rounded-lg bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">{result.sample.has_blind_discovery ? c.sample + " (" + result.sample.blind_sample_count + "/3 " + c.engines + ")" : c.noCategoryMeasurement}</p>
            <div className="mt-6 space-y-4">
              {result.engines.map((engine) => (
                <article key={engine.engine} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{engine.name}</h3><span className="text-xs text-muted-foreground">{engine.status === "answered" ? c.answered : c.error}</span></div>
                  {engine.status === "answered" && <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-border px-2.5 py-1">{c.mentionStatus}: {engine.mentioned === null || engine.mentioned === undefined ? c.unknown : engine.mentioned ? c.yes : c.no}</span>
                    <span className="rounded-full border border-border px-2.5 py-1">{c.recommendationStatus}: {engine.recommendation === "yes" ? c.yes : engine.recommendation === "no" ? c.no : engine.recommendation === "conditional" ? c.conditional : c.unknown}</span>
                    <span className="rounded-full border border-border px-2.5 py-1">{c.confidenceStatus}: {engine.confidence || c.unknown}</span>
                  </div>}
                  {engine.discovery_answer && <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs leading-6"><strong>{c.discovery}</strong><p className="mt-1">{engine.discovery_answer}</p></div>}
                  {engine.summary && <p className="mt-3 text-sm leading-7">{engine.summary}</p>}
                  {engine.evidence_basis && <div className="mt-3 text-xs leading-6 text-muted-foreground"><strong>{c.basis}: </strong>{engine.evidence_basis}</div>}
                  {engine.strengths?.length ? <div className="mt-3 text-xs leading-6"><strong>{c.strengths}</strong><ul className="ms-5 list-disc">{engine.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
                  {engine.gaps?.length ? <div className="mt-3 text-xs leading-6 text-muted-foreground"><strong>{c.gaps}</strong><ul className="ms-5 list-disc">{engine.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
                  {engine.recommendations?.length ? <div className="mt-3 text-xs leading-6"><strong>{c.actions}</strong><ul className="ms-5 list-disc">{engine.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
                  {engine.sources?.length ? <div className="mt-3 text-xs"><strong>{c.sources}</strong><ul className="ms-5 list-disc">{engine.sources.map((url) => <li key={url}><a className="break-all text-primary underline" href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></div> : null}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
