export type CompetitiveWorkspaceContext = {
  id?: string | null;
  name?: string | null;
  brand_url?: string | null;
  brand_summary?: string | null;
  country?: string | null;
  city?: string | null;
  keywords?: string[] | string | null;
  profile?: Record<string, unknown> | null;
  entity_truth_card?: Record<string, unknown> | null;
  onboarding?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
};

export type CompetitiveContextResolution = {
  brand: string;
  site: string;
  category: string;
  categorySource: "provided" | "workspace" | "inferred" | "unresolved";
};

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function validUrl(value: unknown): string {
  const raw = clean(value, 500);
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

function urlFromText(text: string): string {
  const candidate = text.match(/https?:\/\/[^\s<>"')\]]+/i)?.[0]?.replace(/[.,;!?،؛]+$/, "");
  return validUrl(candidate);
}

function textByKeys(value: unknown, keys: string[], depth = 0): string {
  if (!value || typeof value !== "object" || depth > 4) return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = clean(record[key], 240);
    if (candidate) return candidate;
  }
  for (const [key, child] of Object.entries(record)) {
    if (["links", "evidence", "assets", "documents", "events", "history"].includes(key.toLowerCase())) continue;
    const nested = textByKeys(child, keys, depth + 1);
    if (nested) return nested;
  }
  return "";
}

const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: "Luxury fashion & couture", pattern: /\b(couture|haute couture|luxury fashion|designer gowns?|evening gowns?)\b|أزياء فاخرة|هوت كوتور|فساتين سهرة/gi },
  { category: "Fashion & apparel", pattern: /\b(fashion|apparel|clothing|garments?|dress(?:es)?|bridal wear|wedding dress(?:es)?|boutique|textiles?|shoes?|handbags?|abaya|abayas)\b|أزياء|ملابس|فساتين|أحذية|حقائب|عباءات|عباية/gi },
  { category: "Jewelry & accessories", pattern: /\b(jewelry|jewellery|diamonds?|gold jewelry|watches|accessories)\b|مجوهرات|ألماس|ذهب|ساعات/gi },
  { category: "Beauty, cosmetics & fragrance", pattern: /\b(beauty|cosmetics?|skincare|makeup|perfume|fragrance|hair care)\b|تجميل|مستحضرات تجميل|عطور|عناية بالبشرة/gi },
  { category: "Hotels & hospitality", pattern: /\b(hotels?|resorts?|hospitality|accommodation|booking rooms)\b|فنادق|فندق|ضيافة|منتجع/gi },
  { category: "Restaurants & food", pattern: /\b(restaurants?|cafes?|coffee shops?|catering|food products?)\b|مطاعم|مطعم|مقهى|أغذية|طعام/gi },
  { category: "Real estate & property", pattern: /\b(real estate|property|apartments?|residential|commercial property)\b|عقارات|عقار|شقق سكنية/gi },
  { category: "Software & digital services", pattern: /\b(software|saas|digital agency|mobile app|web development|cloud services|cybersecurity)\b|برمجيات|تطبيقات|خدمات رقمية|تطوير مواقع/gi },
  { category: "Electronics & technology", pattern: /\b(electronics|smartphones?|computers?|laptops?|consumer electronics)\b|إلكترونيات|هواتف ذكية|حواسيب/gi },
  { category: "Furniture & interior design", pattern: /\b(furniture|interior design|home decor|lighting fixtures)\b|أثاث|تصميم داخلي|ديكور منزلي/gi },
  { category: "Automotive", pattern: /\b(automotive|cars?|car dealership|auto parts|vehicle repair)\b|سيارات|قطع غيار|مركبات/gi },
];

export function inferCategoryFromSignals(signals: Array<string | null | undefined>): string {
  const text = signals.map((part) => clean(part, 6000)).filter(Boolean).join("\n");
  if (!text) return "";
  let winner = "";
  let highest = 0;
  for (const rule of CATEGORY_RULES) {
    const score = (text.match(rule.pattern) || []).length;
    if (score > highest) {
      winner = rule.category;
      highest = score;
    }
  }
  return winner;
}

export function resolveCompetitiveContext(input: {
  explicitBrand?: string | null;
  explicitSite?: string | null;
  explicitCategory?: string | null;
  workspace?: CompetitiveWorkspaceContext | null;
  requestText?: string | null;
  workbookSignals?: Array<string | null | undefined>;
}): CompetitiveContextResolution {
  const workspace = input.workspace || {};
  const truth = workspace.entity_truth_card || {};
  const requestText = clean(input.requestText, 12000);
  const site =
    validUrl(input.explicitSite) ||
    validUrl(workspace.brand_url) ||
    validUrl(textByKeys(truth, ["website_url", "official_url", "url"])) ||
    urlFromText(requestText);

  const truthName = textByKeys(truth, ["entity_name", "brand_name", "company_name", "organization_name"]);
  const requestBrand = requestText.match(/(?:brand(?: name)?|اسم العلامة|العلامة التجارية)\s*[:：=]\s*([^\n،,;]{2,100})/i)?.[1] || "";
  let brand = clean(input.explicitBrand, 120) || clean(workspace.name, 120) || truthName || clean(requestBrand, 120);
  if (!brand && site) {
    try {
      brand = new URL(site).hostname.replace(/^www\./i, "").replace(/\.(com|org|net|co|io|ai|shop|store)(\.[a-z]{2,})?$/i, "").replace(/[._-]+/g, " ");
    } catch {}
  }

  const isGenericCategory = (value: string) => /^(retail|e-?commerce|shop|store|business|company|client|brand|general|متجر|متجر إلكتروني|تجارة إلكترونية|تجارة تجزئة|شركة|علامة تجارية)$/i.test(value.trim());
  const summary = clean(workspace.brand_summary, 240);
  const usableSummary = summary && !isGenericCategory(summary) ? summary : "";
  const profileCategory = textByKeys(workspace.profile, ["industry", "sector", "category", "business_type", "specialty", "specialization", "business_description", "industry_name"]);
  const truthCategory = textByKeys(truth, ["sector", "industry", "category", "business_category", "product_category", "business_type"]);
  const onboardingCategory = textByKeys(workspace.onboarding, ["industry", "sector", "category", "business_type", "specialty", "business_description"]);
  const workspaceCategory = usableSummary || [profileCategory, truthCategory, onboardingCategory].map((value) => isGenericCategory(value) ? "" : value).find(Boolean) || "";
  const explicitCategory = clean(input.explicitCategory, 240);
  const inferred = inferCategoryFromSignals([
    brand,
    site,
    requestText,
    workspace.name,
    workspace.brand_summary,
    workspace.country,
    workspace.city,
    JSON.stringify(workspace.keywords || ""),
    ...(input.workbookSignals || []),
    JSON.stringify(workspace.profile || {}),
    JSON.stringify(workspace.entity_truth_card || {}),
    JSON.stringify(workspace.onboarding || {}),
  ]);

  const category = explicitCategory || workspaceCategory || inferred;
  const categorySource: CompetitiveContextResolution["categorySource"] = explicitCategory
    ? "provided"
    : workspaceCategory
      ? "workspace"
      : inferred
        ? "inferred"
        : "unresolved";

  return { brand, site, category: category.slice(0, 240), categorySource };
}
