import { Link } from "@tanstack/react-router";
import { FreeAuditMarketing, FreeAuditResultCta } from "@/components/visibility/FreeAuditMarketing";
import { useEffect, useState, type FormEvent , useRef} from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { computeFingerprint } from "@/lib/fingerprint";
import { TrialKnowledgeSignals } from "@/components/visibility/TrialKnowledgeSignals";
import { GeoScopeSelector, type GeoScope } from "@/components/GeoScopeSelector";
import { FreeAuditTour } from "@/components/visibility/FreeAuditTour";
import { FreeAuditHeader } from "@/components/visibility/FreeAuditHeader";
import { ArrowLeft, Clock3, ExternalLink, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";

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
    category: "التخصص أو الفئة (اختياري)", description: "وصف مختصر (اختياري)", market: "النطاق الجغرافي (اختياري)", langNote: "لغة التقرير: العربية. ستُجيب النماذج بهذه اللغة فقط؛ غيّرها من زر اللغة أعلى الصفحة قبل الفحص.",
    assets: "روابط رقمية (اختياري)", assetsHint: "يمكن تركها فارغة. ضع كل رابط في سطر منفصل.", usageTitle: "إجمالي مرات بدء التجربة", usageNote: "عداد مباشر للمحاولات التي بدأها النظام فعلياً.", geoExpand: "تحديد النطاق الجغرافي (اختياري)",
    start: "ابدأ التجربة المجانية", working: "جارٍ تنفيذ الفحص المباشر", auth: "سجّل الدخول للمتابعة",
    security: "يتم التحقق من الاتصال وأهلية التجربة قبل بدء الفحص. لا نستخدم إجابات فحوصات سابقة.",
    unavailable: "التجربة غير متاحة حالياً", unavailableText: "لم يتم التحقق من ثلاثة مسارات مستقلة أو من إعدادات الحماية. لم يبدأ الفحص ولم يُحتسب كاستخدام.", expiredText: "انتهت صلاحية هذا التقرير وحُذفت بياناته المؤقتة.",
    failed: "تعذر إكمال الفحص", retry: "أعد المحاولة بعد التحقق من الاتصال والإعدادات.", requestInProgress: "هذه المحاولة بدأت بالفعل. يمكنك استرجاع تقريرها مرة واحدة عند اكتمالها.",
    report: "تقرير الرؤية المحدود", mention: "معدل ذكر الكيان", recommend: "معدل التوصية", engines: "المسارات التي أجابت", noCategoryMeasurement: "لم تتوفر فئة وسوق محايدان لا يتضمنان اسم الكيان؛ لذلك لم يُقَس الاكتشاف غير الموجّه أو الظهور العضوي.", discovery: "نتيجة الاكتشاف غير الموجّه", mentionStatus: "ذكر الكيان", recommendationStatus: "التوصية", confidenceStatus: "الثقة", high: "مرتفعة", medium: "متوسطة", low: "منخفضة", yes: "نعم", no: "لا", conditional: "مشروطة", unknown: "غير محسوم",
    sample: "هذه عينة من ثلاث استجابات نموذجية حية، وليست قياساً شاملاً للسوق أو تحققاً من فهارس البحث والاستشهادات المباشرة لكل منتج.",
    known: "ملخص الاستجابة", basis: "أساس الأدلة", strengths: "إشارات إيجابية", gaps: "المعلومات غير المحسومة", actions: "تحسينات مقترحة", sources: "روابط ذكرتها الاستجابة (غير متحققة مستقلاً)",
    retrieval: "استرجاع التقرير", retrievalDone: "تم استخدام الاسترجاع الإضافي", expires: "تنتهي صلاحية التقرير", contact: "التواصل مع معروف",
    contactDesc: "تعذر فتح تجربة جديدة ضمن فترة الأهلية الحالية. يمكنك التواصل مع فريق معروف.",
    cooldown: "التجربة غير مؤهلة حالياً", retryAt: "موعد الأهلية التالي",
    noContact: "لم تُضبط قنوات التواصل في إعدادات الإدارة بعد.",
    back: "العودة إلى الرئيسية", status: "الحالة", answered: "تمت الإجابة", error: "لم تصل إجابة",
    entityPerson: "شخص", entityOrg: "مؤسسة", entityUnknown: "غير محسوم",
  },
  en: {
    eyebrow: "Free AI Visibility Check", title: "See what AI models say about your brand",
    intro: "Run a live, limited sample across three independently configured model routes. Get a clearer view of what was said, what was missing and where evidence may help. No website or social accounts required.",
    name: "What should we check?", nameHint: "Enter the name customers or audiences use.",
    type: "Entity type", auto: "Detect automatically", person: "Person", org: "Organization / brand",
    category: "Sector or category (optional)", description: "Short description (optional)", market: "Geographic scope (optional)", langNote: "Report language: English. Models answer in this language only; change it from the language button at the top before running.",
    assets: "Digital links (optional)", assetsHint: "Leave empty if none. Enter one URL per line.", usageTitle: "Free checks started", usageNote: "Live count of checks successfully started by the system.", geoExpand: "Choose geographic scope (optional)",
    start: "Run my free check", working: "Running your live check", auth: "Sign in to continue",
    security: "We verify availability and trial eligibility before starting. Previous answers are not reused.",
    unavailable: "Trial is temporarily unavailable", unavailableText: "Three independent routes or security services could not be verified. The probe did not start and was not counted.", expiredText: "This report has expired. Its temporary report data is no longer available.",
    failed: "The probe could not be completed", retry: "Retry after checking connection and configuration.", requestInProgress: "This request has already started. You can retrieve its report once after it finishes.",
    report: "Limited visibility report", mention: "Entity mention rate", recommend: "Recommendation rate", engines: "Routes that answered", noCategoryMeasurement: "No neutral category/market was supplied, or the category/market included the target name; unprompted discovery and organic visibility were not measured.", discovery: "Unprompted discovery response", mentionStatus: "Entity mention", recommendationStatus: "Recommendation", confidenceStatus: "Confidence", high: "High", medium: "Medium", low: "Low", yes: "Yes", no: "No", conditional: "Conditional", unknown: "Unknown",
    sample: "Your report is a limited sample of up to three model responses. It is not a market-wide measurement or proof of live search rankings, indexing or citations.",
    known: "Response summary", basis: "Evidence basis", strengths: "Positive signals", gaps: "Unresolved information", actions: "Suggested improvements", sources: "URLs named in the response (not independently verified)",
    retrieval: "Retrieve report", retrievalDone: "Additional retrieval used", expires: "Report expires", contact: "Contact MAAROOF",
    contactDesc: "A new trial is not eligible during the current access window. You can contact the MAAROOF team.",
    cooldown: "Trial is not eligible yet", retryAt: "Next eligible time",
    noContact: "No contact channels have been configured in Admin yet.",
    back: "Back to home", status: "Status", answered: "Answered", error: "No answer",
    entityPerson: "Person", entityOrg: "Organization", entityUnknown: "Undetermined",
  },
  ku: {
    eyebrow: "تاقیکردنەوەی خۆڕایی AI Visibility", title: "بزانە ناسنامەکەت لە وەڵامە زیرەکەکاندا چۆن دەردەکەوێت",
    intro: "نموونەیەکی سنوورداری ڕاستەوخۆ لە سێ ڕێڕەوی مۆدێلی جیاواز. ماڵپەڕ یان هەژماری تۆڕی کۆمەڵایەتی پێویست نییە.",
    name: "ناوی کەس یان براند یان دامەزراوە", nameHint: "ئەو ناوە بنووسە کە خەڵک پێی دەناسن.",
    type: "جۆری قەوارە", auto: "دۆزینەوەی خۆکار", person: "کەس", org: "دامەزراوە / براند",
    category: "پسپۆڕی یان پۆل (ئارەزوومەندانە)", description: "پوختەیەکی کورت (ئارەزوومەندانە)", market: "بواری جوگرافی (ئارەزوومەندانە)", langNote: "زمانی ڕاپۆرت: کوردی. مۆدێلەکان تەنها بەم زمانە وەڵام دەدەنەوە؛ پێش پشکنین لە دوگمەی زمان لە سەرەوە بیگۆڕە.",
    assets: "بەستەری دیجیتاڵ (ئارەزوومەندانە)", assetsHint: "ئەگەر نییە بەتاڵی بهێڵەوە. هەر بەستەرێک لە دێڕێکی جیاواز.", usageTitle: "کۆی دەستپێکردنی تاقیکردنەوە", usageNote: "ژمارەی ڕاستەوخۆی ئەو تاقیکردنەوانەی بەڕاستی دەستیان پێکردووە.", geoExpand: "دیاریکردنی بواری جوگرافی (ئارەزوومەندانە)",
    start: "دەستپێکردنی تاقیکردنەوە", working: "پشکنینی ڕاستەوخۆ ئەنجام دەدرێت", auth: "بچۆ ژوورەوە بۆ بەردەوامبوون",
    security: "پێش پشکنین پەیوەندی و شایستەیی پشتڕاست دەکرێتەوە. وەڵامی پشکنینی پێشووتر بەکارناهێنین.",
    unavailable: "تاقیکردنەوە ئێستا بەردەست نییە", unavailableText: "سێ ڕێڕەوی جیاواز یان خزمەتگوزاری پاراستن پشتڕاست نەکرایەوە. پشکنین دەستی پێنەکرد و حساب نەکرا.", expiredText: "ماوەی ئەم ڕاپۆرتە تەواو بووە و داتاکانی کاتی سڕاونەتەوە.",
    failed: "پشکنین تەواو نەبوو", retry: "دوای پشتڕاستکردنەوەی پەیوەندی و ڕێکخستنەکان دووبارە هەوڵ بدە.", requestInProgress: "ئەم داواکارییە دەستی پێکردووە. دوای تەواوبوونی دەتوانیت ڕاپۆرتەکە یەک جار وەربگریتەوە.",
    report: "ڕاپۆرتی سنوورداری دەرکەوتن", mention: "ڕێژەی باسکردنی قەوارە", recommend: "ڕێژەی پێشنیار", engines: "ڕێڕەوە وەڵامدەرەکان", noCategoryMeasurement: "پۆل و بازاڕێکی بێلایەن کە ناوی قەوارەکەیان تێدا نەبێت بەردەست نەبوو؛ بۆیە دۆزینەوەی بێ ئاراستە و دەرکەوتنی سروشتی نەپیوراوە.", discovery: "وەڵامی دۆزینەوەی بێ ئاراستە", mentionStatus: "باسکردنی قەوارە", recommendationStatus: "پێشنیار", confidenceStatus: "متمانە", high: "بەرز", medium: "مامناوەند", low: "نزم", yes: "بەڵێ", no: "نەخێر", conditional: "بە مەرج", unknown: "نادیار",
    sample: "ئەمە نموونەیەکی سێ وەڵامی مۆدێلی ڕاستەوخۆیە، نەک پێوانەی گشتی بازاڕ یان پشتڕاستکردنەوەی ئیندێکسی گەڕان و ئاماژەپێدانی ڕاستەوخۆی هەر بەرهەمێک.",
    known: "پوختەی وەڵام", basis: "بنەمای بەڵگە", strengths: "نیشانە ئەرێنییەکان", gaps: "زانیاریی نادیار", actions: "باشترکردنی پێشنیارکراو", sources: "بەستەرە باسکراوەکان (بە سەربەخۆیی پشتڕاست نەکراونەتەوە)",
    retrieval: "وەرگرتنەوەی ڕاپۆرت", retrievalDone: "وەرگرتنەوەی زیادە بەکارهاتووە", expires: "کۆتایی هاتنی ڕاپۆرت", contact: "پەیوەندی بە مەعروف",
    contactDesc: "لە ماوەی ئێستادا تاقیکردنەوەی نوێ شایستە نییە. دەتوانیت پەیوەندی بە تیمی مەعروفەوە بکەیت.",
    noContact: "هێشتا هیچ ڕێگایەکی پەیوەندی لە ڕێکخستنەکانی بەڕێوەبەر دیاری نەکراوە.",
    back: "گەڕانەوە بۆ سەرەتا", status: "دۆخ", answered: "وەڵام دراوە", error: "وەڵام نەگەیشت",
    retryAt: "کاتی شایستەبوونی داهاتوو", entityPerson: "کەس", entityOrg: "دامەزراوە", entityUnknown: "دیاری نەکراو",
  },
} as const;

async function trialPayloadSignature(value: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

const GEO_SCOPES = {
  ar: ["العراق", "السعودية", "الإمارات", "الخليج", "مصر", "الأردن", "عالمي"],
  en: ["Iraq", "Saudi Arabia", "UAE", "Gulf", "Egypt", "Jordan", "Global"],
  ku: ["عێراق", "سعودیە", "ئیمارات", "کەنداو", "میسر", "ئوردن", "جیهانی"],
} as const;

export type TrialPrefill = { entity?: string; category?: string; market?: string };

export function VisibilityTrialPage({ prefill = {} }: { prefill?: TrialPrefill } = {}) {
  const { lang } = useI18n();
  
  const l = lang === "ar" || lang === "ku" ? lang : "en";
  const c = COPY[l];
  const [honeypot, setHoneypot] = useState("");
  const formStartRef = useRef<number>(Date.now());
  const [entityName, setEntityName] = useState(prefill.entity?.slice(0, 180) || "");
  const [entityType, setEntityType] = useState<"auto" | "person" | "organization">("auto");
  const [category, setCategory] = useState(prefill.category?.slice(0, 180) || "");
  const [description, setDescription] = useState("");
  const [geo, setGeo] = useState<GeoScope>(prefill.market ? { scope: "country", country: prefill.market.slice(0, 120) } : { scope: "world" });
  const market = geo.scope === "world" ? "Global" : geo.scope === "auto" ? "" : [geo.city, geo.region, geo.country].filter(Boolean).join(", ").slice(0, 120);
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
  const [freeTrialAttempts, setFreeTrialAttempts] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => fetch("/api/visibility-trial-usage", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active) setFreeTrialAttempts(data.available ? Number(data.totalStarted) : null); })
      .catch(() => { if (active) setFreeTrialAttempts(null); });
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

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
  }, [expiresAt, c.expiredText]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void fetch("/api/visibility-trial", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Trial-Session": sessionId },
      body: JSON.stringify({ action: "latest" }),
    }).then((response) => response.json()).then((data) => {
      if (!active || !data.ok) return;
      if (!data.available) {
        setAttemptId(null);
        setRetryAt(null);
        try { localStorage.removeItem("maaroof_trial_last_attempt"); } catch {}
        return;
      }
      setAttemptId(data.attempt_id);
      try { localStorage.setItem("maaroof_trial_last_attempt", data.attempt_id); } catch {}
      if (data.next_eligible_at) setRetryAt(data.next_eligible_at);
      if (data.retrieval_exhausted) {
        setRetrievalUsed(true);
        setContact(data.contact || null);
      } else if (data.expired) {
        setAttemptId(null);
        try { localStorage.removeItem("maaroof_trial_last_attempt"); } catch {}
        setMessage({ kind: "info", text: c.expiredText });
      } else if (data.status === "failed") {
        setRetrievalUsed(true);
        setMessage({ kind: "error", text: c.failed });
      } else if (data.status === "running" || data.status === "reserved") {
        setMessage({ kind: "info", text: c.requestInProgress });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [sessionId, c.expiredText, c.failed, c.requestInProgress]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !deviceId || !sessionId) return;
    setBusy(true); setMessage(null); setContact(null); setRetryAt(null); setResult(null); setRetrievalUsed(false);
    const payload = {
      action: "start", entity_name: entityName, entity_type: entityType,
      category, description, market, language: l,
      honeypot, fill_ms: Date.now() - formStartRef.current,
      assets: assetsText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
    };
    let requestKey: string = crypto.randomUUID();
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
    if (!attemptId || !sessionId || busy) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/visibility-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Trial-Session": sessionId },
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
      </div>
      {!contact.phone && !contact.email && !contact.whatsapp && !contact.website && !contact.channels?.length && <p className="mt-3 text-xs text-muted-foreground">{c.noContact}</p>}
    </section>
  );

  return (
    <div className="free-audit-page min-h-screen" lang={l} dir="ltr">
      <FreeAuditHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" /> <span dir={l === "en" ? "ltr" : "rtl"}>{c.back}</span>
        </Link>
        <div className="mx-auto mt-8 max-w-3xl text-center">
          <div className="inline-flex flex-row items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"><Sparkles className="size-3.5" /><span dir={l === "en" ? "ltr" : "rtl"}>{c.eyebrow}</span></div>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-5xl">{c.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{c.intro}</p>
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-border/70 bg-card/60 p-3 text-start text-xs leading-6 text-muted-foreground">
            <ShieldCheck className="me-2 inline size-4 text-primary" /><span dir={l === "en" ? "ltr" : "rtl"}>{c.security}</span>
          </div>
        </div>

        <section aria-label={c.usageTitle} className="mx-auto mt-6 flex max-w-3xl items-center justify-center gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-4 text-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-background text-primary"><Sparkles className="size-5" /></div>
          <div className="min-w-0 text-start">
            <p className="text-xs font-semibold text-foreground">{c.usageTitle}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{c.usageNote}</p>
          </div>
          <div className="ms-auto min-w-16 font-display text-3xl font-bold tabular-nums text-primary" aria-live="polite">{freeTrialAttempts === null ? "—" : freeTrialAttempts.toLocaleString(l === "ar" ? "ar-IQ" : l === "ku" ? "ku" : "en-US")}</div>
        </section>
        <FreeAuditMarketing lang={l} part="top" />
        <div id="audit-form" className="mx-auto mt-10 grid max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm md:p-7">
            <input type="text" name="company_website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            <label className="block text-sm font-medium">{c.name}
              <input value={entityName} onChange={(e) => setEntityName(e.target.value)} required minLength={2} maxLength={180} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder={c.nameHint} />
            </label>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">{c.type}</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([{ value: "auto", label: c.auto }, { value: "person", label: c.person }, { value: "organization", label: c.org }] as const).map((item) => (
                  <button key={item.value} type="button" onClick={() => setEntityType(item.value)} className={`rounded-xl border px-3 py-2.5 text-xs transition-colors ${entityType === item.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}><span dir={l === "en" ? "ltr" : "rtl"}>{item.label}</span></button>
                ))}
              </div>
            </fieldset>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">{c.category}
                <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
              </label>
              <details className="rounded-xl border border-border/70 bg-background/40 p-3" data-tour="scope">
                <summary className="cursor-pointer list-none text-sm font-medium">{c.geoExpand}<span className="ms-2 text-xs font-normal text-muted-foreground">{c.market}</span></summary>
                <div className="mt-3"><GeoScopeSelector compact toolKey="free_audit" value={geo} onChange={setGeo} /></div>
              </details>
            </div>
            <p data-tour="lang" className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-6">{c.langNote}</p>
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
            <button type="submit" disabled={busy || !entityName.trim() || !deviceId || !sessionId} className="group relative mt-6 isolate inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_28px_-12px_hsl(var(--primary)/.65)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_-10px_hsl(var(--primary)/.7)] active:translate-y-0 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 -start-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[420%] group-active:translate-x-[520%]" /><span aria-hidden className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-70 transition-all duration-300 group-active:inset-x-1 group-active:opacity-100" />{busy ? <><Loader2 className="size-4 animate-spin" /><span dir={l === "en" ? "ltr" : "rtl"}>{c.working}</span></> : <><Sparkles className="size-4 transition-transform duration-300 group-hover:rotate-12 group-active:scale-110" /><span dir={l === "en" ? "ltr" : "rtl"}>{c.start}</span></>}
            </button>
          </form>

          <aside className="h-fit rounded-2xl border border-border/70 bg-card/50 p-5">
            <div className="flex flex-row items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-primary" /><span dir={l === "en" ? "ltr" : "rtl"}>{c.security.split(".")[0]}</span></div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">{c.sample}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4" />72h report · 5h cooldown</div>
            {attemptId && (
              <button type="button" onClick={retrieve} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary disabled:opacity-50">
                <RefreshCw className="size-3.5" /><span dir={l === "en" ? "ltr" : "rtl"}>{c.retrieval}</span>
              </button>
            )}
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
            <TrialKnowledgeSignals lang={l as "ar" | "en" | "ku"} entity={result.entity} />
            <div className="mt-6 space-y-4">
              {result.engines.map((engine) => (
                <article key={engine.engine} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{engine.name}</h3><span className="text-xs text-muted-foreground" dir={l === "en" ? "ltr" : "rtl"}>{engine.status === "answered" ? c.answered : c.error}</span></div>
                  {engine.status === "answered" && <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span dir={l === "en" ? "ltr" : "rtl"} className="rounded-full border border-border px-2.5 py-1">{c.mentionStatus}: {engine.mentioned === null || engine.mentioned === undefined ? c.unknown : engine.mentioned ? c.yes : c.no}</span>
                    <span dir={l === "en" ? "ltr" : "rtl"} className="rounded-full border border-border px-2.5 py-1">{c.recommendationStatus}: {engine.recommendation === "yes" ? c.yes : engine.recommendation === "no" ? c.no : engine.recommendation === "conditional" ? c.conditional : c.unknown}</span>
                    <span dir={l === "en" ? "ltr" : "rtl"} className="rounded-full border border-border px-2.5 py-1">{c.confidenceStatus}: {engine.confidence === "high" ? c.high : engine.confidence === "medium" ? c.medium : engine.confidence === "low" ? c.low : c.unknown}</span>
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
            <FreeAuditResultCta lang={l} />
          </section>
        )}
        <FreeAuditMarketing lang={l} part="bottom" />
        <FreeAuditTour lang={l} />
      </main>
    </div>
  );
}
