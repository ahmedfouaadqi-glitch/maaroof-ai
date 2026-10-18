import {
  INTERVIEW_DOMAINS,
  INTERVIEW_TARGET_TYPES,
  type InterviewDomain,
  type InterviewQuestion,
  type InterviewTargetType,
} from "@/lib/maaroof/interview-engine";

export const INTERVIEW_QUESTION_SET_VERSION = "2026-10-v2";

const QUESTION_GROUP: Record<string, string> = {
  objective: "general",
  audience: "general",
  success_measure: "general",
  operating_context: "general",
  individual_context: "general",
  creator_channels: "general",
  company_offering: "general",
  agency_services: "general",
  client_outcome: "general",
  brand_offering: "general",
  project_deliverable: "general",
  task_deliverable: "general",
  seo_property: "seo",
  seo_search_goal: "seo",
  aeo_questions: "aeo",
  aeo_facts: "aeo",
  geo_queries: "geo",
  geo_engines: "geo",
  gseo_journey: "gseo",
  gseo_friction: "gseo",
};
const GUIDANCE: Record<string, Record<"ar" | "en" | "ku", string>> = {
  general: {
    ar: "أجب بتفاصيل عملية مرتبطة بالهدف. اذكر أرقامًا أو أمثلة واقعية إن توفرت، ولا تخمّن ما لا تعرفه.",
    en: "Give practical details related to the goal. Include real examples or metrics when available; do not guess what you do not know.",
    ku: "بە وردەکاریی کرداری و پەیوەندیدار بە ئامانجەکە وەڵام بدە. ئەگەر هەیە نموونە یان ژمارەی ڕاستەقینە بنووسە؛ ئەوەی نازانیت مەخەمڵێنە.",
  },
  seo: {
    ar: "حدد النطاق والصفحات أو نية البحث ذات الصلة، واذكر بيانات التحليل المتاحة بدل تقدير النتائج.",
    en: "Specify scope, relevant pages or search intent, and available analytics instead of estimating results.",
    ku: "مەودا و پەڕە یان مەبەستی گەڕانی پەیوەندیدار دیاری بکە و داتای بەردەست بنووسە، نەک ئەنجامی خەمڵێنراو.",
  },
  aeo: {
    ar: "ركز على سؤال المستخدم، والإجابة الدقيقة، والمصدر الذي يمكن التحقق منه.",
    en: "Focus on the user's question, a precise answer, and a source that can be verified.",
    ku: "سەرنج بخە سەر پرسیاری بەکارهێنەر، وەڵامی ورد و سەرچاوەیەکی پشتڕاستکراو.",
  },
  geo: {
    ar: "اكتب استعلامات واقعية وحدد المحركات المطلوب فحصها؛ لا تعمم نتيجة محرك على غيره.",
    en: "Use realistic queries and name the engines to check; do not generalize one engine's result to others.",
    ku: "پرسیاری ڕاستەقینە بنووسە و مۆتۆڕەکانی پشکنین دیاری بکە؛ ئەنجامی یەک مۆتۆڕ بەسەر ئەوانی تردا مەگشتێنە.",
  },
  gseo: {
    ar: "اشرح رحلة المستخدم والعائق المحدد، واستند إلى ملاحظة أو بيانات إن توفرت.",
    en: "Describe the user journey and specific friction point, using observations or data when available.",
    ku: "ڕێڕەوی بەکارهێنەر و بەربەستی دیاریکراو باس بکە و ئەگەر هەیە پشت بە چاودێری یان داتا ببەستە.",
  },
};
const EXAMPLES: Record<string, Record<"ar" | "en" | "ku", string>> = {
  objective: {
    ar: "مثال: زيادة الطلبات المؤهلة من الموقع خلال الربع القادم.",
    en: "Example: Increase qualified website enquiries next quarter.",
    ku: "نموونە: زیادکردنی داواکارییە شیاوەکان لە ماڵپەڕەوە لە چارەکی داهاتوودا.",
  },
  audience: {
    ar: "مثال: أصحاب الشركات الصغيرة الباحثون عن خدمات محاسبية.",
    en: "Example: Small-business owners looking for accounting services.",
    ku: "نموونە: خاوەن کاروباری بچووک کە بەدوای خزمەتگوزاریی ژمێریاری دەگەڕێن.",
  },
  success_measure: {
    ar: "مثال: نمو الزيارات العضوية 15% خلال ثلاثة أشهر مقارنة بالفترة السابقة.",
    en: "Example: Grow organic visits by 15% over three months versus the previous period.",
    ku: "نموونە: زیادکردنی سەردانی ئۆرگانیک بە ١٥٪ لە سێ مانگدا بە بەراورد بە ماوەی پێشوو.",
  },
  operating_context: {
    ar: "مثال: يجب إنجاز المرحلة الأولى خلال شهر وضمن الميزانية الحالية.",
    en: "Example: The first phase must finish within a month and the current budget.",
    ku: "نموونە: قۆناغی یەکەم دەبێت لە مانگێکدا و لە چوارچێوەی بودجەی ئێستادا تەواو بێت.",
  },
  individual_context: {
    ar: "مثال: أعمل في العمليات وأريد الانتقال إلى إدارة المشاريع.",
    en: "Example: I work in operations and want to move into project management.",
    ku: "نموونە: لە ئۆپەراسیۆندا کار دەکەم و دەمەوێت بگوازمەوە بۆ بەڕێوەبردنی پڕۆژە.",
  },
  creator_channels: {
    ar: "مثال: أنشر على YouTube وInstagram وأريد تحسين الاحتفاظ بالمشاهدين أولًا.",
    en: "Example: I publish on YouTube and Instagram and want to improve audience retention first.",
    ku: "نموونە: لە YouTube و Instagram بڵاو دەکەمەوە و سەرەتا دەمەوێت مانەوەی بینەران باشتر بکەم.",
  },
  company_offering: {
    ar: "مثال: نظام حجز للشركات الصغيرة التي تدير خدماتها عبر الهاتف.",
    en: "Example: A booking system for small businesses managing services by phone.",
    ku: "نموونە: سیستەمی حجز بۆ کاروباری بچووک کە خزمەتگوزارییەکانیان بە تەلەفۆن بەڕێوە دەبەن.",
  },
  agency_services: {
    ar: "مثال: تقديم SEO وكتابة المحتوى لشركات التجارة الإلكترونية الناشئة.",
    en: "Example: SEO and content writing for early-stage ecommerce companies.",
    ku: "نموونە: پێشکەشکردنی SEO و نووسینی ناوەڕۆک بۆ کۆمپانیا تازەکانی بازرگانی ئەلیکترۆنی.",
  },
  client_outcome: {
    ar: "مثال: زيادة العملاء المحتملين المؤهلين دون زيادة تكلفة الاستحواذ.",
    en: "Example: Increase qualified leads without increasing acquisition cost.",
    ku: "نموونە: زیادکردنی کڕیاری ئەگەریی شیاو بەبێ زیادکردنی تێچوونی بەدەستهێنان.",
  },
  brand_offering: {
    ar: "مثال: منتج للعناية بالبشرة موجه لأصحاب البشرة الحساسة.",
    en: "Example: A skincare product designed for people with sensitive skin.",
    ku: "نموونە: بەرهەمی چاودێری پێست بۆ خاوەن پێستی هەستیار.",
  },
  project_deliverable: {
    ar: "مثال: تقرير تدقيق يتضمن الأولويات والأدلة وخطوات التنفيذ.",
    en: "Example: An audit report with priorities, evidence, and implementation steps.",
    ku: "نموونە: ڕاپۆرتی پشکنین کە پێشینەکان، بەڵگەکان و هەنگاوەکانی جێبەجێکردن لەخۆ بگرێت.",
  },
  task_deliverable: {
    ar: "مثال: قائمة تنفيذية بالمهام والمسؤولين ومعيار القبول.",
    en: "Example: An action list with tasks, owners, and acceptance criteria.",
    ku: "نموونە: لیستی جێبەجێکردن کە ئەرک، بەرپرسیار و پێوەری پەسەندکردن لەخۆ بگرێت.",
  },
  seo_property: {
    ar: "مثال: example.com مع التركيز على النسخة العربية والسوق العراقي.",
    en: "Example: example.com, focusing on the Arabic site and Iraqi market.",
    ku: "نموونە: example.com بە سەرنج لەسەر وەشانی عەرەبی و بازاڕی عێراق.",
  },
  seo_search_goal: {
    ar: "مثال: صفحة خدمة لمن يقارن مزودي الخدمة قبل الشراء.",
    en: "Example: A service page for people comparing providers before purchase.",
    ku: "نموونە: پەڕەی خزمەتگوزاری بۆ ئەوانەی پێش کڕین دابینکەرەکان بەراورد دەکەن.",
  },
  aeo_questions: {
    ar: "مثال: ما الفرق بين الخطتين؟ وما المتطلبات والمدة والتكلفة؟",
    en: "Example: What differs between the plans, and what are the requirements, timing, and cost?",
    ku: "نموونە: جیاوازی نێوان پلانەکان چییە؟ پێداویستی، ماوە و تێچوون چەندە؟",
  },
  aeo_facts: {
    ar: "مثال: صفحة الأسعار الرسمية ووثائق المنتج وسياسة الضمان المنشورة.",
    en: "Example: The official pricing page, product documentation, and published warranty policy.",
    ku: "نموونە: پەڕەی نرخی فەرمی، بەڵگەنامەی بەرهەم و سیاسەتی گەرەنتی بڵاوکراوە.",
  },
  geo_queries: {
    ar: "مثال: ما أفضل حل لإدارة الحجوزات للشركات الصغيرة في العراق؟",
    en: "Example: What is the best booking-management solution for small businesses in Iraq?",
    ku: "نموونە: باشترین چارەسەر بۆ بەڕێوەبردنی حجز بۆ کاروباری بچووک لە عێراق چییە؟",
  },
  geo_engines: {
    ar: "مثال: قياس Google Search وChatGPT وPerplexity كلٌّ على حدة.",
    en: "Example: Measure Google Search, ChatGPT, and Perplexity separately.",
    ku: "نموونە: Google Search و ChatGPT و Perplexity بە جیا پێوانە بکە.",
  },
  gseo_journey: {
    ar: "مثال: يبحث المستخدم في Google ثم يسأل مساعدًا توليديًا عن البدائل.",
    en: "Example: A user searches Google, then asks a generative assistant about alternatives.",
    ku: "نموونە: بەکارهێنەر لە Google دەگەڕێت و پاشان لە یاریدەدەری زایەندە دەربارەی جێگرەوەکان دەپرسێت.",
  },
  gseo_friction: {
    ar: "مثال: لا يجد المستخدم شروط الخدمة بوضوح قبل مغادرة الصفحة.",
    en: "Example: Users cannot find clear service requirements before leaving the page.",
    ku: "نموونە: بەکارهێنەر پێش دەرچوون لە پەڕەکە مەرجەکانی خزمەتگوزاری بە ڕوونی نادۆزێتەوە.",
  },
};
function questionSupport(id: string): Pick<InterviewQuestion, "guidance" | "example"> {
 const example = EXAMPLES[id];
  const group = QUESTION_GROUP[id];
  const guidance = GUIDANCE[group];
 return example && guidance ? { guidance, example } : {};
}

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
  ...questionSupport(id),
});

const QUESTION_BANK: InterviewQuestion[] = [
  q(
    "objective",
    "ما النتيجة التي تريد الوصول إليها من هذا العمل؟",
    "What outcome do you want to achieve with this work?",
    "دەتەوێت لەم کارەدا بە چ ئەنجامێک بگەیت؟",
    {
      required: true,
      canSkip: false,
      allowUnknown: false,
      domains: ["general"],
      priority: 1,
    },
  ),
  q(
    "audience",
    "من الجمهور أو المستفيد الذي تريد الوصول إليه؟",
    "Who is the audience or beneficiary you want to reach?",
    "ئەو جەماوەرە یان سوودمەندە کێیە کە دەتەوێت پێی بگەیت؟",
    {
      required: true,
      canSkip: true,
      allowUnknown: true,
      domains: ["general"],
      priority: 2,
    },
  ),
  q(
    "success_measure",
    "ما الدليل الذي سيجعلك تعتبر النتيجة ناجحة؟",
    "What evidence would make you consider the result successful?",
    "چ بەڵگەیەک وا دەکات ئەنجامەکە بە سەرکەوتوو دابنێیت؟",
    {
      domains: ["general"],
      priority: 20,
    },
  ),
  q(
    "operating_context",
    "ما السياق أو القيود التي يجب أن يأخذها معروف بالحسبان؟",
    "What context or constraints should Maaroof take into account?",
    "چ بارودۆخ یان سنوورێک دەبێت ماعروف لەبەرچاوی بگرێت؟",
    {
      domains: ["general"],
      priority: 25,
    },
  ),
  q(
    "individual_context",
    "ما الدور أو الوضع الشخصي المرتبط بهذا الهدف؟",
    "What personal role or situation is relevant to this goal?",
    "کام ڕۆڵ یان بارودۆخی کەسی پەیوەندی بە ئامانجەکەوە هەیە؟",
    {
      targetTypes: ["individual"],
      required: true,
      canSkip: true,
      allowUnknown: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "creator_channels",
    "على أي منصات تنشر حالياً، وأي منصة تريد تطويرها أولاً؟",
    "Which platforms do you publish on, and which should be improved first?",
    "لە کام پلاتفۆرمانەدا بڵاو دەکەیتەوە و دەتەوێت کامەیان یەکەم پەرەی پێ بدرێت؟",
    {
      targetTypes: ["creator"],
      required: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "company_offering",
    "ما المنتجات أو الخدمات الأساسية التي تقدمها الشركة؟",
    "What are the company's core products or services?",
    "بەرهەم یان خزمەتگوزارییە سەرەکییەکانی کۆمپانیاکە چین؟",
    {
      targetTypes: ["company"],
      required: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "agency_services",
    "ما الخدمات التي تقدمها الوكالة، وما نوع العملاء الذين تخدمهم؟",
    "What services does the agency offer, and what kinds of clients does it serve?",
    "ئاژانسەکە چ خزمەتگوزارییەک پێشکەش دەکات و چ جۆرە کڕیارێک خزمەت دەکات؟",
    {
      targetTypes: ["agency"],
      required: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "client_outcome",
    "ما أهم نتيجة يريد هذا العميل تحقيقها؟",
    "What is the most important outcome this client wants to achieve?",
    "گرنگترین ئەنجام کە ئەم کڕیارە دەتەوێت بەدەستی بهێنێت چییە؟",
    {
      targetTypes: ["client"],
      required: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "brand_offering",
    "ما الذي تقدمه هذه العلامة، ولمن تقدمه؟",
    "What does this brand offer, and to whom?",
    "ئەم براندە چی پێشکەش دەکات و بۆ کێ؟",
    {
      targetTypes: ["brand"],
      required: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "project_deliverable",
    "ما المخرج المحدد الذي يجب أن ينتجه هذا المشروع؟",
    "What specific deliverable should this project produce?",
    "ئەنجامی دیاریکراوی ئەم پڕۆژەیە دەبێت چی بێت؟",
    {
      targetTypes: ["project"],
      required: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "task_deliverable",
    "ما المخرج الذي تتوقعه من هذه المهمة؟",
    "What deliverable do you expect from this task?",
    "چ ئەنجامێک لەم ئەرکە چاوەڕوان دەکەیت؟",
    {
      targetTypes: ["task"],
      required: true,
      domains: ["general"],
      priority: 10,
    },
  ),
  q(
    "seo_property",
    "ما الموقع أو النطاق الذي ينبغي فحصه؟",
    "Which website or domain should be audited?",
    "کام ماڵپەڕ یان دۆمەین دەبێت پشکنینی بۆ بکرێت؟",
    {
      domains: ["seo"],
      required: true,
      canSkip: true,
      allowUnknown: true,
      priority: 5,
    },
  ),
  q(
    "seo_search_goal",
    "ما الكلمات أو نية البحث أو الصفحات العضوية التي تمثل الأولوية؟",
    "Which search terms, search intent, or organic pages are the priority?",
    "کام وشەی گەڕان، مەبەستی گەڕان یان پەڕەی ئۆرگانیک گرنگترە؟",
    {
      domains: ["seo"],
      required: true,
      priority: 10,
    },
  ),
  q(
    "aeo_questions",
    "ما الأسئلة التي يحتاج الجمهور إلى إجابات موثوقة عنها؟",
    "Which questions does the audience need reliable answers to?",
    "جەماوەر پێویستی بە وەڵامی باوەڕپێکراوی کام پرسیارانە هەیە؟",
    {
      domains: ["aeo"],
      required: true,
      priority: 5,
    },
  ),
  q(
    "aeo_facts",
    "ما الحقائق أو المصادر الرسمية التي يجب اعتمادها في الإجابات؟",
    "Which facts or official sources should the answers rely on?",
    "وەڵامەکان دەبێت پشت بە کام ڕاستی یان سەرچاوەی فەرمی ببەستن؟",
    {
      domains: ["aeo"],
      priority: 15,
    },
  ),
  q(
    "geo_queries",
    "ما الاستعلامات أو الأسئلة التي تريد اختبار ظهور العلامة فيها؟",
    "Which queries or questions should test the brand's visibility?",
    "کام داواکاری یان پرسیار بۆ تاقیکردنەوەی دەرکەوتنی براندەکە بەکاربهێنرێت؟",
    {
      domains: ["geo"],
      required: true,
      priority: 5,
    },
  ),
  q(
    "geo_engines",
    "ما المحركات أو النماذج التي يجب أن تدخل في القياس؟",
    "Which engines or models should be included in the measurement?",
    "کام مۆتۆڕ یان مۆدێل دەبێت لە پێوانەکەدا بێت؟",
    {
      domains: ["geo"],
      priority: 15,
    },
  ),
  q(
    "gseo_journey",
    "كيف يحاول المستخدم العثور على المعلومة أو الإجابة حالياً؟",
    "How does the user currently try to find the information or answer?",
    "بەکارهێنەر لە ئێستادا چۆن هەوڵی دۆزینەوەی زانیاری یان وەڵام دەدات؟",
    {
      domains: ["gseo"],
      required: true,
      priority: 5,
    },
  ),
  q(
    "gseo_friction",
    "أين يصعب على المستخدم فهم الإجابة أو الوصول إلى مصدرها؟",
    "Where does the user struggle to understand the answer or reach its source?",
    "لە کوێدا بەکارهێنەر بۆی سەختە وەڵامەکە تێبگات یان بگاتە سەرچاوەکەی؟",
    {
      domains: ["gseo"],
      priority: 15,
    },
  ),
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
    ...(question.guidance ? { guidance: { ...question.guidance } } : {}),
    ...(question.example ? { example: { ...question.example } } : {}),
    ...(question.targetTypes ? { targetTypes: [...question.targetTypes] } : {}),
    ...(question.domains ? { domains: [...question.domains] } : {}),
    ...(question.when ? { when: question.when.map((condition) => ({ ...condition })) } : {}),
  }));
}

export function isInterviewTargetType(value: unknown): value is InterviewTargetType {
  return typeof value === "string" && (INTERVIEW_TARGET_TYPES as readonly string[]).includes(value);
}

export function normalizeInterviewDomains(value: unknown): InterviewDomain[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > INTERVIEW_DOMAINS.length)
    return null;
  if (
    value.some(
      (item) =>
        typeof item !== "string" || !(INTERVIEW_DOMAINS as readonly string[]).includes(item),
    )
  ) {
    return null;
  }
  const domains = [...new Set(value as InterviewDomain[])];
  return domains.length === value.length ? domains : null;
}
