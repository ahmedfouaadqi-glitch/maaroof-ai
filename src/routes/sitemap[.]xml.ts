import { createFileRoute } from "@tanstack/react-router";
import { buildPublicSitemapXml } from "@/lib/public-sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildPublicSitemapXml(), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "X-Content-Type-Options": "nosniff",
          },
        }),
    },
  },
});
