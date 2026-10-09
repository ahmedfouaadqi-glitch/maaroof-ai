// Unified, public user-guide content (trilingual). No internal details.
export type L3 = { ar: string; en: string; ku: string };

export type GuideBlock = { key: string; title: L3; points: L3[] };

export const GUIDE_ESSENTIALS: GuideBlock[] = [
  {
    key: "meaning",
    title: { ar: "المعنى", en: "The Meaning", ku: "واتا" },
    points: [
      { ar: "صار الناس يسألون الذكاء الاصطناعي مباشرة بدل تصفح الروابط.", en: "People now ask AI directly instead of browsing links.", ku: "خەڵک ئێستا ڕاستەوخۆ پرسیار لە زیرەکی دەستکرد دەکەن." },
      { ar: "الهدف أن تكون علامتك هي الإجابة الموثوقة التي يذكرها.", en: "The goal: make your brand the trusted answer it names.", ku: "ئامانج: براندەکەت ببێتە وەڵامی متمانەپێکراو." },
    ],
  },
  {
    key: "method",
    title: { ar: "المنهج", en: "The Approach", ku: "ڕێباز" },
    points: [
      { ar: "وضوح ودقة: حقائق محددة وأرقام صريحة بدل العبارات العامة.", en: "Clarity: specific facts and clear figures over vague claims.", ku: "ڕوونی: ڕاستی و ژمارەی دیاریکراو." },
      { ar: "هوية ثابتة: الاسم والخدمات والمعلومات نفسها في كل مكان.", en: "Consistent identity: same name, services and details everywhere.", ku: "ناسنامەی جێگیر: هەمان ناو و زانیاری لە هەموو شوێنێک." },
      { ar: "مصداقية دون مبالغة: ما يُقال يجب أن يكون قابلاً للتحقق.", en: "Credibility without hype: everything must be verifiable.", ku: "متمانە بێ زیادەڕۆیی: هەموو شتێک دەبێت پشتڕاستکراو بێت." },
    ],
  },
  {
    key: "nature",
    title: { ar: "طبيعة الاستخدام", en: "How It Works for You", ku: "سروشتی بەکارهێنان" },
    points: [
      { ar: "رصيد واحد لجميع الأدوات، والتكلفة تظهر قبل التشغيل.", en: "One balance for all tools; cost is shown before you run.", ku: "یەک باڵانس بۆ هەموو ئامرازەکان؛ تێچوو پێشتر دەردەکەوێت." },
      { ar: "اختر التشغيل الفوري أو استلام إشعار عند الانتهاء.", en: "Run instantly, or get notified when it's done.", ku: "ڕاستەوخۆ کاری پێبکە، یان ئاگادار بکرێیتەوە." },
      { ar: "نتائجك تُحفظ في سجلك ويمكنك تصديرها في أي وقت.", en: "Results are saved to your history and exportable anytime.", ku: "ئەنجامەکان پاشەکەوت دەکرێن و هەناردە دەکرێن." },
    ],
  },
];

export const GUIDE_STEPS: { title: L3; body: L3 }[] = [
  { title: { ar: "اعرف موقعك", en: "Know where you stand", ku: "شوێنی خۆت بزانە" }, body: { ar: "افحص ظهور علامتك في إجابات الذكاء الاصطناعي وتعرّف على منافسيك.", en: "Check how your brand appears in AI answers and who competes with you.", ku: "بزانە براندەکەت چۆن دەردەکەوێت و ڕکابەرەکانت کێن." } },
  { title: { ar: "حسّن محتواك وهويتك", en: "Improve content & identity", ku: "ناوەڕۆک و ناسنامە باشتر بکە" }, body: { ar: "أعد صياغة نصوصك بوضوح، وجهّز بطاقة علامتك وملفاتها.", en: "Rewrite your text clearly and prepare your brand card and files.", ku: "دەقەکانت ڕوون بنووسەوە و کارتی براند ئامادە بکە." } },
  { title: { ar: "اختبر الإجابات فعلياً", en: "Test real answers", ku: "وەڵامەکان تاقی بکەوە" }, body: { ar: "اسأل النماذج التي تختارها وشاهد ما تقوله عنك فعلاً.", en: "Ask the models you choose and see what they actually say.", ku: "پرسیار لەو مۆدێلانە بکە کە هەڵیدەبژێریت." } },
  { title: { ar: "تابع وصدّر", en: "Track & export", ku: "بەدواداچوون و هەناردە" }, body: { ar: "راقب تطورك، واستخرج تقارير احترافية، أو كلّف المساعد بالمتابعة.", en: "Follow your progress, export reports, or let the assistant follow up.", ku: "پێشکەوتن ببینە، ڕاپۆرت هەناردە بکە." } },
];

export const GUIDE_STEPS_TITLE: L3 = { ar: "طريقة الاستخدام — أربع خطوات", en: "How to use — four steps", ku: "شێوازی بەکارهێنان — چوار هەنگاو" };
