import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { extractDiscoveredSite, normalizePublicSiteUrl } from "@/lib/maaroof/site-intake";
import { fcScrape } from "@/lib/firecrawl";

/**
 * Explicitly approved, single-URL site discovery.
 * This endpoint reads only the supplied public URL; it does not load profile,
 * workspace, memory, client identity, or persist a discovered identity.
 */
export const Route = createFileRoute("/api/site-intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) {
          return Response.json({ error: "auth_required" }, { status: 401 });
        }
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "server_not_configured" }, { status: 500 });
        }
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const { data: authData } = await admin.auth.getUser(authorization.slice(7));
        const userId = authData.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

        const body = await request.json().catch(() => ({} as any));
        if (body?.approved !== true) {
          return Response.json({ error: "approval_required" }, { status: 400 });
        }
        const url = normalizePublicSiteUrl(String(body?.url || ""));
        if (!url) return Response.json({ error: "invalid_public_url" }, { status: 400 });

        try {
          const result: any = await fcScrape(url, { deep: true }, { userId, toolKey: "site_intake" });
          const page = result?.data ?? result;
          const metadata = page?.metadata || {};
          const discovery = extractDiscoveredSite(url, {
            title: metadata.title || "",
            description: metadata.description || "",
            markdown: page?.markdown || "",
            html: page?.html || "",
            statusCode: metadata.statusCode ?? null,
            source: result?.fetch_source || null,
          });
          if (!discovery) return Response.json({ error: "site_discovery_failed" }, { status: 422 });
          return Response.json({
            discovery,
            page_evidence: {
              has_markdown: Boolean(page?.markdown),
              has_html: Boolean(page?.html),
              has_json_ld: /application\/ld\+json/i.test(String(page?.html || "")),
              status_code: metadata.statusCode ?? null,
              fetch_source: result?.fetch_source || null,
            },
          });
        } catch (error: any) {
          const code = String(error?.readIssue || error?.name || "source_unavailable");
          return Response.json({ error: code }, { status: 502 });
        }
      },
    },
  },
});
