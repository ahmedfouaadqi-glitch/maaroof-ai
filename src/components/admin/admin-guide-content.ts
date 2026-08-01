// Single source of truth for the admin console structure + its trilingual guide.
// Used by the grouped tab bar, the contextual help strip, and the full "Guide" tab.

export type L3 = { ar: string; en: string; ku: string };

export type AdminSub = {
  key: string;
  label: L3;
  purpose: L3;
  usage: L3;
  warning?: L3;
};

export type AdminGroup = {
  key: string;
  label: L3;
  desc: L3;
  subs: AdminSub[];
};

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    key: "people",
    label: { ar: "المستخدمون والمالية", en: "Users & Finance", ku: "بەکارهێنەران و دارایی" },
    desc: {
      ar: "كل ما يخص الحسابات والصلاحيات والخطط والتوكنات والإيرادات.",
      en: "Everything about accounts, permissions, plans, tokens and revenue.",
      ku: "هەموو شتێک دەربارەی هەژمار، دەسەڵات، پلان، تۆکن و داهات.",
    },
    subs: [
      {
        key: "users",
        label: { ar: "المستخدمون والتوكنات", en: "Users & Tokens", ku: "بەکارهێنەران و تۆکن" },
        purpose: { ar: "عرض كل الحسابات وأرصدة التوكنات واستهلاكها.", en: "See every account with its token balance and usage.", ku: "بینینی هەموو هەژمارەکان لەگەڵ باڵانسی تۆکن." },
        usage: { ar: "ابحث عن مستخدم، عدّل رصيده، امنح أو اسحب صلاحية الإدارة.", en: "Search a user, adjust their balance, grant or revoke admin role.", ku: "بەکارهێنەر بدۆزەرەوە، باڵانس بگۆڕە، دەسەڵاتی ئەدمین بدە یان بیسڕەوە." },
        warning: { ar: "منح صلاحية الإدارة يفتح كل اللوحة — استخدمه بحذر.", en: "Granting admin opens the whole console — use carefully.", ku: "دانی دەسەڵاتی ئەدمین هەموو کۆنسۆڵ دەکاتەوە — وریابە." },
      },
      {
        key: "pricing",
        label: { ar: "شبكة الخطط × الأدوات", en: "Plans × Tools Matrix", ku: "تۆڕی پلان × ئامراز" },
        purpose: { ar: "تحديد أي أداة متاحة لأي خطة.", en: "Decide which tool is available to which plan.", ku: "دیاریکردنی ئەوەی کام ئامراز بۆ کام پلان بەردەستە." },
        usage: { ar: "فعّل أو عطّل الأداة داخل الخطة، ثم احفظ.", en: "Toggle a tool inside a plan, then save.", ku: "ئامراز لەناو پلان کارا/ناکارا بکە و پاشەکەوتی بکە." },
      },
      {
        key: "plans",
        label: { ar: "الخطط والأسعار", en: "Plans & Pricing", ku: "پلان و نرخەکان" },
        purpose: { ar: "إنشاء وتعديل خطط الاشتراك وأسعارها بعملات متعددة.", en: "Create and edit subscription plans and their multi-currency prices.", ku: "دروستکردن و دەستکاری پلانەکان و نرخەکانیان." },
        usage: { ar: "أضف خطة، اضبط الحدود والسعر لكل عملة، ثم انشرها.", en: "Add a plan, set limits and per-currency price, then publish.", ku: "پلان زیاد بکە، سنوور و نرخ دابنێ، پاشان بڵاوی بکەرەوە." },
        warning: { ar: "تغيير السعر ينعكس فورًا على صفحة الأسعار العامة.", en: "A price change is reflected immediately on the public pricing page.", ku: "گۆڕینی نرخ یەکسەر لە پەڕەی نرخەکان دەردەکەوێت." },
      },
      {
        key: "agent",
        label: { ar: "اشتراكات الوكيل", en: "Agent Subscriptions", ku: "بەشداریەکانی بریکار" },
        purpose: { ar: "إدارة إضافات الوكيل الذكي وحصص المهام لكل مستخدم.", en: "Manage agent add-ons and per-user task quotas.", ku: "بەڕێوەبردنی پێدانەکانی بریکار و بڕی ئەرک بۆ هەر بەکارهێنەر." },
        usage: { ar: "امنح اشتراكًا، عدّل الحد الشهري واليومي، أو أوقف الاشتراك.", en: "Grant a subscription, edit monthly/daily caps, or stop it.", ku: "بەشداری بدە، سنووری مانگانە/ڕۆژانە بگۆڕە، یان بیوەستێنە." },
      },
      {
        key: "access",
        label: { ar: "الوصول والظهور", en: "Access & Visibility", ku: "دەستگەیشتن و دەرکەوتن" },
        purpose: { ar: "التحكم بظهور الصفحات والأدوات لكل خطة.", en: "Control page and tool visibility per plan.", ku: "کۆنترۆڵی دەرکەوتنی پەڕە و ئامرازەکان بۆ هەر پلانێک." },
        usage: { ar: "أخفِ أو أظهر صفحة/ميزة، ويسري التغيير مباشرة.", en: "Hide or show a page/feature; the change applies immediately.", ku: "پەڕە/تایبەتمەندی بشارەوە یان پیشان بدە؛ یەکسەر جێبەجێ دەبێت." },
      },
      {
        key: "finance",
        label: { ar: "المالية الموحّدة", en: "Unified Finance", ku: "دارایی یەکگرتوو" },
        purpose: { ar: "صورة واحدة للإيراد والتكلفة وهامش الربح.", en: "One picture of revenue, cost and margin.", ku: "یەک وێنە لە داهات، تێچوو و قازانج." },
        usage: { ar: "راجع التكلفة الفعلية للنماذج مقابل ما يدفعه المشتركون.", en: "Review actual model cost against what subscribers pay.", ku: "تێچووی ڕاستەقینەی مۆدێلەکان لەگەڵ پارەی بەشداران بەراورد بکە." },
      },
    ],
  },
  {
    key: "content",
    label: { ar: "المحتوى والموقع", en: "Content & Site", ku: "ناوەڕۆک و ماڵپەڕ" },
    desc: {
      ar: "نصوص الموقع، الهيدر، التصدير، معلومات الاتصال وحملات تعزيز العلامة.",
      en: "Site copy, header, exports, contact details and brand boost campaigns.",
      ku: "دەقی ماڵپەڕ، هێدەر، هەناردەکردن، زانیاری پەیوەندی و کەمپینەکان.",
    },
    subs: [
      {
        key: "content",
        label: { ar: "نصوص الموقع", en: "Site Text", ku: "دەقی ماڵپەڕ" },
        purpose: { ar: "تعديل أي نص ظاهر في الموقع بالثلاث لغات.", en: "Edit any visible site text in all three languages.", ku: "دەستکاری هەر دەقێکی دیار بە هەر سێ زمان." },
        usage: { ar: "ابحث عن المفتاح، اكتب النص الجديد لكل لغة، ثم احفظ.", en: "Find the key, write the new text per language, then save.", ku: "کلیل بدۆزەرەوە، دەقی نوێ بنووسە و پاشەکەوت بکە." },
        warning: { ar: "النص المعدَّل يتجاوز الترجمة الأصلية للجميع.", en: "An overridden text replaces the built-in translation for everyone.", ku: "دەقی گۆڕدراو شوێنی وەرگێڕانی بنەڕەتی دەگرێتەوە." },
      },
      {
        key: "studio",
        label: { ar: "استوديو المحتوى", en: "Content Studio", ku: "ستۆدیۆی ناوەڕۆک" },
        purpose: { ar: "إنشاء وتحرير صفحات ومقالات المنصة.", en: "Create and edit platform pages and articles.", ku: "دروستکردن و دەستکاری پەڕە و بابەتەکان." },
        usage: { ar: "أنشئ صفحة، اكتب المحتوى، ثم انشرها برابط عام.", en: "Create a page, write the content, publish it on a public URL.", ku: "پەڕە دروست بکە، ناوەڕۆک بنووسە و بڵاوی بکەرەوە." },
      },
      {
        key: "header",
        label: { ar: "الهيدر والروابط", en: "Header & Nav", ku: "هێدەر و بەستەرەکان" },
        purpose: { ar: "التحكم بروابط القائمة العلوية وترتيبها.", en: "Control the top navigation links and their order.", ku: "کۆنترۆڵی بەستەرەکانی سەرەوە و ڕیزبەندییان." },
        usage: { ar: "أظهر/أخفِ رابطًا أو أضف رابطًا خارجيًا.", en: "Show/hide a link or add an external one.", ku: "بەستەرێک پیشان بدە/بشارەوە یان دەرەکی زیاد بکە." },
      },
      {
        key: "exports",
        label: { ar: "إعدادات التصدير", en: "Export Settings", ku: "ڕێکخستنی هەناردەکردن" },
        purpose: { ar: "شكل ملفات PDF/Word التي يصدّرها المستخدمون.", en: "The look of the PDF/Word files users export.", ku: "شێوەی فایلەکانی PDF/Word." },
        usage: { ar: "اضبط الشعار والترويسة والتذييل ولغة التصدير.", en: "Set the logo, header, footer and export language.", ku: "لۆگۆ، سەرپەڕە، پێپەڕە و زمان دیاری بکە." },
      },
      {
        key: "contact",
        label: { ar: "معلومات الاتصال", en: "Contact Info", ku: "زانیاری پەیوەندی" },
        purpose: { ar: "بيانات التواصل الظاهرة للعملاء.", en: "The contact details shown to customers.", ku: "زانیاری پەیوەندی بۆ کڕیاران." },
        usage: { ar: "حدّث الهاتف والبريد وحسابات التواصل.", en: "Update phone, email and social accounts.", ku: "تەلەفۆن، ئیمەیڵ و سۆشیاڵ نوێ بکەرەوە." },
      },
      {
        key: "boost",
        label: { ar: "تعزيز العلامة", en: "Brand Boost", ku: "بەهێزکردنی براند" },
        purpose: { ar: "متابعة طلبات وحملات تعزيز العلامة التجارية.", en: "Track brand boost requests and campaigns.", ku: "بەدواداچوونی داواکاری و کەمپینەکان." },
        usage: { ar: "راجع الطلب، نفّذه أو ارفضه مع سبب واضح.", en: "Review a request, run or reject it with a clear reason.", ku: "داواکاری پێداچوونەوە بکە، جێبەجێ یان ڕەتی بکەرەوە." },
      },
    ],
  },
  {
    key: "maaroof",
    label: { ar: "معروف والذكاء", en: "Maaroof & Intelligence", ku: "مەعروف و زیرەکی" },
    desc: {
      ar: "إعدادات الوكيل الذكي، مركز الذكاء التنفيذي، والرؤى الإدراكية للمستخدمين.",
      en: "Agent settings, the executive intelligence center, and cognitive user insights.",
      ku: "ڕێکخستنەکانی بریکار، ناوەندی زیرەکی و تێگەیشتنەکان.",
    },
    subs: [
      {
        key: "maaroof",
        label: { ar: "إعدادات معروف", en: "Maaroof Settings", ku: "ڕێکخستنی مەعروف" },
        purpose: { ar: "ضبط سلوك الوكيل: النماذج، الحدود، وأوضاع التنفيذ.", en: "Tune agent behaviour: models, limits and execution modes.", ku: "ڕێکخستنی ڕەفتاری بریکار: مۆدێل، سنوور و شێوازەکان." },
        usage: { ar: "فعّل أو عطّل ميزة، وحدد سقف التكلفة لكل تشغيل.", en: "Enable or disable a capability and cap the cost per run.", ku: "تایبەتمەندی کارا بکە و سنووری تێچوو دابنێ." },
        warning: { ar: "وضع التنفيذ الفعلي يسمح للوكيل باتخاذ إجراءات حقيقية.", en: "Real execution mode lets the agent take real-world actions.", ku: "شێوازی جێبەجێکردنی ڕاستەقینە ڕێگە دەدات کردار بکات." },
      },
      {
        key: "maaroof_center",
        label: { ar: "مركز الذكاء", en: "Intelligence Center", ku: "ناوەندی زیرەکی" },
        purpose: { ar: "لوحة تنفيذية: القرارات، الثقة، الخبراء، والواقعية.", en: "Executive board: decisions, trust, experts and reality checks.", ku: "بۆردی جێبەجێکار: بڕیار، متمانە، پسپۆڕان و ڕاستی." },
        usage: { ar: "راقب جودة القرارات ونسب التحقق قبل التوسّع.", en: "Watch decision quality and verification rates before scaling.", ku: "جۆری بڕیارەکان و ڕێژەی پشتڕاستکردنەوە چاودێری بکە." },
      },
      {
        key: "insights",
        label: { ar: "رؤى الإدراك", en: "Cognitive Insights", ku: "تێگەیشتنە مێشکییەکان" },
        purpose: { ar: "أنماط الاستخدام المجمّعة التي تتعلمها المنصة.", en: "Aggregated usage patterns the platform learns.", ku: "شێوازە کۆکراوەکانی بەکارهێنان." },
        usage: { ar: "استخدمها لتحديد الأدوات الأكثر قيمة وتحسين التسعير.", en: "Use it to spot the most valuable tools and refine pricing.", ku: "بەکاری بهێنە بۆ دۆزینەوەی بەنرخترین ئامرازەکان." },
        warning: { ar: "بيانات مجمّعة فقط — لا تُستخدم لكشف هوية مستخدم.", en: "Aggregated data only — never use it to identify a user.", ku: "تەنیا داتای کۆکراوە — بۆ ناسینەوەی کەس بەکاری مەهێنە." },
      },
      {
        key: "intelligence",
        label: { ar: "ذكاء المستخدمين", en: "User Intelligence", ku: "زیرەکی بەکارهێنەران" },
        purpose: { ar: "فهم سلوك المشتركين واحتياجاتهم.", en: "Understand subscriber behaviour and needs.", ku: "تێگەیشتن لە ڕەفتاری بەشداران." },
        usage: { ar: "راجع النشاط والأدوات المستخدمة لدعم قرارات المنتج.", en: "Review activity and tool usage to support product decisions.", ku: "چالاکی و بەکارهێنانی ئامرازەکان پێداچوونەوە بکە." },
      },
    ],
  },
  {
    key: "ops",
    label: { ar: "التشغيل والطلبات", en: "Operations & Requests", ku: "کارکردن و داواکاریەکان" },
    desc: {
      ar: "الصورة العامة، صحة النظام، الزحف، وطلبات المستخدمين المعلّقة.",
      en: "The overview, system health, crawling, and pending user requests.",
      ku: "ڕوانینی گشتی، تەندروستی سیستەم، خشتەکردن و داواکارییەکان.",
    },
    subs: [
      {
        key: "overview",
        label: { ar: "نظرة عامة", en: "Overview", ku: "ڕوانینی گشتی" },
        purpose: { ar: "أرقام المنصة الأساسية في مكان واحد.", en: "The platform's core numbers in one place.", ku: "ژمارە سەرەکییەکان لە یەک شوێن." },
        usage: { ar: "ابدأ يومك من هنا قبل الدخول في التفاصيل.", en: "Start your day here before diving into details.", ku: "ڕۆژەکەت لێرەوە دەست پێ بکە." },
      },
      {
        key: "health",
        label: { ar: "صحة النظام", en: "System Health", ku: "تەندروستی سیستەم" },
        purpose: { ar: "حالة الخدمات والأخطاء والزمن والاستجابة.", en: "Service status, errors, latency and responsiveness.", ku: "دۆخی خزمەتگوزاری، هەڵە و خێرایی." },
        usage: { ar: "افحصها عند أي بطء أو شكوى قبل تعديل الكود.", en: "Check it on any slowdown or complaint before changing code.", ku: "پێش گۆڕینی کۆد سەیری بکە." },
      },
      {
        key: "firecrawl",
        label: { ar: "مراقبة الزحف", en: "Crawl Monitor", ku: "چاودێری خشتەکردن" },
        purpose: { ar: "استهلاك خدمة الزحف ومصادر البيانات الحيّة.", en: "Crawling service usage and live data sources.", ku: "بەکارهێنانی خزمەتی خشتەکردن." },
        usage: { ar: "راقب الحصة المتبقية والصفحات الفاشلة.", en: "Watch the remaining quota and failed pages.", ku: "بڕی ماوە و پەڕە شکستخواردووەکان ببینە." },
      },
      {
        key: "requests",
        label: { ar: "الطلبات", en: "Requests", ku: "داواکاریەکان" },
        purpose: { ar: "طلبات الاشتراك وتغيير التخصص المنتظرة للموافقة.", en: "Subscription and specialty-change requests awaiting approval.", ku: "داواکاری بەشداری و گۆڕینی پسپۆڕی." },
        usage: { ar: "راجع الطلب ثم اقبله أو ارفضه؛ يُبلَّغ المستخدم تلقائيًا.", en: "Review then approve or reject; the user is notified automatically.", ku: "پێداچوونەوە بکە و پەسەند/ڕەت بکەرەوە." },
        warning: { ar: "تغيير التخصص لا يتم إلا من هنا — المستخدم لا يملك الصلاحية.", en: "Specialty changes happen only here — users cannot self-change.", ku: "گۆڕینی پسپۆڕی تەنیا لێرەوە دەبێت." },
      },
    ],
  },
];

export const ADMIN_GUIDE_TITLE: L3 = { ar: "دليل لوحة الإدارة", en: "Admin Console Guide", ku: "ڕێنمای کۆنسۆڵی ئەدمین" };
export const ADMIN_GUIDE_INTRO: L3 = {
  ar: "كل قسم في اللوحة مشروح هنا: ما الغرض منه، ماذا تفعل فيه، وما الذي يجب الانتباه له.",
  en: "Every console section is explained here: its purpose, what you do in it, and what to watch out for.",
  ku: "هەموو بەشێکی کۆنسۆڵ لێرە ڕوونکراوەتەوە: مەبەست، کارکردن و ئاگاداری.",
};
export const ADMIN_GUIDE_SEARCH: L3 = { ar: "ابحث في الدليل…", en: "Search the guide…", ku: "لە ڕێنمادا بگەڕێ…" };
export const ADMIN_HELP_MORE: L3 = { ar: "المزيد في الدليل", en: "More in the guide", ku: "زیاتر لە ڕێنما" };
export const ADMIN_HELP_LABEL: L3 = { ar: "ما هذا القسم؟", en: "What is this section?", ku: "ئەم بەشە چییە؟" };
export const ADMIN_GUIDE_PURPOSE: L3 = { ar: "الغرض", en: "Purpose", ku: "مەبەست" };
export const ADMIN_GUIDE_USAGE: L3 = { ar: "الاستخدام", en: "How to use", ku: "چۆنیەتی بەکارهێنان" };
export const ADMIN_GUIDE_WARN: L3 = { ar: "انتبه", en: "Caution", ku: "ئاگاداری" };

export function findSub(subKey: string) {
  for (const g of ADMIN_GROUPS) {
    const s = g.subs.find((x) => x.key === subKey);
    if (s) return { group: g, sub: s };
  }
  return null;
}
