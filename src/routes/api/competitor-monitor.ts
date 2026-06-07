import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";

const COST = 2;

async function buildBaseline(brand: string, competitors: string[], lang: string) {
  const targets = [brand, ...competitors].slice(0, 6);
  const out: Record<string, { mentions: number; top: string[] }> = {};
  for (const t of targets) {
    try {
      const sr: any = await fcSearch(`"${t}"`, { limit: 8, lang });
      const items = sr?.data?.web || sr?.web || sr?.data || [];
      const list = Array.isArray(items) ? items : [];
      out[t] = { mentions: list.length, top: list.slice(0, 5).map((r: any) => String(r?.url || "")) };
    } catch {
      out[t] = { mentions: 0, top: [] };
    }
  }
  return out;
}

export const Route = createFileRoute("/api/competitor-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE) return Response.json({ error: "internal_error" }, { status: 500 });
        const admin = createClient(SUPABASE_URL, SERVICE);

        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data: userData } = await admin.auth.getUser(auth.slice(7));
        const userId = userData?.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
        const _chg = await chargeTokens({ userId, toolKey: "competitor_monitor" });
        if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

        const body = await request.json();
        const { action, id, brand, competitors = [], frequency_hours = 24, lang = "ar", scope } = body;

        if (action === "list") {
          const { data } = await admin.from("competitor_watch").select("*").eq("user_id", userId).order("created_at", { ascending: false });
          return Response.json({ items: data || [] });
        }

        if (action === "delete") {
          if (!id) return Response.json({ error: "id_required" }, { status: 400 });
          await admin.from("competitor_watch").delete().eq("id", id).eq("user_id", userId);
          return Response.json({ ok: true });
        }

        if (action === "create") {
          if (!brand || !Array.isArray(competitors) || competitors.length === 0) {
            return Response.json({ error: "brand_and_competitors_required" }, { status: 400 });
          }
          const { data: prof } = await admin.from("profiles").select("monthly_analyses_used,is_subscribed,quota_overrides").eq("id", userId).maybeSingle();
          const used = Number((prof as any)?.monthly_analyses_used || 0);
          const overrideLimit = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
          const limit = (prof as any)?.is_subscribed ? Math.max(100, overrideLimit) : Math.max(5, overrideLimit);
          if (!(prof as any)?.is_subscribed && limit - used < COST) {
            return Response.json({ error: "subscription_required" }, { status: 402 });
          }
          const baseline = await buildBaseline(brand, competitors, lang);
          const { data: row, error } = await admin.from("competitor_watch").insert({
            user_id: userId, brand, competitors, frequency_hours, scope, baseline, last_run_at: new Date().toISOString(),
          }).select().single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          await admin.from("profiles").update({ monthly_analyses_used: used + COST }).eq("id", userId);
          return Response.json({ item: row });
        }

        if (action === "recheck") {
          if (!id) return Response.json({ error: "id_required" }, { status: 400 });
          const { data: w } = await admin.from("competitor_watch").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
          if (!w) return Response.json({ error: "not_found" }, { status: 404 });
          const fresh = await buildBaseline((w as any).brand, (w as any).competitors as string[], lang);
          const baseline = (w as any).baseline || {};
          const newAlerts: any[] = [];
          for (const k of Object.keys(fresh)) {
            const prev = (baseline[k]?.mentions || 0);
            const now = fresh[k].mentions;
            const diff = now - prev;
            if (Math.abs(diff) >= 2 || (prev > 0 && Math.abs(diff / prev) >= 0.2)) {
              newAlerts.push({ at: new Date().toISOString(), target: k, prev, now, delta: diff });
            }
          }
          const alerts = [...newAlerts, ...((w as any).alerts || [])].slice(0, 50);
          await admin.from("competitor_watch").update({ baseline: fresh, last_run_at: new Date().toISOString(), alerts }).eq("id", id);

          // Insert per-alert notifications for the user
          if (newAlerts.length > 0) {
            const rows = newAlerts.map((a) => ({
              user_id: userId,
              watch_id: id,
              severity: Math.abs(a.delta) >= 5 ? "high" : "info",
              target: a.target,
              message: `تغيّر ظهور ${a.target}: ${a.prev} → ${a.now} (${a.delta > 0 ? "+" : ""}${a.delta})`,
              payload: a,
            }));
            await admin.from("competitor_alerts").insert(rows);
          }
          return Response.json({ alerts: newAlerts, baseline: fresh });
        }

        return Response.json({ error: "unknown_action" }, { status: 400 });
      },
    },
  },
});
