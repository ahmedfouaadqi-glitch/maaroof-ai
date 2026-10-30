import { workspaceGuard } from "@/lib/workspace-guard.server";
// Light website security check. POST { url } → checks + score. Charged only on success.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { isPublicUrl, looksExposed, buildChecks, securityScore, EXPOSED_PATHS } from "@/lib/security-scan";

const TOOL_KEY = "analyze.security_scan"; // falls back to the parent tool price
const T = 15_000;

async function get(url: string, method = "GET") {
  const r = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(T), headers: { "User-Agent": "MaaroofAi-SecurityCheck/1.0" } });
  return r;
}

export const Route = createFileRoute("/api/security-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const h = request.headers.get("authorization") || "";
        if (!h.startsWith("Bearer ")) return Response.json({ error: "unauthorized" }, { status: 401 });
        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
        const { data } = await admin.auth.getUser(h.slice(7));
        const userId = data.user?.id;
        if (!userId) { console.warn("[security-scan] denied: invalid token"); return Response.json({ error: "unauthorized" }, { status: 401 }); }
        const body = await request.json().catch(() => ({} as any));
        const workspaceDenied = await workspaceGuard(admin, userId, body);
        if (workspaceDenied) return workspaceDenied;
        let url = String(body?.url || "").trim().slice(0, 500);
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
        if (!isPublicUrl(url)) { console.warn("[security-scan] denied: non-public url", userId); return Response.json({ error: "bad_url" }, { status: 400 }); }

        let res: Response;
        try { res = await get(url); } catch { return Response.json({ error: "unreachable" }, { status: 502 }); }
        const finalUrl = res.url || url;
        if (!isPublicUrl(finalUrl)) return Response.json({ error: "bad_url" }, { status: 400 });
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        const html = (await res.text().catch(() => "")).slice(0, 400_000);
        const origin = new URL(finalUrl).origin;

        const exposed = (await Promise.all(EXPOSED_PATHS.map(async (p) => {
          try { const r = await get(origin + p); const t = (await r.text()).slice(0, 2000); return looksExposed(p, r.status, t) ? origin + p : null; } catch { return null; }
        }))).filter(Boolean) as string[];

        const links = Array.from(new Set(Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi)).map((m) => { try { return new URL(m[1], finalUrl).toString(); } catch { return ""; } }).filter((u) => /^https?:/.test(u) && isPublicUrl(u)))).slice(0, 15);
        const brokenLinks = (await Promise.all(links.map(async (l) => {
          try { const r = await get(l, "HEAD"); if (r.status === 405) { const g = await get(l); return g.status >= 400 ? { url: l, status: g.status } : null; } return r.status >= 400 ? { url: l, status: r.status } : null; } catch { return { url: l, status: 0 }; }
        }))).filter(Boolean) as { url: string; status: number }[];

        const checks = buildChecks({ finalUrl, headers, exposed, brokenLinks, checkedLinks: links.length });
        const score = securityScore(checks);
        const { chargeTokens } = await import("@/lib/tokens.server");
        const chg: any = await chargeTokens({ userId, toolKey: TOOL_KEY, meta: { url: finalUrl, score } });
        if (!chg.ok) return Response.json({ error: chg.reason || "insufficient" }, { status: 402 });
        return Response.json({ ok: true, url: finalUrl, score, checks, charged: chg.tokens || 0, balance: chg.balance });
      },
    },
  },
});
