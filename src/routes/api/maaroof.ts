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

        const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
        const settings = await getMaaroofSettings();
        if (settings.kill_switch) {
          return Response.json({ error: "disabled", message: { ar: "تم تعطيل معروف مؤقتاً من قبل الإدارة.", en: "Maaroof is temporarily disabled by admin.", ku: "ماعروف بۆ کاتێک ناچالاککراوە." } }, { status: 503 });
        }

        const body = await request.json().catch(() => ({} as any));
        const goal = String(body?.goal || "").trim().slice(0, settings.max_goal_chars);
        if (!goal) return Response.json({ error: "goal_required" }, { status: 400 });
        const lang = (body?.lang as "ar" | "en" | "ku") || "ar";
        const geoScope = (body?.geo_scope as GeoScope) || undefined;
        const workspaceId = typeof body?.workspace_id === "string" && /^[0-9a-f-]{36}$/i.test(body.workspace_id) ? body.workspace_id : null;

        // Verify workspace ownership if provided.
        let verifiedWorkspaceId: string | null = null;
        if (workspaceId) {
          const { data: ws } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (ws) verifiedWorkspaceId = workspaceId;
        }

        const detectedGeo = detectGeoFromRequest(request);
        const origin = new URL(request.url).origin;

        // Plan/token gate — treats Maaroof as a regular tool.
        const { chargeTokens, chargeFailureBody, resolveToolCost } = await import("@/lib/tokens.server");
        const cost = await resolveToolCost(userId, "maaroof");
        const { data: prof } = await admin.from("profiles").select("is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", userId).maybeSingle();
        const hasMeter = Number((prof as any)?.tokens_balance) > 0 || (prof as any)?.tokens_daily_limit != null || (prof as any)?.tokens_monthly_limit != null;

        if ((cost.source as any) === "disabled_by_admin") {
          return Response.json(chargeFailureBody("tool_disabled"), { status: 403 });
        }
        if (hasMeter) {
          const charge = await chargeTokens({ userId, toolKey: "maaroof", meta: { goal: goal.slice(0, 200) } });
          if (!charge.ok) {
            const status = charge.reason === "unpriced" ? 402 : charge.reason === "balance" || charge.reason === "daily_limit" || charge.reason === "monthly_limit" ? 402 : 403;
            return Response.json(chargeFailureBody(charge.reason, (charge as any).left), { status });
          }
        } else {
          // Free-tier trial path: enforce daily session cap from admin settings
          const today = new Date(); today.setUTCHours(0, 0, 0, 0);
          const { count } = await admin.from("maaroof_runs").select("id", { count: "exact", head: true })
            .eq("user_id", userId).gte("started_at", today.toISOString());
          const paid = !!(prof as any)?.is_subscribed;
          if (!paid && (count || 0) >= settings.trial_daily_cap) {
            return Response.json({ error: "trial_limit", message: { ar: `تجاوزت ${settings.trial_daily_cap} جلسات يومياً للتجربة. اشترك للمزيد.`, en: `Daily trial limit (${settings.trial_daily_cap}) reached. Upgrade for more.`, ku: "سنووری ڕۆژانە تەواو بووە." } }, { status: 402 });
          }
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
