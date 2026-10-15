// Architecture & Concept: Ahmed Maaroof
// Pure SEO / AEO / GEO score from data already stored locally. Zero cost.
// A layer with no evidence returns score=null ("not measured yet") — never a guessed number.

export type TrinityInput = {
  crawlers?: { googlebot?: number; bingbot?: number; aiBots?: number } | null;
  hasLlmsTxt?: boolean | null;
  hasSitemap?: boolean | null;
  entity?: { brand_name?: string | null; entity_type?: string | null; hq_country?: string | null; target_markets?: any; specialty_scope?: string | null; entity_links?: any; entity_verified?: boolean | null } | null;
  probe?: { mentioned: number; total: number } | null;
};
export type Layer = { score: number | null; reasons: string[] };
export type Trinity = { seo: Layer; aeo: Layer; geo: Layer };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function trinityScore(i: TrinityInput): Trinity {
  // SEO — technical foundation
  const seoR: string[] = []; let seo: number | null = null;
  const c = i.crawlers;
  if (c || i.hasLlmsTxt != null || i.hasSitemap != null) {
    let s = 0;
    if ((c?.googlebot || 0) > 0) { s += 35; seoR.push("Googlebot زار صفحاتك"); } else seoR.push("لم تُسجَّل زيارة Googlebot");
    if ((c?.bingbot || 0) > 0) { s += 15; seoR.push("Bingbot زار صفحاتك"); }
    if ((c?.aiBots || 0) > 0) { s += 20; seoR.push("زواحف ذكاء اصطناعي زارت صفحاتك"); } else seoR.push("لم تُسجَّل زيارة زواحف ذكاء اصطناعي");
    if (i.hasSitemap) { s += 15; seoR.push("خريطة الموقع موجودة"); }
    if (i.hasLlmsTxt) { s += 15; seoR.push("ملف llms.txt موجود"); }
    seo = clamp(s);
  }
  // AEO — extractable identity
  const aeoR: string[] = []; let aeo: number | null = null;
  const e = i.entity;
  if (e && (e.brand_name || e.entity_type)) {
    const checks: [boolean, string, string][] = [
      [!!e.brand_name, "الاسم محدد", "الاسم غير محدد"],
      [!!e.entity_type, "نوع الكيان محدد", "نوع الكيان غير محدد"],
      [!!e.hq_country, "المقر محدد", "المقر غير محدد"],
      [Array.isArray(e.target_markets) ? e.target_markets.length > 0 : !!e.target_markets, "الأسواق المستهدفة محددة", "الأسواق المستهدفة غير محددة"],
      [!!e.specialty_scope, "التخصص محدد", "التخصص غير محدد"],
      [Array.isArray(e.entity_links) && e.entity_links.length > 0, "روابط رسمية مضافة", "لا روابط رسمية"],
      [!!e.entity_verified, "البطاقة موثقة", "البطاقة غير موثقة"],
    ];
    aeo = clamp((checks.filter((x) => x[0]).length / checks.length) * 100);
    for (const [ok, y, n] of checks) aeoR.push(ok ? y : n);
  }
  // GEO — measured live answers only
  const geoR: string[] = []; let geo: number | null = null;
  if (i.probe && i.probe.total > 0) {
    geo = clamp((i.probe.mentioned / i.probe.total) * 100);
    geoR.push(`ذُكرت في ${i.probe.mentioned} من ${i.probe.total} نماذج في آخر فحص حي`);
  }
  return { seo: { score: seo, reasons: seoR }, aeo: { score: aeo, reasons: aeoR }, geo: { score: geo, reasons: geoR } };
}
