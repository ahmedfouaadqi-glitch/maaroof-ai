const BASE_URL = "https://maaroofai.com";

export type PublicSitemapEntry = {
  path: string;
  changefreq: "weekly" | "monthly" | "yearly";
  priority: string;
};

/**
 * Only stable, anonymous, public marketing/editorial pages belong here.
 * Authenticated routes, API endpoints and database-backed dynamic pages are
 * intentionally excluded. Dynamic public profiles/pages can be reintroduced
 * after the separate Supabase/Lovable review.
 */
export const PUBLIC_SITEMAP_ENTRIES: readonly PublicSitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "weekly", priority: "0.9" },
  { path: "/guide", changefreq: "weekly", priority: "0.8" },
  { path: "/guide/geo-vs-aeo", changefreq: "monthly", priority: "0.7" },
  { path: "/guide/what-is-geo", changefreq: "monthly", priority: "0.8" },
  { path: "/guide/arabic-kurdish-geo", changefreq: "monthly", priority: "0.7" },
  { path: "/methodology", changefreq: "monthly", priority: "0.7" },
  { path: "/markets", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
] as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildPublicSitemapXml(): string {
  const urls = PUBLIC_SITEMAP_ENTRIES.map((entry) => [
    "  <url>",
    `    <loc>${escapeXml(BASE_URL + entry.path)}</loc>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    "  </url>",
  ].join("\n"));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
