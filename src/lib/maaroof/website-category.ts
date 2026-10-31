/**
 * Derive an unbranded category descriptor from first-party website text.
 * This extracts supplied site text; it does not infer a sector from the brand name.
 */
export type OfficialSitePage = { title?: unknown; description?: unknown; markdown?: unknown; hostname?: unknown };
export type OfficialSiteCategory = { category: string; basis: "official_site_description" | "official_site_title" | "official_site_content" };

const clean = (value: unknown) => String(value ?? "")
  .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/https?:[/][/ ]?\S+/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/^#{1,6}\s*/gm, "")
  .replace(/[|*_>#]/g, " ")
  .replace(new RegExp(String.fromCharCode(96), "g"), " ")
  .replace(/\s+/g, " ")
  .trim();

function removeInsensitive(text: string, phrase: string): string {
  const needle = phrase.trim().toLocaleLowerCase();
  if (!needle) return text;
  let result = text;
  while (true) {
    const index = result.toLocaleLowerCase().indexOf(needle);
    if (index < 0) break;
    result = result.slice(0, index) + " " + result.slice(index + phrase.length);
  }
  return result;
}

function stripBrand(text: string, brandName?: string, hostname?: string): string {
  let result = removeInsensitive(text, String(brandName ?? ""));
  const host = String(hostname ?? "").replace(/^www[.]/i, "").trim();
  result = removeInsensitive(result, host);
  return result.replace(/\s+/g, " ").replace(/^[\s|:–—-]+|[\s|:–—-]+$/g, "").trim();
}

export function deriveOfficialSiteCategory(input: OfficialSitePage, brandName?: string): OfficialSiteCategory | null {
  const candidates: Array<{ text: string; basis: OfficialSiteCategory["basis"] }> = [
    { text: clean(input.description), basis: "official_site_description" },
    { text: clean(input.title), basis: "official_site_title" },
    { text: clean(input.markdown).slice(0, 1800), basis: "official_site_content" },
  ];
  for (const candidate of candidates) {
    const category = stripBrand(candidate.text, brandName, String(input.hostname ?? ""));
    if (category.split(/\s+/).filter(Boolean).length >= 3 && category.length >= 18) {
      return { category: category.slice(0, 320), basis: candidate.basis };
    }
  }
  return null;
}
