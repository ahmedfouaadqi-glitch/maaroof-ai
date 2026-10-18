export const ACCOUNT_TYPES = [
  { value: "individual", label: { ar: "فرد / استخدام شخصي", en: "Individual / personal", ku: "تاک / بەکارهێنانی کەسی" } },
  { value: "creator", label: { ar: "صانع محتوى / شخصية عامة", en: "Creator / public figure", ku: "دروستکەری ناوەڕۆک / کەسایەتی گشتی" } },
  { value: "business", label: { ar: "شركة / منشأة", en: "Company / business", ku: "کۆمپانیا / دامەزراوە" } },
  { value: "ecommerce", label: { ar: "متجر إلكتروني / تجارة", en: "E-commerce / retail", ku: "فرۆشگای ئۆنلاین / بازرگانی" } },
  { value: "agency", label: { ar: "وكالة / شركة خدمات", en: "Agency / service provider", ku: "ئاژانس / پێشکەشکاری خزمەتگوزاری" } },
  { value: "nonprofit", label: { ar: "منظمة غير ربحية / مجتمع", en: "Nonprofit / community", ku: "ڕێکخراوی ناحکومی / کۆمەڵگا" } },
  { value: "public_sector", label: { ar: "جهة حكومية / قطاع عام", en: "Government / public sector", ku: "دامەزراوەی حکومی / کەرتی گشتی" } },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

const ACCOUNT_TYPE_VALUES = new Set<string>(ACCOUNT_TYPES.map((item) => item.value));

/** Normalize untrusted or legacy profile values to a supported account type. */
export function normalizeAccountType(value: unknown): AccountType {
  const candidate = String(value ?? "").trim().toLowerCase();
  return ACCOUNT_TYPE_VALUES.has(candidate) ? candidate as AccountType : "individual";
}

export function accountTypeLabel(value: unknown, lang: "ar" | "en" | "ku" = "ar"): string {
  const key = normalizeAccountType(value);
  return ACCOUNT_TYPES.find((item) => item.value === key)!.label[lang];
}
