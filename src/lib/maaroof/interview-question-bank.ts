import {
  INTERVIEW_DOMAINS,
  INTERVIEW_TARGET_TYPES,
  type InterviewDomain,
  type InterviewQuestion,
  type InterviewTargetType,
} from "@/lib/maaroof/interview-engine";

export const INTERVIEW_QUESTION_SET_VERSION = "2026-10-v1";

const q = (
  id: string,
  ar: string,
  en: string,
  ku: string,
  options: Partial<InterviewQuestion> = {},
): InterviewQuestion => ({
  id,
  prompt: { ar, en, ku },
  required: false,
  ...options,
});

const QUESTION_BANK: InterviewQuestion[] = [
  q("objective", "ما النتيجة التي تريد الوصول إليها من هذا العمل؟", "What outcome do you want to achieve with this work?", "دەتەوێت لەم کارەدا بە چ ئەنجامێک بگەیت؟", {
    required: true, canSkip: false, allowUnknown: false, domains: ["general"], priority: 1,
  }),
  q("audience", "من الجمهور أو المستفيد الذي تريد الوصول إليه؟", "Who is the audience or beneficiary you want to reach?", "ئەو جەماوەرە یان سوودمەندە کێیە کە دەتەوێت پێی بگەیت؟", {
    required: true, canSkip: true, allowUnknown: true, domains: ["general"], priority: 2,
  }),
  q("success_measure", "ما الدليل الذي سيجعلك تعتبر النتيجة ناجحة؟", "What evidence would make you consider the result successful?", "چ بەڵگەیەک وا دەکات ئەنجامەکە بە سەرکەوتوو دابنێیت؟", {
    domains: ["general"], priority: 20,
  }),
  q("operating_context", "ما السياق أو القيود التي يجب أن يأخذها معروف بالحسبان؟", "What context or constraints should Maaroof take into account?", "چ بارودۆخ یان سنوورێک دەبێت ماعروف لەبەرچاوی بگرێت؟", {
    domains: ["general"], priority: 25,
  }),
  q("individual_context", "ما الدور أو الوضع الشخصي المرتبط بهذا الهدف؟", "What personal role or situation is relevant to this goal?", "کام ڕۆڵ یان بارودۆخی کەسی پەیوەندی بە ئامانجەکەوە هەیە؟", {
    targetTypes: ["individual"], domains: ["general"], priority: 10,
  }),
  q("creator_channels", "على أي منصات تنشر حالياً، وأي منصة تريد تطويرها أولاً؟", "Which platforms do you publish on, and which should be improved first?", "لە کام پلاتفۆرمانەدا بڵاو دەکەیتەوە و دەتەوێت کامەیان یەکەم پەرەی پێ بدرێت؟", {
    targetTypes: ["creator"], required: true, domains: ["general"], priority: 10,
  }),
  q("company_offering", "ما المنتجات أو الخدمات الأساسية التي تقدمها الشركة؟", "What are the company's core products or services?", "بەرهەم یان خزمەتگوزارییە سەرەکییەکانی کۆمپانیاکە چین؟", {
    targetTypes: ["company"], required: true, domains: ["general"], priority: 10,
  }),
  q("agency_services", "ما الخدمات التي تقدمها الوكالة، وما نوع العملاء الذين تخدمهم؟", "What services does the agency offer, and what kinds of clients does it serve?", "ئاژانسەکە چ خزمەتگوزارییەک پێشکەش دەکات و چ جۆرە کڕیارێک خزمەت دەکات؟", {
    targetTypes: ["agency"], required: true, domains: ["general"], priority: 10,
  }),
  q("client_outcome", "ما أهم نتيجة يريد هذا العميل تحقيقها؟", "What is the most important outcome this client wants to achieve?", "گرنگترین ئەنجام کە ئەم کڕیارە دەتەوێت بەدەستی بهێنێت چییە؟", {
    targetTypes: ["client"], required: true, domains: ["general"], priority: 10,
  }),
  q("brand_offering", "ما الذي تقدمه هذه العلامة، ولمن تقدمه؟", "What does this brand offer, and to whom?", "ئەم براندە چی پێشکەش دەکات و بۆ کێ؟", {
    targetTypes: ["brand"], required: true, domains: ["general"], priority: 10,
  }),
  q("project_deliverable", "ما المخرج المحدد الذي يجب أن ينتجه هذا المشروع؟", "What specific deliverable should this project produce?", "ئەنجامی دیاریکراوی ئەم پڕۆژەیە دەبێت چی بێت؟", {
    targetTypes: ["project"], required: true, domains: ["general"], priority: 10,
  }),
  q("task_deliverable", "ما المخرج الذي تتوقعه من هذه المهمة؟", "What deliverable do you expect from this task?", "چ ئەنجامێک لەم ئەرکە چاوەڕوان دەکەیت؟", {
    targetTypes: ["task"], required: true, domains: ["general"], priority: 10,
  }),
  q("seo_property", "ما الموقع أو النطاق الذي ينبغي فحصه؟", "Which website or domain should be audited?", "کام ماڵپەڕ یان دۆمەین دەبێت پشکنینی بۆ بکرێت؟", {
    domains: ["seo"], required: true, canSkip: true, allowUnknown: true, priority: 5,
  }),
  q("seo_search_goal", "ما الكلمات أو نية البحث أو الصفحات العضوية التي تمثل الأولوية؟", "Which search terms, search intent, or organic pages are the priority?", "کام وشەی گەڕان، مەبەستی گەڕان یان پەڕەی ئۆرگانیک گرنگترە؟", {
    domains: ["seo"], required: true, priority: 10,
  }),
  q("aeo_questions", "ما الأسئلة التي يحتاج الجمهور إلى إجابات موثوقة عنها؟", "Which questions does the audience need reliable answers to?", "جەماوەر پێویستی بە وەڵامی باوەڕپێکراوی کام پرسیارانە هەیە؟", {
    domains: ["aeo"], required: true, priority: 5,
  }),
  q("aeo_facts", "ما الحقائق أو المصادر الرسمية التي يجب اعتمادها في الإجابات؟", "Which facts or official sources should the answers rely on?", "وەڵامەکان دەبێت پشت بە کام ڕاستی یان سەرچاوەی فەرمی ببەستن؟", {
    domains: ["aeo"], priority: 15,
  }),
  q("geo_queries", "ما الاستعلامات أو الأسئلة التي تريد اختبار ظهور العلامة فيها؟", "Which queries or questions should test the brand's visibility?", "کام داواکاری یان پرسیار بۆ تاقیکردنەوەی دەرکەوتنی براندەکە بەکاربهێنرێت؟", {
    domains: ["geo"], required: true, priority: 5,
  }),
  q("geo_engines", "ما المحركات أو النماذج التي يجب أن تدخل في القياس؟", "Which engines or models should be included in the measurement?", "کام مۆتۆڕ یان مۆدێل دەبێت لە پێوانەکەدا بێت؟", {
    domains: ["geo"], priority: 15,
  }),
  q("gseo_journey", "كيف يحاول المستخدم العثور على المعلومة أو الإجابة حالياً؟", "How does the user currently try to find the information or answer?", "بەکارهێنەر لە ئێستادا چۆن هەوڵی دۆزینەوەی زانیاری یان وەڵام دەدات؟", {
    domains: ["gseo"], required: true, priority: 5,
  }),
  q("gseo_friction", "أين يصعب على المستخدم فهم الإجابة أو الوصول إلى مصدرها؟", "Where does the user struggle to understand the answer or reach its source?", "لە کوێدا بەکارهێنەر بۆی سەختە وەڵامەکە تێبگات یان بگاتە سەرچاوەکەی؟", {
    domains: ["gseo"], priority: 15,
  }),
];

export function buildInterviewQuestionSet(
  targetType: InterviewTargetType,
  domains: InterviewDomain[],
): InterviewQuestion[] {
  const selectedDomains = new Set<InterviewDomain>(domains.length ? domains : ["general"]);
  return QUESTION_BANK.filter((question) => {
    if (question.targetTypes?.length && !question.targetTypes.includes(targetType)) return false;
    const qDomains = question.domains || ["general"];
    return qDomains.includes("general") || qDomains.some((domain) => selectedDomains.has(domain));
  }).map((question) => ({
    ...question,
    prompt: { ...question.prompt },
    ...(question.targetTypes ? { targetTypes: [...question.targetTypes] } : {}),
    ...(question.domains ? { domains: [...question.domains] } : {}),
    ...(question.when ? { when: question.when.map((condition) => ({ ...condition })) } : {}),
  }));
}

export function isInterviewTargetType(value: unknown): value is InterviewTargetType {
  return typeof value === "string" && (INTERVIEW_TARGET_TYPES as readonly string[]).includes(value);
}

export function normalizeInterviewDomains(value: unknown): InterviewDomain[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > INTERVIEW_DOMAINS.length) return null;
  if (value.some((item) => typeof item !== "string" || !(INTERVIEW_DOMAINS as readonly string[]).includes(item))) {
    return null;
  }
  const domains = [...new Set(value as InterviewDomain[])];
  return domains.length === value.length ? domains : null;
}
