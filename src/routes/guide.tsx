import { createFileRoute, Link } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { BookOpen, Wrench, Bot, Globe2, User, Share2 } from "lucide-react";
import { TOOL_CATALOG, type ToolKey } from "@/lib/tool-catalog";
import { HowItWorks } from "@/components/HowItWorks";
import { usePageGuard } from "@/lib/visibility";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";
import { GUIDE_ESSENTIALS, GUIDE_STEPS, GUIDE_STEPS_TITLE } from "@/lib/guide-personas";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Guide · MAAROOF Ai" },
      { name: "description", content: "How to use the Maaroof workspace: goals, skills, the ten AI models, deep audit, work modes and exports." },
      { property: "og:title", content: "Guide · MAAROOF Ai" },
      { property: "og:description", content: "Guide to the Maaroof workspace and skills." },
      { property: "og:url", content: "https://maaroofai.com/guide" },
    ],
    links: [{ rel: "canonical", href: "https://maaroofai.com/guide" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "MAAROOF Ai Guide",
          description:
            "How to use the Maaroof workspace: goals, skills, the ten AI models, deep audit, work modes and exports.",
          url: "https://maaroofai.com/guide",
          isPartOf: { "@type": "WebSite", name: "MAAROOF Ai", url: "https://maaroofai.com" },
          hasPart: TOOL_CATALOG.filter((td) =>
            ["analyze", "suggest", "compare", "visibility", "brand_boost"].includes(td.key),
          ).map((td) => ({
            "@type": "WebPage",
            name: td.labels.en,
            url: `https://maaroofai.com/tools/${td.key}`,
          })),
        }),
      },
    ],
  }),
  component: () => <I18nProvider><GuidePage /></I18nProvider>,
});

const HOWTO_KEY: Record<ToolKey, string> = {
  analyze: "guide_how_analyze",
  suggest: "guide_how_suggest",
  compare: "guide_how_compare",
  known: "guide_how_known",
  feasibility: "guide_how_feasibility",
  bizdev: "guide_how_bizdev",
  research: "guide_how_research",
  visibility: "guide_how_visibility",
  brand_boost: "guide_how_brand_boost",
  company_email: "guide_how_company_email",
  applied_ranking: "guide_how_applied_ranking",
  geo_strategist: "guide_how_geo_strategist",
  competitor_monitor: "guide_how_competitor_monitor",
  social_analysis: "guide_how_social_analysis",
  what_if: "guide_how_what_if",
  brand_authority: "guide_how_brand_authority",
  geo_rewrite: "guide_how_geo_rewrite",
  maaroof: "guide_how_maaroof",
  translate: "guide_how_translate",
  "agent.command": "guide_how_agent_command",
  "agent.run_targets": "guide_how_agent_targets",
  "agent.visibility": "guide_how_agent_visibility",
  teach_space: "guide_how_teach_space",
};

function GuidePage() {
  const { t, lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  usePageGuard();


  const tools = TOOL_CATALOG.filter((x) => x.group === "tools");
  const agent = TOOL_CATALOG.filter((x) => x.group === "agent");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-gradient flex items-center gap-2">
          <BookOpen /> {t("guide_title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("guide_intro")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/guide/what-is-geo" className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm font-semibold text-primary hover:underline">
            What is GEO? →
          </Link>
          <Link to="/guide/geo-vs-aeo" className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm font-semibold text-primary hover:underline">
            GEO vs AEO →
          </Link>
          <Link to="/guide/arabic-kurdish-geo" className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm font-semibold text-primary hover:underline">
            Arabic & Kurdish GEO →
          </Link>
        </div>



        {WS_GUIDE.map((sec) => (
          <Section key={sec.title.en} icon={<BookOpen className="size-5" />} title={sec.title[L]}>
            <ul className="list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-foreground/85">
              {sec.items[L].map((it) => <li key={it}>{it}</li>)}
            </ul>
          </Section>
        ))}

        <Section icon={<Wrench className="size-5" />} title={L === "en" ? "Skills" : L === "ku" ? "کارامەییەکان" : "المهارات"}>
          <p className="text-sm text-muted-foreground">{L === "en" ? "Every tool now works as part of a skill. Pick skills yourself or let Maaroof choose them from your goal." : L === "ku" ? "هەموو ئامرازێک ئێستا بەشێکە لە کارامەییەک. خۆت هەڵیبژێرە یان با مەعروف لە ئامانجەکەتەوە هەڵیبژێرێت." : "كل أداة أصبحت جزءاً من مهارة. اختر المهارات بنفسك أو دع معروف يختارها من هدفك."}</p>
          {MAAROOF_SKILLS.map((s) => (
            <div key={s.key} className="rounded-2xl border border-border bg-card/70 p-5">
              <h3 className="font-display text-base font-bold">{s.label[L]}</h3>
              <p className="mt-1 text-sm text-foreground/85">{s.description[L]}</p>
              <p className="mt-2 text-xs text-muted-foreground">{L === "en" ? "Tools used: " : L === "ku" ? "ئامرازەکان: " : "الأدوات المستخدمة: "}{s.tools.map((k) => TOOL_CATALOG.find((td) => td.key === k)?.labels[L] || k).join(" · ")}</p>
            </div>
          ))}
        </Section>

        <div className="mt-8 text-center"><Link to="/workspace" className="text-sm text-primary hover:underline">{L === "en" ? "Open the workspace →" : L === "ku" ? "کردنەوەی شوێنی کار ←" : "افتح مساحة العمل ←"}</Link></div>
      </main>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold text-gradient">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">{icon}</span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToolRow({ toolKey, name, cost, body }: { toolKey: ToolKey; name: string; cost: number; body?: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-bold">{name}</h3>
        <span className="ms-auto rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          {cost}× {t("guide_cost_unit")}
        </span>
      </div>
      {body && <p className="text-sm text-foreground/85 leading-relaxed">{body}</p>}
      <HowItWorks toolKey={toolKey} />
    </div>
  );
}

function GuideEssentials({ L }: { L: "ar" | "en" | "ku" }) {
  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        {GUIDE_ESSENTIALS.map((b) => (
          <div key={b.key} className="rounded-2xl border border-border bg-card/70 p-5">
            <h2 className="font-display text-lg font-bold text-gradient">{b.title[L]}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/85">
              {b.points.map((p, i) => (
                <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{p[L]}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div>
        <h2 className="mb-3 font-display text-xl font-bold text-gradient">{GUIDE_STEPS_TITLE[L]}</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {GUIDE_STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card/70 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 font-bold text-primary">{i + 1}</span>
              <div>
                <h3 className="font-display text-base font-bold">{s.title[L]}</h3>
                <p className="mt-1 text-sm text-foreground/85 leading-relaxed">{s.body[L]}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

type T3 = { ar: string; en: string; ku: string };
const WS_GUIDE: { title: T3; items: { ar: string[]; en: string[]; ku: string[] } }[] = [
  {
    title: { ar: "كيف تبدأ", en: "Getting started", ku: "چۆن دەست پێبکەیت" },
    items: {
      ar: ["اكتب هدفك بجملة واضحة في مساحة العمل، مثل: «أريد أن تذكر النماذج علامتي عند السؤال عن أفضل مطعم».", "حدد نطاقك الجغرافي بالترتيب: الدولة ثم الإقليم ثم المحافظة ثم المدينة، أو اتركه عالمياً.", "يعرض معروف خطة العمل والكلفة التقديرية ورصيدك، ولا يبدأ إلا بموافقتك.", "تعمل المهمة في الخلفية؛ يمكنك إغلاق الصفحة والعودة لاحقاً."],
      en: ["Write your goal clearly in the workspace, e.g. “I want AI models to mention my brand when asked about the best restaurant”.", "Set your location in order: country, region, province, city — or keep it worldwide.", "Maaroof shows the plan, the estimated cost and your balance, and only starts after you approve.", "Tasks run in the background; you can close the page and come back."],
      ku: ["ئامانجەکەت بە ڕوونی لە شوێنی کار بنووسە.", "شوێنەکەت بە ڕیز دیاری بکە: وڵات، هەرێم، پارێزگا، شار — یان جیهانی بیهێڵەوە.", "مەعروف پلان و تێچوو و باڵانسەکەت پیشان دەدات و تەنها دوای ڕەزامەندیت دەست پێدەکات.", "ئەرکەکان لە پاشبنەمادا کار دەکەن."],
    },
  },
  {
    title: { ar: "النماذج العشرة", en: "The ten models", ku: "دە مۆدێلەکە" },
    items: {
      ar: ["يسأل معروف افتراضياً عشرة نماذج: ChatGPT وGemini وClaude وPerplexity وCopilot وGrok وMistral وDeepSeek وKimi وQwen.", "يمكنك اختيار نماذج محددة أو إيقاف الفحص المباشر من مساحة العمل.", "تُعرض إجابات النماذج كما هي، ولا يُختلق أي رقم أو مصدر."],
      en: ["By default Maaroof asks ten models: ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi and Qwen.", "You can pick specific models or turn off live checking in the workspace.", "Model answers are shown as they are; no number or source is invented."],
      ku: ["بە شێوەی بنەڕەت مەعروف پرسیار لە دە مۆدێل دەکات: ChatGPT، Gemini، Claude، Perplexity، Copilot، Grok، Mistral، DeepSeek، Kimi و Qwen.", "دەتوانیت مۆدێلی دیاریکراو هەڵبژێریت.", "هیچ ژمارە یان سەرچاوەیەک دروست ناکرێت."],
    },
  },
  {
    title: { ar: "الفحص العميق", en: "Deep audit", ku: "پشکنینی قووڵ" },
    items: {
      ar: ["يقرأ موقعك الرسمي وصفحاتك وحساباتك على المنصات ويقيسها على خمسة محاور: SEO وAEO وGEO وSGE وGSEO.", "الموقع الرئيسي يأخذ المحاور الخمسة، والصفحات الداخلية أربعة، والحسابات الاجتماعية GSEO وGEO.", "يظهر «نبض الحساب» في مساحة العمل، ويمكنك تحويل أي نقطة ضعف إلى مهمة بضغطة.", "الخصم مرة واحدة في النهاية، وعن الروابط التي قُرئت فعلاً فقط."],
      en: ["Reads your official site, pages and social accounts and measures them on five axes: SEO, AEO, GEO, SGE and GSEO.", "The main site gets all five, inner pages four, social accounts GSEO and GEO.", "The account pulse appears in the workspace; turn any weak point into a task with one click.", "You are charged once at the end, only for links actually read."],
      ku: ["ماڵپەڕ و پەڕە و هەژمارەکانت لەسەر پێنج تەوەر دەپێوێت: SEO، AEO، GEO، SGE و GSEO.", "ماڵپەڕی سەرەکی هەر پێنج تەوەر، پەڕەکانی ناوەوە چوار، هەژماری کۆمەڵایەتی GSEO و GEO.", "هەر خاڵێکی لاواز دەتوانیت بیکەیتە ئەرک.", "تەنها یەکجار لە کۆتاییدا و بۆ بەستەرە خوێندراوەکان پارە دەبڕدرێت."],
    },
  },
  {
    title: { ar: "أوضاع العمل الثلاثة", en: "Three work modes", ku: "سێ شێوازی کار" },
    items: {
      ar: ["التنفيذ: يشغّل المهارات فعلاً ويعطيك النتائج.", "التوصية: يقترح ما يجب فعله دون تنفيذ كامل.", "المحاكاة: يتوقع أثر الخطة قبل تنفيذها.", "كل وضع تشغيل حقيقي بكلفة حقيقية، ولا خصم إلا عند النجاح."],
      en: ["Execution: runs the skills and gives you results.", "Recommendation: suggests what to do without full execution.", "Simulation: predicts the effect of the plan before running it.", "Each mode is a real run with a real cost; you are charged only on success."],
      ku: ["جێبەجێکردن: کارامەییەکان کار پێدەکات.", "پێشنیار: پێشنیاری کار دەکات.", "هاوشێوەکردن: کاریگەری پلان پێشبینی دەکات.", "تەنها لە کاتی سەرکەوتندا پارە دەبڕدرێت."],
    },
  },
  {
    title: { ar: "التصدير", en: "Exporting", ku: "هەناردەکردن" },
    items: {
      ar: ["صدّر أي نتيجة بصيغة PDF أو Word أو Excel أو CSV أو PowerPoint أو Markdown أو JSON.", "اختر لغة التقرير (العربية أو English أو کوردی) من قائمة التصدير، بغض النظر عن لغة الموقع أو لغة النص المكتوب."],
      en: ["Export any result as PDF, Word, Excel, CSV, PowerPoint, Markdown or JSON.", "Choose the report language (Arabic, English or Kurdish) in the export menu, regardless of the site language or the text language."],
      ku: ["هەر ئەنجامێک بە PDF، Word، Excel، CSV، PowerPoint، Markdown یان JSON هەناردە بکە.", "زمانی ڕاپۆرت لە لیستی هەناردەکردن هەڵبژێرە، جیاواز لە زمانی ماڵپەڕ."],
    },
  },
];
