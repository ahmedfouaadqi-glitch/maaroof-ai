// Skills catalog for the intelligent workspace (workbench).
// Pure, data-only module: no server imports, no side effects.
// Each skill maps 1:1 to real tools that already exist in TOOL_CATALOG.

export type SkillIconKey = "search" | "chart" | "target" | "sparkles" | "trending" | "compass";

export type MaaroofSkillAccessMode = "self_service" | "contact" | "disabled";

export type MaaroofSkill = {
  key: string;
  icon: SkillIconKey;
  label: { ar: string; en: string; ku: string };
  description: { ar: string; en: string; ku: string };
  /** Tool keys (from TOOL_CATALOG) the skill is served by. */
  tools: string[];
  /** Keywords used for lightweight goal matching across ar/en/ku. */
  keywords: string[];
};

export const MAAROOF_SKILLS: MaaroofSkill[] = [
  {
    key: "presence_audit",
    icon: "search",
    label: { ar: "تدقيق الحضور في الإجابات", en: "Answer Presence Audit", ku: "پشکنینی دەرکەوتن لە وەڵامەکان" },
    description: {
      ar: "نفحص كيف تظهر علامتك داخل إجابات النماذج، ونسبة الذكر، والفجوات القائمة.",
      en: "We check how your brand appears inside model answers, mention rate, and existing gaps.",
      ku: "دەپشکنین چۆن براندەکەت لە ناو وەڵامەکاندا دەردەکەوێت و بۆشاییەکان دەناسین.",
    },
    tools: ["known", "visibility"],
    keywords: ["حضور", "ظهور", "ذكر", "علامتي", "الماركة", "البراند", "شهرتي", "السمعة", "دەرکەوتن", "ناوی من", "براند", "presence", "visibility", "brand", "mention"],
  },
  {
    key: "competitor_gap",
    icon: "trending",
    label: { ar: "فجوات المنافسين والسوق", en: "Competitor & Market Gaps", ku: "بۆشایی ڕکابەران و بازاڕ" },
    description: {
      ar: "نقارن موقعك بالمنافسين ونرصد فجوات المحتوى والحصة الصوتية في السوق.",
      en: "We compare your site with competitors and track content gaps and share of voice.",
      ku: "ماڵپەڕەکەت بە ڕکابەرانەوە بەراورد دەکەین و بۆشایی ناوەڕۆک دەبینین.",
    },
    tools: ["compare", "competitor_monitor"],
    keywords: ["منافس", "المنافسين", "السوق", "مقارنة", "فجوات", "الحصة", "رقابت", "بازاڕ", "بەراورد", "competitor", "market", "compare", "gap"],
  },
  {
    key: "entity_readiness",
    icon: "target",
    label: { ar: "جاهزية الهوية والبيانات المهيكلة", en: "Entity & Structured Data Readiness", ku: "ئامادەیی ناسنامە و داتای ڕێکخراو" },
    description: {
      ar: "نقيس جاهزية موقعك للقراءة الآلية: البيانات المهيكلة، كثافة الحقائق، وملفات الآلة.",
      en: "We measure how machine-readable your site is: structured data, fact density, and machine files.",
      ku: "دەپێۊین ماڵپەڕەکەت چەند بۆ ئامێر خوێندنەوە ئامادەیە.",
    },
    tools: ["analyze", "brand_authority"],
    keywords: ["هوية", "الهوية", "بيانات", "سكيمة", "المخطط", "تحليل", "جاهزية", "الموقع", "ناسنامە", "شیکار", "entity", "schema", "audit", "site", "website"],
  },
  {
    key: "growth_roadmap",
    icon: "compass",
    label: { ar: "خطة نمو مخصصة", en: "Tailored Growth Roadmap", ku: "پلانی گەشەی تایبەت" },
    description: {
      ar: "نبني خطة نمو على مدة تختارها أنت، مرتبطة بأدوات محددة وخطوات قابلة للقياس.",
      en: "We build a growth plan over a duration you choose, linked to specific tools and measurable steps.",
      ku: "پلانی گەشە بۆ ماوەیەک کە خۆت هەڵدەبژێرێت دروست دەکەین.",
    },
    tools: ["geo_strategist"],
    keywords: ["خطة", "تخطيط", "نمو", "استراتيجية", "طريق", "پلان", "گەشە", "ستراتیژی", "plan", "strategy", "roadmap", "growth"],
  },
  {
    key: "citation_content",
    icon: "sparkles",
    label: { ar: "محتوى جاهز للاقتباس", en: "Citation-Ready Content", ku: "ناوەڕۆکی ئامادە بۆ ئیستناد" },
    description: {
      ar: "نكتب محتوى غنياً بالحقائق والإحصاءات، مع ملخص قابل للاقتباس في أول الأسطر.",
      en: "We write fact-rich content with a quotable summary at the top.",
      ku: "ناوەڕۆکی دەوڵەمەند بە ڕاستی و ئامار دەنووسین.",
    },
    tools: ["suggest", "geo_rewrite"],
    keywords: ["محتوى", "كتابة", "مقال", "إعادة", "صياغة", "اقتباس", "ناوەڕۆک", "نووسین", "content", "article", "rewrite", "citation"],
  },
];

/**
 * Lightweight goal-to-skill matching. Pure keyword scoring over ar/en/ku terms.
 * Returns matched skills ordered by score (best first), up to `limit`.
 * Returns an empty list when nothing matches; the caller decides the fallback.
 */
export function recommendMaaroofSkills(goal: string, limit: number = MAAROOF_SKILLS.length): MaaroofSkill[] {
  const text = String(goal || "").toLowerCase();
  if (!text.trim()) return [];
  const scored = MAAROOF_SKILLS
    .map((skill) => {
      let score = 0;
      for (const keyword of skill.keywords) {
        const k = keyword.toLowerCase();
        if (!text.includes(k)) continue;
        // Whole-ish keyword (surrounded by non-letters) scores higher than a substring hit.
        const boundary = new RegExp(`(^|[^\\p{L}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(text);
        score += boundary ? 2 : 1;
      }
      return { skill, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit)).map((entry) => entry.skill);
}

/** Union of tool keys for the selected skills, preserving first-seen order. */
export function toolsForSkills(selectedSkills: string[]): string[] {
  const tools: string[] = [];
  for (const key of selectedSkills) {
    const skill = MAAROOF_SKILLS.find((item) => item.key === key);
    if (!skill) continue;
    for (const tool of skill.tools) if (!tools.includes(tool)) tools.push(tool);
  }
  return tools;
}

/** Effective access mode for a skill, defaulting to self-service. */
export function getSkillAccessMode(skill: MaaroofSkill, access: Record<string, MaaroofSkillAccessMode>): MaaroofSkillAccessMode {
  const mode = access?.[skill.key];
  return mode === "contact" || mode === "disabled" ? mode : "self_service";
}

/** Default policy: every skill is self-service until an admin policy says otherwise. */
export function defaultSkillAccessPolicy(): Record<string, MaaroofSkillAccessMode> {
  return Object.fromEntries(MAAROOF_SKILLS.map((skill) => [skill.key, "self_service" as const]));
}
