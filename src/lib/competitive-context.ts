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
  { category: "Luxury fashion & couture", pattern: /\b(couture|haute couture|luxury fashion|designer gowns?|evening gowns?|designer dress(?:es)?|evening dress(?:es)?)\b|أزياء فاخرة|هوت كوتور|فساتين سهرة/gi },
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
  { category: "Healthcare & medical", pattern: /\b(healthcare|medical|clinic|clinics|hospital|hospitals|dentist|dentistry|pharmacy|pharmacies|diagnostic|medical devices|patient care)\b|رعاية صحية|صحة|طبي|طبية|مستشفى|مستشفيات|عيادة|عيادات|طبيب|أطباء|صيدلية|صيدليات|أجهزة طبية/gi },
  { category: "Education & training", pattern: /\b(education|school|schools|university|universities|college|colleges|training|e-?learning|course|courses|academy|academies|tutoring)\b|تعليم|مدرسة|مدارس|جامعة|جامعات|كلية|كليات|تدريب|تعلم إلكتروني|دورات|أكاديمية|أكاديميات/gi },
  { category: "Finance & banking", pattern: /\b(fintech|finance|financial services|banking|bank|banks|accounting|accountant|investment|investments|wealth management|payment processing|trading platform)\b|مالية|تمويل|خدمات مالية|مصارف|مصرف|بنوك|بنك|محاسبة|محاسب|استثمار|إدارة الثروات|معالجة المدفوعات/gi },
  { category: "Insurance", pattern: /\b(insurance|insurer|insurers|insurance broker|insurance brokerage|life insurance|health insurance|auto insurance)\b|تأمين|تأمينات|شركة تأمين|وسيط تأمين|تأمين صحي|تأمين سيارات/gi },
  { category: "Legal services", pattern: /\b(law firm|law firms|lawyer|lawyers|attorney|attorneys|legal services|legal counsel|solicitor|solicitors)\b|محاماة|محامي|محامون|مكتب محاماة|خدمات قانونية|مستشار قانوني/gi },
  { category: "Industrial & manufacturing", pattern: /\b(manufacturing|manufacturer|manufacturers|industrial equipment|industrial supplies|factory|factories|machinery|machine parts|automation systems|safety equipment|wholesale distributor)\b|تصنيع|مصنع|مصانع|معدات صناعية|مستلزمات صناعية|آلات|ماكينات|قطع آلات|أنظمة أتمتة|معدات سلامة|موزع جملة/gi },
  { category: "Construction & engineering", pattern: /\b(construction|contractor|contractors|civil engineering|engineering consultancy|architect|architecture firm|building materials|HVAC|plumbing services|electrical contractor)\b|إنشاءات|مقاولات|مقاول|هندسة مدنية|استشارات هندسية|مهندس معماري|مكتب هندسي|مواد بناء|تكييف|سباكة|مقاول كهرباء/gi },
  { category: "Logistics & transportation", pattern: /\b(logistics|freight|shipping company|cargo|courier|delivery service|supply chain|warehousing|transportation|fleet management|moving company)\b|لوجستيات|شحن|شركة شحن|بضائع|نقل بضائع|توصيل|سلسلة الإمداد|مستودعات|نقل|إدارة الأساطيل|نقل الأثاث/gi },
  { category: "Travel & tourism", pattern: /\b(travel agency|tourism|tour operator|tour operators|travel packages|airline|airlines|flight booking|cruises|travel insurance)\b|سياحة|سفر|وكالة سفر|وكالات سفر|منظم رحلات|باقات سفر|طيران|حجز رحلات|رحلات بحرية/gi },
  { category: "Sports & fitness", pattern: /\b(gym|gyms|fitness studio|personal trainer|sports club|sports equipment|fitness equipment|yoga studio|pilates studio|nutrition coaching)\b|نادي رياضي|نوادي رياضية|لياقة بدنية|مدرب شخصي|معدات رياضية|معدات لياقة|يوغا|بيلاتس|تغذية رياضية/gi },
  { category: "Telecommunications", pattern: /\b(telecommunications|telecom|internet service provider|ISP|mobile network|broadband|fiber internet|VoIP|telecom equipment)\b|اتصالات|شركة اتصالات|مزود إنترنت|شبكة هاتف محمول|إنترنت عريض النطاق|ألياف ضوئية|معدات اتصالات/gi },
  { category: "Pets & veterinary", pattern: /\b(veterinary|veterinarian|vet clinic|pet store|pet supplies|pet food|animal hospital|animal care)\b|بيطري|بيطرية|عيادة بيطرية|متجر حيوانات أليفة|مستلزمات حيوانات|طعام الحيوانات|مستشفى حيوانات/gi },
  { category: "Media & entertainment", pattern: /\b(media company|production studio|film production|music label|streaming service|entertainment|podcast network|game studio|video production)\b|إعلام|شركة إعلامية|استوديو إنتاج|إنتاج أفلام|شركة إنتاج|شركة موسيقى|خدمة بث|ترفيه|شبكة بودكاست|استوديو ألعاب|إنتاج فيديو/gi },
  { category: "Agriculture & farming", pattern: /\b(agriculture|agricultural equipment|farming|farm supplies|irrigation systems|agritech|seeds supplier|fertilizer|livestock|greenhouse)\b|زراعة|زراعي|معدات زراعية|مستلزمات مزارع|أنظمة ري|تقنيات زراعية|بذور|أسمدة|ماشية|بيوت محمية/gi },
  { category: "Energy & utilities", pattern: /\b(renewable energy|solar energy|solar panels|solar installation|wind energy|energy storage|power generation|electric utility|water utility|waste management)\b|طاقة متجددة|طاقة شمسية|ألواح شمسية|تركيب ألواح شمسية|طاقة رياح|تخزين الطاقة|توليد الكهرباء|مرافق كهرباء|مرافق مياه|إدارة النفايات/gi },
  { category: "Human resources & recruitment", pattern: /\b(recruitment agency|staffing agency|human resources|HR consultancy|headhunting|executive search|temporary staffing|payroll services)\b|توظيف|شركة توظيف|وكالة توظيف|موارد بشرية|استشارات موارد بشرية|استقطاب المواهب|بحث تنفيذي|توظيف مؤقت|خدمات الرواتب/gi },
  { category: "Events & wedding services", pattern: /\b(event planning|event planner|event management|wedding planner|wedding venue|conference organizer|exhibition services|party rental)\b|تنظيم فعاليات|منظم فعاليات|إدارة فعاليات|منظم حفلات زفاف|قاعة زفاف|منظم مؤتمرات|خدمات معارض|تأجير معدات حفلات/gi },
  { category: "Nonprofit & public organizations", pattern: /\b(nonprofit|non-profit|charity|charitable organization|NGO|non-governmental organization|foundation|public institution|government agency)\b|منظمة غير ربحية|جمعية خيرية|مؤسسة خيرية|منظمة غير حكومية|مؤسسة|جهة حكومية|مؤسسة عامة/gi },
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
