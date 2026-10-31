import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { workspaceGuard } from "@/lib/workspace-guard.server";
import { discoverFromSite } from "@/lib/site-discovery";

/** Free read of the official home page: social links and headings tagged verified/inferred/unverified. */
export const Route = createFileRoute("/api/site-discovery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
        const userId = await resolveAuthenticatedUserId(request, admin);
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({}));
        const denied = await workspaceGuard(admin, userId, body);
        if (denied) return denied;
        let url: URL;
        try { url = new URL(String(body?.url || "")); if (!/^https?:$/.test(url.protocol)) throw 0; }
        catch { return Response.json({ error: "invalid_url" }, { status: 400 }); }
        const known = Array.isArray(body?.known_socials) ? body.known_socials.map(String).slice(0, 20) : [];
        try {
          const { fcScrape } = await import("@/lib/firecrawl");
          const r: any = await fcScrape(url.toString(), { allowDirectHttp: false });
          const d = r?.data ?? r ?? {};
          const items = discoverFromSite({ links: d.links || [], markdown: d.markdown || "", knownSocials: known });
          return Response.json({ ok: true, url: url.toString(), items });
        } catch (e: any) {
          console.error("[site-discovery] read failed", e?.message);
          return Response.json({ ok: false, error: "site_unreadable", items: discoverFromSite({ links: [], knownSocials: known }) }, { status: 502 });
        }
      },
    },
  },
});
