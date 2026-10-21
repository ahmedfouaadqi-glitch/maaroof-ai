// Delegated read-only browser. Owner-only. Every step is checked against an
// explicit, time-limited grant and logged. Reads go through the platform server,
// never the user's own browser, cookies or sessions.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeDomain, isUrlAllowed, isGrantActive, clampMinutes, isForbiddenInstruction, allowedLinks,
  GRANT_MAX_DOMAINS, MAX_STEPS_PER_GRANT,
} from "@/lib/delegated-browser";

async function auth(request: Request) {
  const h = request.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(h.slice(7));
  return data.user?.id ? { db: admin as any, userId: data.user.id } : null;
}

export const Route = createFileRoute("/api/delegated-browser")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data: grants } = await a.db.from("browser_grants").select("*").eq("user_id", a.userId).order("created_at", { ascending: false }).limit(5);
        const active = (grants || []).find((g: any) => isGrantActive(g)) || null;
        let steps: any[] = [];
        if (active) {
          const { data } = await a.db.from("browser_steps").select("*").eq("grant_id", active.id).order("created_at", { ascending: true }).limit(MAX_STEPS_PER_GRANT);
          steps = data || [];
        }
        return Response.json({ grant: active, steps });
      },
      POST: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        const action = String(body?.action || "");

        if (action === "grant") {
          const domains = [...new Set((Array.isArray(body.domains) ? body.domains : []).map((d: unknown) => normalizeDomain(String(d))).filter(Boolean) as string[])].slice(0, GRANT_MAX_DOMAINS);
          if (!domains.length) return Response.json({ error: "no_valid_domains" }, { status: 400 });
          await a.db.from("browser_grants").update({ revoked: true }).eq("user_id", a.userId).eq("revoked", false);
          const expires_at = new Date(Date.now() + clampMinutes(body.minutes) * 60000).toISOString();
          const { data, error } = await a.db.from("browser_grants").insert({ user_id: a.userId, domains, purpose: String(body.purpose || "").slice(0, 300) || null, expires_at }).select("*").single();
          if (error) return Response.json({ error: "grant_failed" }, { status: 500 });
          return Response.json({ grant: data });
        }

        const { data: grant } = await a.db.from("browser_grants").select("*").eq("user_id", a.userId).eq("revoked", false).order("created_at", { ascending: false }).limit(1).maybeSingle();

        if (action === "revoke") {
          await a.db.from("browser_grants").update({ revoked: true }).eq("user_id", a.userId).eq("revoked", false);
          return Response.json({ ok: true });
        }

        if (action === "read") {
          if (!grant || !isGrantActive(grant)) return Response.json({ error: "no_active_grant" }, { status: 403 });
          const url = String(body.url || "").trim();
          const instruction = String(body.instruction || "").slice(0, 300);
          const log = async (row: Record<string, unknown>) => {
            const { data } = await a.db.from("browser_steps").insert({ grant_id: grant.id, user_id: a.userId, instruction, url: url.slice(0, 500), ...row }).select("*").single();
            return data;
          };
          if (isForbiddenInstruction(instruction)) return Response.json({ step: await log({ status: "refused", error: "forbidden_action" }) }, { status: 403 });
          if (!isUrlAllowed(url, grant.domains)) return Response.json({ step: await log({ status: "refused", error: "outside_grant" }) }, { status: 403 });
          const { count } = await a.db.from("browser_steps").select("id", { count: "exact", head: true }).eq("grant_id", grant.id);
          if ((count || 0) >= MAX_STEPS_PER_GRANT) return Response.json({ error: "step_limit" }, { status: 429 });

          try {
            const { fcScrape } = await import("@/lib/firecrawl");
            const res: any = await fcScrape(url, { deep: true }, { userId: a.userId, toolKey: "delegated_browser" });
            const d = res?.data || res || {};
            const md = String(d.markdown || "");
            const links = allowedLinks(d.links, grant.domains);
            const step = await log({ status: "ok", title: String(d.metadata?.title || "").slice(0, 200) || null, excerpt: md.slice(0, 1500), links_count: links.length });
            return Response.json({ step, links });
          } catch (e: any) {
            return Response.json({ step: await log({ status: "failed", error: String(e?.message || e).slice(0, 200) }) }, { status: 502 });
          }
        }
        return Response.json({ error: "bad_action" }, { status: 400 });
      },
    },
  },
});
