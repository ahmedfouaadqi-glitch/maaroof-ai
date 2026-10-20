// The seven account kinds. Pure. Each maps onto the base entity_type used by every tool.
export type AccountKind = "product_company" | "marketing_company" | "news_agency" | "content_creator" | "public_figure" | "individual" | "agency_with_clients";
type L = "ar" | "en" | "ku";

export const ACCOUNT_KINDS: { key: AccountKind; base: "organization" | "person" | "individual"; label: Record<L, string> }[] = [
  { key: "product_company", base: "organization", label: { ar: "شركة تبيع منتجاتها", en: "Product company", ku: "کۆمپانیای فرۆشتنی بەرهەم" } },
  { key: "marketing_company", base: "organization", label: { ar: "شركة تسويقية", en: "Marketing company", ku: "کۆمپانیای بازاڕگەری" } },
  { key: "news_agency", base: "organization", label: { ar: "وكالة إخبارية", en: "News agency", ku: "ئاژانسی هەواڵ" } },
  { key: "content_creator", base: "person", label: { ar: "صانع محتوى", en: "Content creator", ku: "دروستکەری ناوەڕۆک" } },
  { key: "public_figure", base: "person", label: { ar: "شخصية عامة", en: "Public figure", ku: "کەسایەتی گشتی" } },
  { key: "individual", base: "individual", label: { ar: "فرد", en: "Individual", ku: "تاک" } },
  { key: "agency_with_clients", base: "organization", label: { ar: "وكالة تسويقية لديها عملاء", en: "Agency with clients", ku: "ئاژانسی بازاڕگەری بە کڕیارەوە" } },
];

export function isAccountKind(v: unknown): v is AccountKind {
  return ACCOUNT_KINDS.some((k) => k.key === v);
}

export function kindToEntityType(kind: AccountKind): "organization" | "person" | "individual" {
  return ACCOUNT_KINDS.find((k) => k.key === kind)!.base;
}

const SOCIAL = /(instagram|tiktok|facebook|fb\.com|x\.com|twitter|youtube|youtu\.be|linkedin|snapchat|threads|telegram|t\.me)/i;

/** Honest presence notes: missing website / social accounts for the chosen kind. */
export function presenceNotes(links: string[], kind: AccountKind | null, lang: L): string[] {
  const list = links.map((s) => s.trim()).filter(Boolean);
  const hasSite = list.some((u) => !SOCIAL.test(u));
  const hasSocial = list.some((u) => SOCIAL.test(u));
  const out: string[] = [];
  const orgLike = kind ? kindToEntityType(kind) === "organization" : false;
  if (orgLike && !hasSite) out.push({ ar: "لا يوجد موقع رسمي؛ النماذج تعتمد عليه كثيراً للتحقق من المنشآت.", en: "No official website; models rely on it to verify organizations.", ku: "ماڵپەڕی فەرمی نییە؛ مۆدێلەکان بۆ پشتڕاستکردنەوە پشتی پێ دەبەستن." }[lang]);
  if (!hasSocial && kind !== "individual") out.push({ ar: "لا توجد حسابات تواصل؛ إضافتها تساعد في فك تشابه الأسماء.", en: "No social accounts; adding them helps separate you from similar names.", ku: "هەژماری تۆڕی کۆمەڵایەتی نییە؛ زیادکردنیان یارمەتی جیاکردنەوەی ناوە هاوشێوەکان دەدات." }[lang]);
  if (!list.length) out.push({ ar: "بلا روابط: سنبني هويتك من الصفر، وقد تخلط النماذج بينك وبين أسماء مشابهة في بلدان أخرى. حدّد بلدك وتخصصك بدقة.", en: "No links: we build your identity from scratch, and models may confuse you with similar names in other countries. Set your country and specialty precisely.", ku: "بێ بەستەر: ناسنامەت لە سفرەوە دروست دەکەین؛ وڵات و پسپۆڕیت بە وردی دیاری بکە." }[lang]);
  return out;
}
