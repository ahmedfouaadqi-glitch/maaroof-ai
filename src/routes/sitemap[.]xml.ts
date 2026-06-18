import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://geoiraq.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/pricing", changefreq: "weekly", priority: "0.9" },
          { path: "/guide", changefreq: "weekly", priority: "0.8" },
          { path: "/guide/geo-vs-aeo", changefreq: "monthly", priority: "0.7" },
          { path: "/auth", changefreq: "monthly", priority: "0.5" },
          { path: "/dashboard", changefreq: "weekly", priority: "0.6" },
          { path: "/agent", changefreq: "weekly", priority: "0.6" },
          { path: "/maaroof", changefreq: "weekly", priority: "0.7" },
          { path: "/maaroof/memory", changefreq: "monthly", priority: "0.4" },
          { path: "/guide/arabic-kurdish-geo", changefreq: "monthly", priority: "0.7" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        // Add per-user public profile URLs so AI crawlers (and Google) discover them.
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (SUPABASE_URL && SERVICE) {
            const admin = createClient(SUPABASE_URL, SERVICE);
            const { data: users } = await admin
              .from("profiles")
              .select("username")
              .not("username", "is", null)
              .limit(5000);
            for (const u of users || []) {
              const name = String((u as any).username || "").trim();
              if (name) entries.push({ path: `/u/${name}`, changefreq: "weekly", priority: "0.5" });
            }
          }
        } catch {
          // Sitemap should still render even if DB is unreachable.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
