import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLandingData } from "@/lib/landing.functions";
import { ArrowRight, Sparkles, Target, ShieldCheck, LayoutGrid, Check, X, BadgeCheck, Phone, Mail, MapPin, ChevronDown, Mouse } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { ENGINES } from "@/components/engine-logos";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";
import { SkillDetailsDialog } from "@/components/landing/SkillDetailsDialog";
import { useCountry } from "@/lib/use-country";
import type { InterfacePolicy } from "@/lib/interface-policy";
import { Reveal } from "@/components/motion/Reveal";
import { SpotlightCard, CountUp, RotatingText, ShinyText, LogoLoop, Magnetic } from "@/components/motion/effects";
import { ModelInsights } from "@/components/landing/ModelInsights";

type L = "ar" | "en" | "ku";

function HeroPulses() {
  return (
    <div aria-hidden className="mx-auto flex h-10 w-56 items-center justify-center gap-3 text-primary">
      <span className="size-1.5 rounded-full bg-current opacity-35" />
      <span className="h-px w-7 bg-current opacity-20" />
      <span className="size-2 rounded-full border border-current opacity-65" />
      <span className="h-px w-7 bg-current opacity-20" />
      <span className="size-2.5 rounded-full bg-current opacity-80 motion-safe:animate-pulse" />
      <span className="h-px w-7 bg-current opacity-20" />
      <span className="size-1.5 rounded-full bg-current opacity-35" />
    </div>
  );
}

function VisibilityVector() {
  return (
    <div aria-hidden className="mx-auto mt-8 w-full max-w-[34rem]">
      <svg viewBox="0 0 544 132" fill="none" className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="visibility-line" x1="28" y1="66" x2="516" y2="66" gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" stopOpacity=".08" />
            <stop offset=".5" stopColor="currentColor" stopOpacity=".42" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".08" />
          </linearGradient>
        </defs>
        <path d="M42 66H502M132 66V34H204M132 66V98H204M412 34H458V66M412 98H458V66" stroke="url(#visibility-line)" strokeWidth="1.2" />
        <path d="M204 34H238M204 98H238M306 34H340M306 98H340" stroke="currentColor" strokeOpacity=".18" strokeWidth="1.2" strokeDasharray="3 5" />
        <rect x="238.5" y="39.5" width="67" height="53" rx="14" fill="currentColor" fillOpacity=".035" stroke="currentColor" strokeOpacity=".22" />
        <circle cx="272" cy="66" r="13" stroke="var(--primary)" strokeWidth="1.5" />
        <circle cx="272" cy="66" r="4" fill="var(--primary)" />
        <circle cx="132" cy="66" r="5" fill="var(--background)" stroke="currentColor" strokeOpacity=".42" strokeWidth="1.4" />
        <circle cx="204" cy="34" r="4" fill="var(--background)" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.2" />
        <circle cx="204" cy="98" r="4" fill="var(--background)" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.2" />
        <circle cx="340" cy="34" r="4" fill="var(--background)" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.2" />
        <circle cx="340" cy="98" r="4" fill="var(--background)" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.2" />
        <circle cx="412" cy="34" r="4" fill="var(--background)" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.2" />
        <circle cx="412" cy="98" r="4" fill="var(--background)" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.2" />
        <circle cx="458" cy="66" r="5" fill="var(--background)" stroke="var(--primary)" strokeOpacity=".7" strokeWidth="1.4" />
        <circle cx="42" cy="66" r="3" fill="var(--primary)" fillOpacity=".6" />
        <circle cx="502" cy="66" r="3" fill="var(--primary)" fillOpacity=".6" />
        <circle cx="272" cy="66" r="24" stroke="var(--primary)" strokeOpacity=".12" strokeWidth="1" className="motion-safe:animate-pulse" />
        <circle r="2.8" fill="var(--primary)" className="visibility-vector-flow visibility-vector-flow-a"><animateMotion dur="4.8s" repeatCount="indefinite" path="M42 66H502" /></circle>
        <circle r="2.4" fill="var(--primary)" className="visibility-vector-flow visibility-vector-flow-b"><animateMotion dur="4.8s" begin="-1.6s" repeatCount="indefinite" path="M42 66H502" /></circle>
        <circle r="2.2" fill="var(--primary)" className="visibility-vector-flow visibility-vector-flow-c"><animateMotion dur="4.8s" begin="-3.2s" repeatCount="indefinite" path="M502 66H42" /></circle>
      </svg>
    </div>
  );
}

const COPY = {
  ar: {
    badge: "مساحة العمل الذكية",
    title: "نعزّز ظهور علامتك الرقمية عبر منظومة البحث والذكاء الاصطناعي",
    rotPrefix: "نحسّن ظهورك عبر",
    brandName: "MAAROOF Ai", sub: "منصة لذكاء الظهور والكيانات، تساعد العلامات التجارية على تنظيم إشارات هويتها القابلة للتحقق وتقييم ظهورها في محركات البحث وتجارب إجابات الذكاء الاصطناعي.",
    cta: "اتصل بنا", trialCta: "جرّب فحص الظهور مجاناً", pro: "واجهة المحترفين",
    engines: "يُسأل كل محرك من المحركات العشرة",
    how: "كيف يعمل", s1: ["حدّد هدفك", "اكتب ما تريده بلغتك وبأي مدة."], s2: ["راجع الخطة والكلفة", "نعرض الأدوات المختارة وسبب اختيارها وكلفتها مقابل رصيدك."], s3: ["تابع التنفيذ والأدلة", "كل نموذج وحالته وسبب كل نتيجة أمامك."],
    core: "منظومة الظهور ومؤشرها التكاملي",
    pillars: [
      ["SEO", "البنية", "صفحات قابلة للزحف وبيانات منظمة تفهمها الآلة."],
      ["AEO", "الإجابات المباشرة", "محتوى يجيب عن السؤال في أول سطرين."],
      ["GEO", "كثافة الحقائق", "إحصاءات واقتباسات تجعل النماذج تستشهد بك."],
      ["SGE", "تلخيصات البحث", "حضور داخل الملخصات التوليدية أعلى نتائج البحث."],
      ["GSEO", "اتساق الهوية", "هوية واحدة متسقة عبر المحركات والمنصات."],
      ["SGEO", "مؤشر معروف التكاملي", "يقيس التقاطع والتشابه والاختلاف بين SEO وAEO وGEO وSGE، ويعرض تكاملها دون إخفاء نتيجة كل محور."],
    ],
    vsTitle: "البحث التقليدي مقابل محركات الإجابة",
    vsCols: ["البحث التقليدي", "محركات الإجابة التوليدية"],
    vsRows: [["قائمة روابط", "إجابة مباشرة واحدة"], ["النجاح = نقرة", "النجاح = اقتباس"], ["كلمات مفتاحية", "حقائق وكيانات"], ["ترتيب الصفحة", "ثقة المصدر واتساقه"]],
    truth: "هوية واضحة. حضور يُفهم.",
    truthSub: "نحوّل معلومات علامتك إلى هوية رقمية منظمة، قابلة للفهم والتحقق عبر بيئات البحث والذكاء الاصطناعي.",
    truthFields: { name: "الاسم", type: "النوع", country: "البلد", links: "الروابط الرسمية", consistency: "اكتمال البطاقة", markets: "الأسواق المستهدفة" },
    types: "لكل نوع حساب طريقه",
    accountTypes: [
      ["شركة تبيع منتجاتها", "ظهور المنتجات في إجابات الشراء والمقارنة."],
      ["شركة تسويقية", "إثبات الخبرة والحضور في أسئلة القطاع."],
      ["وكالة إخبارية", "أن تكون مصدراً موثوقاً تقتبسه النماذج."],
      ["صانع محتوى", "ربط اسمك بموضوعاتك حتى بلا موقع رسمي."],
      ["شخصية عامة", "سيرة دقيقة ومتسقة وفك تشابه الأسماء."],
      ["فرد", "هوية رقمية واضحة تبدأ من الصفر."],
      ["وكالة تسويقية لديها عملاء", "مساحات منفصلة لكل عميل بهويته."],
    ],
    skills: "المهارات المتاحة",
    stats: ["نماذج ذكاء اصطناعي", "مهارات جاهزة", "أدوات مسجلة", "لغات مدعومة", "مرات استخدام التجربة المجانية"],
    faq: "أسئلة شائعة",
    faqs: [
      ["هل الإجابات حقيقية؟", "نعم، كل نتيجة تأتي من سؤال فعلي للنماذج مع حالة وسبب واضحين، ولا نختلق نتائج."],
      ["متى يُخصم الرصيد؟", "بعد نجاح العملية فقط، ونعرض الكلفة قبل التنفيذ."],
      ["هل أحتاج موقعاً؟", "لا، نعمل أيضاً مع صناع المحتوى والأفراد بلا موقع أو حسابات."],
    ],
    final: "ابدأ الآن واعرف كيف تراك النماذج العشرة",
    classic: "الصفحة الكلاسيكية",
  },
  en: {
    badge: "Smart Workspace",
    title: "Strengthen your digital visibility across search and AI ecosystems",
    rotPrefix: "We improve your visibility through",
    brandName: "MAAROOF Ai", sub: "analyzes your digital presence across search engines, answer engines and AI platforms, then identifies evidence-led opportunities for improvement.",
    cta: "Contact us", trialCta: "Try free AI visibility", pro: "Professional interface",
    engines: "Each of the ten engines is asked",
    how: "How it works", s1: ["Set your goal", "Write what you want, in your language, for any duration."], s2: ["Review plan and cost", "See the chosen tools, why, and their cost against your balance."], s3: ["Follow execution and evidence", "Every model, its status and the reason behind each result."],
    core: "Visibility ecosystem and its integrated index",
    pillars: [
      ["SEO", "Structure", "Crawlable pages and machine-readable structured data."],
      ["AEO", "Direct answers", "Content that answers the question in its first lines."],
      ["GEO", "Fact density", "Statistics and quotes that make models cite you."],
      ["SGE", "Search summaries", "Presence inside generative summaries at the top of search."],
      ["GSEO", "Identity consistency", "A consistent identity across engines and platforms."],
      ["SGEO", "Maaroof Integrated Index", "Measures overlap, similarity and divergence across SEO, AEO, GEO and SGE, then reads how they work together without hiding each axis result."],
    ],
    vsTitle: "Traditional search vs answer engines",
    vsCols: ["Traditional search", "Generative answer engines"],
    vsRows: [["List of links", "One direct answer"], ["Success = a click", "Success = a citation"], ["Keywords", "Facts and entities"], ["Page ranking", "Source trust and consistency"]],
    truth: "Make your identity understood.",
    truthSub: "Turn your brand information into a structured, verifiable digital identity across search and AI environments.",
    truthFields: { name: "Name", type: "Type", country: "Country", links: "Official links", consistency: "Card completeness", markets: "Target markets" },
    types: "Every account type has its path",
    accountTypes: [
      ["Product company", "Products appear in buying and comparison answers."],
      ["Marketing company", "Prove expertise in sector questions."],
      ["News agency", "Become a trusted source models quote."],
      ["Content creator", "Tie your name to your topics, even without a website."],
      ["Public figure", "An accurate, consistent bio and name disambiguation."],
      ["Individual", "A clear digital identity from scratch."],
      ["Agency with clients", "Separate spaces for each client and identity."],
    ],
    skills: "Available skills",
    stats: ["AI engines", "Ready skills", "Registered tools", "Supported languages", "Free trial runs"],
    faq: "FAQ",
    faqs: [
      ["Are the answers real?", "Yes. Every result comes from a real query with a clear status and reason. Nothing is fabricated."],
      ["When is my balance charged?", "Only after success, and the cost is shown before running."],
      ["Do I need a website?", "No. We also work with creators and individuals without a site or accounts."],
    ],
    final: "Start now and see how the ten models see you",
    classic: "Classic page",
  },
  ku: {
    badge: "شوێنی کاری زیرەک",
    title: "دەرکەوتنی دیجیتاڵی براندەکەت لە گەڕان و زیرەکی دەستکرددا بەهێز بکە",
    rotPrefix: "دەرکەوتنت باشتر دەکەین لە ڕێگەی",
    brandName: "MAAROOF Ai", sub: "پلاتفۆرمێک بۆ زیرەکی دەرکەوتن و قەوارەکانە؛ یارمەتی براندەکان دەدات نیشانەکانی ناسنامەی پشتڕاستکراو ڕێکبخەن و دەرکەوتنیان لە گەڕان و وەڵامەکانی زیرەکی دەستکرد هەڵبسەنگێنن.",
    cta: "پەیوەندیمان پێوە بکە", trialCta: "تاقیکردنەوەی خۆڕایی دەرکەوتن", pro: "ڕووکاری پسپۆڕان",
    engines: "هەر دە بزوێنەرەکە پرسیاریان لێ دەکرێت",
    how: "چۆن کار دەکات", s1: ["ئامانج دیاری بکە", "بە زمانی خۆت و بۆ هەر ماوەیەک بنووسە."], s2: ["پلان و تێچوو ببینە", "ئامرازە هەڵبژێردراوەکان و هۆکار و تێچوویان ببینە."], s3: ["جێبەجێکردن و بەڵگە", "هەر مۆدێلێک و دۆخی و هۆکاری هەر ئەنجامێک."],
    core: "سیستەمی دەرکەوتن و پێوەری تێکەڵی",
    pillars: [
      ["SEO", "پێکهاتە", "پەڕەی خوێندراوە و داتای ڕێکخراو بۆ ئامێر."],
      ["AEO", "وەڵامی ڕاستەوخۆ", "ناوەڕۆکێک لە یەکەم دێڕدا وەڵام دەداتەوە."],
      ["GEO", "چڕی ڕاستییەکان", "ئامار و وتە کە مۆدێلەکان ئاماژەت پێ دەکەن."],
      ["SGE", "پوختەی گەڕان", "ئامادەبوون لە پوختە زیرەکەکانی سەرەوەی گەڕان."],
      ["GSEO", "یەکگرتوویی ناسنامە", "ناسنامەیەکی یەکگرتوو لە بزوێنەر و پلاتفۆرمەکان."],
      ["SGEO", "پێوەری تێکەڵی معروف", "هاوبەشی، لێکچوون و جیاوازیی SEO و AEO و GEO و SGE دەپێوێت و کاریگەریی تێکەڵبوونیان دەخوێنێتەوە."],
    ],
    vsTitle: "گەڕانی ئاسایی بەرامبەر بزوێنەرەکانی وەڵام",
    vsCols: ["گەڕانی ئاسایی", "بزوێنەرە زیرەکەکانی وەڵام"],
    vsRows: [["لیستی بەستەر", "یەک وەڵامی ڕاستەوخۆ"], ["سەرکەوتن = کلیک", "سەرکەوتن = ئاماژەپێدان"], ["وشەی سەرەکی", "ڕاستی و قەوارە"], ["ڕیزبەندی پەڕە", "متمانە و یەکگرتوویی سەرچاوە"]],
    truth: "ناسنامەیەکی ڕوون. دەرکەوتنێکی تێگەیشتوو.",
    truthSub: "زانیاریی براندەکەت دەگۆڕین بۆ ناسنامەیەکی دیجیتاڵی ڕێکخراو و پشتڕاستکراو لە ژینگەکانی گەڕان و زیرەکی دەستکرد.",
    truthFields: { name: "ناو", type: "جۆر", country: "وڵات", links: "بەستەرە فەرمییەکان", consistency: "تەواوبوونی کارت", markets: "بازاڕە ئامانجەکان" },
    types: "هەر جۆرە هەژمارێک ڕێگای خۆی هەیە",
    accountTypes: [
      ["کۆمپانیای فرۆشتنی بەرهەم", "دەرکەوتنی بەرهەم لە وەڵامەکانی کڕین."],
      ["کۆمپانیای بازاڕگەری", "سەلماندنی شارەزایی لە پرسیارەکانی کەرت."],
      ["ئاژانسی هەواڵ", "ببە بە سەرچاوەیەکی متمانەپێکراو."],
      ["دروستکەری ناوەڕۆک", "ناوت بە بابەتەکانتەوە ببەستە."],
      ["کەسایەتی گشتی", "ژیاننامەیەکی ورد و جیاکردنەوەی ناوە هاوشێوەکان."],
      ["تاک", "ناسنامەیەکی دیجیتاڵی ڕوون لە سفرەوە."],
      ["ئاژانسی بازاڕگەری بە کڕیارەوە", "شوێنی جیا بۆ هەر کڕیارێک."],
    ],
    skills: "کارامەییە بەردەستەکان",
    stats: ["مۆدێلەکانی زیرەک", "کارامەیی ئامادە", "ئامرازە تۆمارکراوەکان", "زمانی پشتگیریکراو", "ژمارەی بەکارهێنانی تاقیکردنەوەی خۆڕایی"],
    faq: "پرسیارە باوەکان",
    faqs: [
      ["وەڵامەکان ڕاستەقینەن؟", "بەڵێ، هەر ئەنجامێک لە پرسیارێکی ڕاستەقینەوە دێت بە دۆخ و هۆکاری ڕوون."],
      ["کەی باڵانس دەبڕدرێت؟", "تەنها دوای سەرکەوتن، و تێچوو پێشتر پیشان دەدرێت."],
      ["پێویستم بە ماڵپەڕە؟", "نەخێر، لەگەڵ دروستکەران و تاکەکانی بێ ماڵپەڕیش کار دەکەین."],
    ],
    final: "ئێستا دەست پێبکە و بزانە دە مۆدێلەکە چۆن دەتبینن",
    classic: "پەڕەی کلاسیک",
  },
} as const;

const PILLAR_WORDS = ["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"];

export function NewLanding({ policy }: { policy: InterfacePolicy }) {
  const { lang } = useI18n();
  const l: L = lang === "en" || lang === "ku" ? lang : "ar";
  const c = COPY[l];
  const [data, setData] = useState<{ skills: string[] | null } | null>(null);
  const [freeTrialAttempts, setFreeTrialAttempts] = useState<number | null>(null);
  useEffect(() => { getLandingData().then(setData).catch(() => setData({ skills: null })); }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => fetch("/api/visibility-trial-usage", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => { if (active) setFreeTrialAttempts(result.available ? Number(result.totalStarted) : null); })
      .catch(() => { if (active) setFreeTrialAttempts(null); });
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  const skills = data?.skills ? MAAROOF_SKILLS.filter((s) => data.skills!.includes(s.key)) : MAAROOF_SKILLS;
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const showPro = policy.available_interfaces.includes("professional") && policy.show_professional_link;
  const taxonomyGroups = l === "ar" ? [
    { title: "مجالات التخصص", terms: "SEO · GEO · ASO · AIO", note: "مجالات مرتبطة بتحسين الظهور والاكتشاف عبر البحث والمنصات." },
    { title: "منهجيات التحسين", terms: "AEO · SGEO · GSEO", note: "أطر وأساليب تشغيلية؛ SGEO وGSEO لهما تعريفهما داخل معروف وليسا معيارين عالميين موحدين." },
    { title: "بيئات البحث", terms: "SGE · AI Search · LLMs", note: "واجهات وتجارب ومحركات تُرصد فيها إجابات ومظاهر الظهور." },
    { title: "التقنيات المعرفية", terms: "RAG · KG · Entity Intelligence", note: "مفاهيم وتقنيات لدعم الاسترجاع المعرفي وتمثيل الكيانات والعلاقات." },
  ] : l === "ku" ? [
    { title: "بواری پسپۆڕی", terms: "SEO · GEO · ASO · AIO", note: "بواری پەیوەندیدار بە باشترکردنی دەرکەوتن لە گەڕان و پلاتفۆرمەکان." },
    { title: "میتۆدۆلۆژیای باشترکردن", terms: "AEO · SGEO · GSEO", note: "چوارچێوە و شێوازی کار؛ SGEO و GSEO لە معروف پێناسەی تایبەتیان هەیە و ستانداردی جیهانی یەکگرتوو نین." },
    { title: "ژینگەکانی گەڕان", terms: "SGE · AI Search · LLMs", note: "ڕووکار و ئەزموون و بزوێنەرەکانی گەڕان کە وەڵام و دەرکەوتن تێیاندا چاودێری دەکرێت." },
    { title: "تەکنەلۆژیای زانیاری", terms: "RAG · KG · Entity Intelligence", note: "چەمک و تەکنەلۆژیا بۆ گەڕاندنەوەی زانیاری و نوێنەرایەتی قەوارە و پەیوەندییەکان." },
  ] : [
    { title: "Specialty areas", terms: "SEO · GEO · ASO · AIO", note: "Domains concerned with visibility and discovery across search and platforms." },
    { title: "Optimization methodologies", terms: "AEO · SGEO · GSEO", note: "Operational approaches; SGEO and GSEO have Maaroof-specific definitions, not universally standardized meanings." },
    { title: "Search environments", terms: "SGE · AI Search · LLMs", note: "Interfaces, experiences and engines where answers and visibility can be observed." },
    { title: "Knowledge technologies", terms: "RAG · KG · Entity Intelligence", note: "Concepts and technologies for retrieval, knowledge representation and entity relationships." },
  ];

  const ctaClass = "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]";
  const Cta = () => (
    <Magnetic>
      <details className="group relative inline-block text-start">
        <summary className={ctaClass + " cursor-pointer list-none"}>{c.cta} <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
        <div className="absolute bottom-full start-1/2 z-50 mb-3 w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-primary/25 bg-card/95 p-4 text-start shadow-2xl backdrop-blur-xl">
          <div className="mb-3 text-sm font-semibold">MAAROOF Ai · Contact</div>
          <a href="tel:+9647733570130" dir="ltr" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/60"><Phone className="size-4 text-primary" /> +964 773 357 0130</a>
          <a href="mailto:ahmedfouaad.qi@gmail.com" dir="ltr" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/60"><Mail className="size-4 text-primary" /> ahmedfouaad.qi@gmail.com</a>
          <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground"><MapPin className="size-4 text-primary" /> Beirut, Lebanon</div>
        </div>
      </details>
    </Magnetic>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* 1. Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-16 text-center md:pt-24">
            <HeroPulses />
            <CountryWelcome lang={l} />
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-gradient md:text-6xl">{c.title}</h1>
            <p className="mt-4 text-lg font-semibold md:text-2xl">
              {c.rotPrefix} <RotatingText words={PILLAR_WORDS} className="text-primary" />
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg"><strong className="font-display text-xl font-extrabold text-primary md:text-2xl">{c.brandName}</strong> — {c.sub}</p>
            <VisibilityVector />
            <div className="mt-6 flex justify-center">
              <Link to="/free-audit" search={{}} className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/5 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/10">{c.trialCta} <ArrowRight className="size-4 rtl:rotate-180" /></Link>
            </div>
            <div className="mt-8">
              <ModelInsights lang={l} />
            </div>
            <a href="#marketing-entity" className="group mt-10 inline-flex flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75 transition hover:text-primary">
              <span>{l === "en" ? "Scroll to discover" : l === "ku" ? "بۆ دۆزینەوە بڕۆ خوارەوە" : "مرّر لاكتشاف المزيد"}</span>
              <span aria-hidden className="relative h-9 w-px overflow-hidden bg-border"><span className="absolute inset-x-0 top-0 h-3 bg-primary motion-safe:animate-bounce" /></span>
              <Mouse className="size-4 opacity-70 transition-transform group-hover:translate-y-1" />
            </a>
          </div>
        </section>

        {/* 2. Live, server-backed stats */}
        <section className="mx-auto max-w-5xl px-4 pb-16" aria-label={c.stats[4]}>
          <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-3 lg:grid-cols-3">
            {[ENGINES.length, skills.length, TOOL_CATALOG.filter((tool) => tool.group === "tools").length, 3, freeTrialAttempts].map((n, i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-4 shadow-sm transition-colors duration-200 hover:border-primary/40">
                {i === 4 && <div aria-hidden className="pointer-events-none absolute -end-5 -top-5 size-20 rounded-full border border-primary/15 transition-transform duration-500 group-hover:scale-125" />}
                {n === null ? (
                  <span className="relative font-display text-3xl font-bold text-muted-foreground md:text-4xl" aria-live="polite">—</span>
                ) : (
                  <CountUp to={n} className="relative font-display text-3xl font-bold text-gradient md:text-4xl" />
                )}
                <div className="relative mt-1 text-xs text-muted-foreground">{c.stats[i]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Engines loop */}
        <section className="mx-auto max-w-5xl px-4 pb-14">
          <p className="mb-3 text-center text-xs text-muted-foreground">{c.engines}</p>
          <LogoLoop>
            {ENGINES.map((e) => (
              <span key={e.name} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs">
                <e.Logo size={14} /> {e.name}
              </span>
            ))}
          </LogoLoop>
        </section>

        {/* 4. How it works */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.how}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[{ i: Target, t: c.s1 }, { i: ShieldCheck, t: c.s2 }, { i: Sparkles, t: c.s3 }].map((s, n) => (
              <Reveal key={n} delay={n * 80}>
                <SpotlightCard className="h-full p-5">
                  <s.i className="size-5 text-primary" />
                  <h3 className="mt-3 font-semibold">{n + 1}. {s.t[0]}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.t[1]}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 5. Search and AI visibility disciplines */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.core}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {c.pillars.map(([k, t, d], n) => (
              <Reveal key={k} delay={n * 60}>
                <SpotlightCard className="h-full p-4">
                  <ShinyText className="font-mono text-lg font-bold">{k}</ShinyText>
                  <div className="mt-1 text-sm font-semibold">{t}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{d}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 6. Classification: domains, methods, environments and technologies */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid gap-3 sm:grid-cols-2">
            {taxonomyGroups.map((group) => (
              <Reveal key={group.title}>
                <SpotlightCard className="h-full p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
                  <p className="mt-3 font-mono text-lg font-bold tracking-wide text-primary">{group.terms}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{group.note}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 7. Comparison */}
        <section className="mx-auto max-w-4xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.vsTitle}</h2>
          <Reveal>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-2 bg-muted/40 text-sm font-semibold">
                <div className="p-3">{c.vsCols[0]}</div><div className="p-3 text-primary">{c.vsCols[1]}</div>
              </div>
              {c.vsRows.map(([a, b]) => (
                <div key={a} className="grid grid-cols-2 border-t border-border text-sm">
                  <div className="flex items-center gap-2 p-3 text-muted-foreground"><X className="size-4 shrink-0 text-destructive" />{a}</div>
                  <div className="flex items-center gap-2 p-3"><Check className="size-4 shrink-0 text-success" />{b}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* 7. Marketing entity identity card */}
        <section id="marketing-entity" className="mx-auto max-w-5xl scroll-mt-24 px-4 pb-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles className="size-3.5" /> {l === "en" ? "Entity intelligence" : l === "ku" ? "زیرەکی قەوارە" : "ذكاء الكيانات"}</div>
              <h2 className="font-display text-3xl font-bold md:text-4xl">{c.truth}</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">{c.truthSub}</p>
              <p className="mt-5 text-sm font-semibold text-foreground/90">{l === "en" ? "Identity → Evidence → Understanding → Visibility" : l === "ku" ? "ناسنامە ← بەڵگە ← تێگەیشتن ← دەرکەوتن" : "هوية ← أدلة ← فهم ← ظهور"}</p>
            </div>
            <Reveal>
              <SpotlightCard className="relative isolate overflow-hidden rounded-3xl border border-primary/25 bg-[#080d19] p-6 text-white shadow-[0_24px_90px_-35px_rgba(245,178,35,0.35)]">
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
                  <svg viewBox="0 0 520 300" className="absolute inset-0 h-full w-full" fill="none">
                    <g stroke="#E9AD27" strokeOpacity=".28" strokeWidth="1"><path d="M10 220 105 90 205 150 315 48 500 110M105 90 140 270 315 48 390 250 500 110M10 220 140 270 390 250M205 150 390 250" /></g>
                    {[[10,220],[105,90],[205,150],[315,48],[500,110],[140,270],[390,250]].map(([x,y],idx)=><circle key={idx} cx={x} cy={y} r="3" fill="#F5B323" className="motion-safe:animate-pulse" />)}
                    <circle cx="260" cy="150" r="34" stroke="#F5B323" strokeOpacity=".45" /><circle cx="260" cy="150" r="5" fill="#F5B323" /><circle cx="260" cy="150" r="54" stroke="#F5B323" strokeOpacity=".18" strokeDasharray="3 8" />
                  </svg>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent motion-safe:animate-pulse" />
                </div>
                <div className="relative">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold tracking-[0.22em] text-amber-300">MAAROOF Ai</span><BadgeCheck className="size-5 text-amber-300" /></div>
                  <div className="mt-12"><p className="max-w-sm text-2xl font-bold leading-tight md:text-3xl">{l === "en" ? "Be understood. Be discoverable." : l === "ku" ? "بفهمرێ. بدۆزرێیتەوە." : "كن مفهوماً. كن قابلاً للاكتشاف."}</p><p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">{l === "en" ? "A coherent identity gives people and AI systems a clearer picture of who you are." : l === "ku" ? "ناسنامەیەکی یەکگرتوو وێنەیەکی ڕوونتر لە تۆ بۆ خەڵک و سیستەمە زیرەکەکان دروست دەکات." : "هوية متسقة تمنح الأشخاص وأنظمة الذكاء الاصطناعي صورة أوضح عنك."}</p></div>
                  <div className="mt-8 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">{[["01",l === "en" ? "Identity" : l === "ku" ? "ناسنامە" : "الهوية"],["02",l === "en" ? "Evidence" : l === "ku" ? "بەڵگە" : "الأدلة"],["03",l === "en" ? "Visibility" : l === "ku" ? "دەرکەوتن" : "الظهور"]].map(([num,label])=><div key={num}><span className="block text-[10px] text-amber-300">{num}</span><span className="mt-1 block text-[11px] font-medium text-slate-200">{label}</span></div>)}</div>
                </div>
              </SpotlightCard>
            </Reveal>
          </div>
        </section>

        {/* 8. Account types */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.types}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.accountTypes.map(([t, d], n) => (
              <Reveal key={t} delay={n * 40}>
                <SpotlightCard className="h-full p-4">
                  <div className="text-sm font-semibold">{t}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{d}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 9. Skills */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-center font-display text-3xl font-bold">{c.skills}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => (
              <button key={s.key} type="button" onClick={() => setOpenSkill(s.key)} className="block h-full text-start">
                <SpotlightCard className="h-full p-4 transition hover:border-primary/40">
                  <div className="text-sm font-semibold">{s.label[l]}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description[l]}</p>
                </SpotlightCard>
              </button>
            ))}
          </div>
          <SkillDetailsDialog skillKey={openSkill} l={l} onClose={() => setOpenSkill(null)} />
          <div className="hidden">
          </div>
        </section>



        {/* 10. FAQ + final CTA */}
        <section className="mx-auto max-w-3xl px-4 pb-20">
          <h2 className="text-center font-display text-3xl font-bold">{c.faq}</h2>
          <div className="mt-6 space-y-2">
            {c.faqs.map(([q, a]) => (
              <article key={q} className="rounded-xl border border-border bg-card/40 p-4">
                <h3 className="text-sm font-semibold">{q}</h3>
                <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">{l === "en" ? "Answer:" : l === "ku" ? "وەڵام:" : "الإجابة:"}</strong> {a}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3 text-start">{l === "en" ? "Aspect" : l === "ku" ? "لایەن" : "الجانب"}</th>
                  <th className="p-3 text-start">{l === "en" ? "Traditional SEO" : l === "ku" ? "SEOی باو" : "تحسين محركات البحث التقليدي"}</th>
                  <th className="p-3 text-start">MAAROOF AI</th>
                </tr>
              </thead>
              <tbody>
                {(l === "en"
                  ? [["Goal", "Rank in search results", "Be mentioned and cited inside AI answers"], ["Measurement", "Keyword rank", "Real questions to ten AI engines"], ["Machine-readable files", "Sitemap", "llms.txt and Organization JSON-LD"]]
                  : l === "ku"
                  ? [["ئامانج", "پلەبەندی لە ئەنجامی گەڕان", "ناوهێنان لە وەڵامی زیرەکی دەستکرد"], ["پێوان", "پلەی وشە", "پرسیاری ڕاستەقینە بۆ دە مۆدێل"], ["فایلی خوێندنەوەی ئامێر", "Sitemap", "llms.txt و JSON-LD"]]
                  : [["الهدف", "الترتيب في نتائج البحث", "الذكر والاقتباس داخل إجابات الذكاء الاصطناعي"], ["القياس", "ترتيب الكلمة المفتاحية", "أسئلة حقيقية لعشرة نماذج ذكاء اصطناعي"], ["ملفات قراءة الآلة", "خريطة الموقع", "llms.txt وبيانات Organization JSON-LD"]]
                ).map(([a, b, c2]) => (
                  <tr key={a} className="border-t border-border"><td className="p-3 font-medium">{a}</td><td className="p-3 text-muted-foreground">{b}</td><td className="p-3">{c2}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-12 text-center">
            <h3 className="font-display text-2xl font-bold">{c.final}</h3>
            <div className="mt-5 flex justify-center"><Cta /></div>
          </div>
          <div className="mt-10 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="size-12 shrink-0 overflow-hidden" aria-hidden="true">
                <img src="/joint-media-house-holding-mark.png" alt="" className="h-12 w-auto max-w-none" />
              </span>
              <span className="text-sm font-semibold tracking-wide text-foreground/80">Joint Media House Holding</span>
            </div>
            <p className="text-xs tracking-wide text-muted-foreground">
              {l === "en" ? "Supported and sponsored by" : l === "ku" ? "بە پشتگیری و ڕەعایەتی" : "بدعم ورعاية"}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function CountryWelcome({ lang }: { lang: "ar" | "en" | "ku" }) {
  const { info } = useCountry();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || !info || !info.code) return null;
  const name = lang === "en" ? info.name_en : lang === "ku" ? info.name_ku : info.name_ar;
  const text = lang === "en" ? `Welcome, visitors from ${name}` : lang === "ku" ? `بەخێربێن، میوانانی ${name}` : `أهلاً بزوارنا من ${name}`;
  return <p className="mt-4 text-sm font-medium text-muted-foreground">{info.flag} {text}</p>;
}
