// User-guide content per user type. Each user sees only the part that fits them.
export type Persona = "individual" | "company" | "creator" | "store" | "product";
type L3 = { ar: string; en: string; ku: string };
export type PersonaGuide = { key: Persona; label: L3; tools: L3; example: L3 };

export const PERSONAS: PersonaGuide[] = [
  {
    key: "individual",
    label: { ar: "فرد / مستقل", en: "Individual / freelancer", ku: "تاک / سەربەخۆ" },
    tools: { ar: "فحص الظهور لاسمك، أداة التحليل لنبذتك الشخصية، ملفات قراءة الآلة لصفحتك.", en: "Visibility check for your name, Analyze for your bio, machine files for your page.", ku: "پشکنینی دەرکەوتن بۆ ناوت، شیکردنەوە بۆ کورتەی خۆت." },
    example: { ar: "مصمم مستقل يكتب «أفضل مصمم شعارات في أربيل» ويختار 3 نماذج: إذا كان سعر النموذج 20 توكن تكون الكلفة 60 توكن، ويرى أي نموذج يذكر اسمه وبأي ترتيب.", en: "A freelance designer asks \"best logo designer in Erbil\" on 3 engines: at 20 tokens each the cost is 60, and he sees which engine names him and at what rank.", ku: "دیزاینەرێک لەسەر 3 بزوێنەر دەپرسێت: 3×20 = 60 تۆکن." },
  },
  {
    key: "company",
    label: { ar: "شركة", en: "Company", ku: "کۆمپانیا" },
    tools: { ar: "فحص الظهور بكل النماذج التسعة، مقارنة المنافسين، من المعروفين (MKD)، المراقبة المجدولة.", en: "Visibility on all nine engines, competitor compare, MKD discovery, scheduled monitoring.", ku: "دەرکەوتن لەسەر هەر نۆ بزوێنەر، بەراوردی ڕکابەر." },
    example: { ar: "شركة اتصالات تفحص «أفضل باقة إنترنت في العراق» على 9 نماذج بنمط «إشعاري»، تغلق الصفحة وتصلها رسالة: «ذُكرت في 6 من 9».", en: "A telecom checks \"best internet plan in Iraq\" on all 9 engines in notify mode, and gets \"mentioned in 6 of 9\".", ku: "کۆمپانیایەک لەسەر 9 بزوێنەر دەپشکنێت و ئاگادارکردنەوە وەردەگرێت." },
  },
  {
    key: "creator",
    label: { ar: "صانع محتوى", en: "Content creator", ku: "دروستکەری ناوەڕۆک" },
    tools: { ar: "أداة الاقتراح، إعادة الصياغة GEO، أداة التحليل قبل النشر.", en: "Suggestion tool, GEO rewrite, Analyze before publishing.", ku: "پێشنیار، نووسینەوەی GEO، شیکردنەوە پێش بڵاوکردنەوە." },
    example: { ar: "تحلل منشورك فيعطي 48/100، تضغط «أصلح ليتوافق مع GEO» فتُعاد كتابة أوله بحقائقك أنت، ثم تعيد التحليل لترى الفرق.", en: "Your post scores 48/100; press the GEO fix, the opening is rewritten with your own facts, then re-analyze to see the change.", ku: "پۆستەکەت 48 دەهێنێت، چاکی بکە و دووبارە بپشکنە." },
  },
  {
    key: "store",
    label: { ar: "صاحب متجر", en: "Store owner", ku: "خاوەن فرۆشگا" },
    tools: { ar: "فحص الظهور المحلي، ملفات قراءة الآلة (llms.txt وJSON-LD)، بطاقة سلطة العلامة.", en: "Local visibility, machine files (llms.txt & JSON-LD), Brand Authority Card.", ku: "دەرکەوتنی ناوخۆیی، فایلەکانی ئامێر." },
    example: { ar: "متجر عطور يسأل «أفضل متجر عطور في بغداد» على ChatGPT وGemini وPerplexity، ثم ينزّل llms.txt ويضعه في موقعه.", en: "A perfume store asks \"best perfume shop in Baghdad\" on ChatGPT, Gemini and Perplexity, then downloads llms.txt for its site.", ku: "فرۆشگای بۆن لەسەر 3 بزوێنەر دەپرسێت." },
  },
  {
    key: "product",
    label: { ar: "صاحب منتج", en: "Product owner", ku: "خاوەن بەرهەم" },
    tools: { ar: "ماذا لو، استراتيجي GEO، فحص الظهور لاسم المنتج.", en: "What-If, GEO Strategist, visibility for the product name.", ku: "چی دەبێت ئەگەر، ستراتیژیستی GEO." },
    example: { ar: "تطبيق توصيل يجرب في «ماذا لو» إضافة أرقام التغطية، ثم يتحقق فعلياً من نموذجين فقط لتوفير الرصيد.", en: "A delivery app tests adding coverage numbers in What-If, then live-checks only 2 engines to save balance.", ku: "ئەپێک تەنیا 2 بزوێنەر دەپشکنێت بۆ پاشەکەوتی باڵانس." },
  },
];

export const PERSONA_COMMON: Record<"title" | "pick" | "tools" | "example" | "balance" | "modes" | "fix", L3> = {
  title: { ar: "دليلك حسب نوع حسابك", en: "Your guide by account type", ku: "ڕێنمای تۆ بەپێی جۆری هەژمار" },
  pick: { ar: "اختر ما يناسبك — يظهر لك ما يخصك فقط.", en: "Pick what fits you — you only see what concerns you.", ku: "هەڵبژێرە — تەنیا ئەوەی پەیوەندی بە تۆوە هەیە دەبینیت." },
  tools: { ar: "الأدوات الأنسب لك", en: "Best tools for you", ku: "باشترین ئامرازەکان" },
  example: { ar: "مثال عملي", en: "Practical example", ku: "نموونە" },
  balance: { ar: "الرصيد: كل أداة تخصم من رصيدك. قبل «التحقق الفعلي» ترى الكلفة = سعر النموذج × عدد النماذج التي اخترتها، ولا يعمل الزر إن لم يكفِ رصيدك. النتائج المكررة خلال مدة قصيرة تُعاد بلا خصم.", en: "Balance: every tool charges your balance. Before a live check you see cost = price per engine × engines selected; the button is disabled if your balance is short. Repeated identical requests are reused at no charge.", ku: "باڵانس: هەر ئامرازێک لە باڵانست کەم دەکات. تێچوو = نرخ × ژمارەی بزوێنەر." },
  modes: { ar: "طريقة التشغيل: «فوري» تنتظر النتيجة، «إشعاري» يصلك إشعار في صندوق الإشعارات عند الانتهاء، والمراقبة الدورية تُضبط من جدولة معروف. الإدارة قد تحدد ما هو متاح لك.", en: "Run mode: Instant waits for the result; Notify sends you an inbox notification when done; recurring checks are set in Maaroof schedules. Admin may limit what is available to you.", ku: "شێواز: دەستبەجێ، ئاگادارکردنەوە، یان خشتەی ماعروف." },
  fix: { ar: "بعد التحليل: زر «أصلح ليتوافق مع GEO» يعيد صياغة أول النص، وقسم «ملفات قراءة الآلة» يولّد llms.txt وJSON-LD من نصك أنت فقط مجاناً — راجعها قبل وضعها في موقعك.", en: "After Analyze: the GEO fix button rewrites the opening, and the machine files section builds llms.txt and JSON-LD from your own text for free — review before publishing.", ku: "دوای شیکردنەوە: چاککردنی GEO و فایلەکانی ئامێر بەخۆڕایی." },
};
