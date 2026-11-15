/** Old or duplicate public brand-card slugs and the canonical slug they now point to. */
export const BRAND_SLUG_ALIASES: Record<string, string> = {
  "جيو-العراق": "maaroof-ai",
  "maaroof-ai-ec917124": "maaroof-ai",
};

export function canonicalBrandSlug(slug: string): string | null {
  return BRAND_SLUG_ALIASES[slug] ?? null;
}
