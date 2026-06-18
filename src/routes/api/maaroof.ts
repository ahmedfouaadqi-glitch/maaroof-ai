// Maaroof streaming endpoint (SSE). POST { goal, lang?, geo_scope? }
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectGeoFromRequest, type GeoScope } from "@/lib/maaroof/geo.server";
import { runMaaroof } from "@/lib/maaroof/orchestrator.server";

export const Route = createFileRoute("/api/maaroof")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        if (!auth.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });

        const url = process.env.SUPABASE_URL!;
        const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!url || !srKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const admin = createClient(url, srKey, { auth: { persistSession: false } });
        const { data: u } = await admin.auth.getUser(auth.slice(7));
        const userId = u.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

        const body = await request.json().catch(() => ({} as any));
        const goal = String(body?.goal || "").trim();
        if (!goal) return Response.json({ error: "goal_required" }, { status: 400 });
        const lang = (body?.lang as "ar" | "en" | "ku") || "ar";
        const geoScope = (body?.geo_scope as GeoScope) || undefined;

        const detectedGeo = detectGeoFromRequest(request);
        const origin = new URL(request.url).origin;

        // Trial cap: 5 runs/day if user has no metering/subscription configured
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const { count } = await admin.from("maaroof_runs").select("id", { count: "exact", head: true })
          .eq("user_id", userId).gte("started_at", today.toISOString());
        const { data: prof } = await admin.from("profiles").select("is_subscribed, tokens_balance").eq("id", userId).maybeSingle();
        const paid = !!(prof as any)?.is_subscribed || Number((prof as any)?.tokens_balance) > 0;
        if (!paid && (count || 0) >= 5) {
          return Response.json({ error: "trial_limit", message: { ar: "تجاوزت 5 جلسات يومياً للتجربة.", en: "Daily trial limit (5) reached.", ku: "سنووری ڕۆژانە تەواو بووە." } }, { status: 402 });
        }

        const encoder = new TextEncoder();
        const abortCtl = new AbortController();
        request.signal.addEventListener("abort", () => abortCtl.abort());

        const stream = new ReadableStream({
          async start(controller) {
            const emit = async (event: string, data: any) => {
              try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch {}
            };
            try {
              await runMaaroof({
                userId, goal, language: lang, detectedGeo, geoScope,
                authBearer: auth, origin, emit, signal: abortCtl.signal,
              });
            } catch (e: any) {
              await emit("error", { message: String(e?.message || e) });
            } finally {
              try { controller.close(); } catch {}
            }
          },
          cancel() { abortCtl.abort(); },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
