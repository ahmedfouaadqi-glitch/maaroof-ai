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
        const executionMode = (["simulation","recommendation","execution"] as const).includes(body?.execution_mode) ? body.execution_mode as "simulation"|"recommendation"|"execution" : undefined;

        // Verify workspace ownership if provided.
        let verifiedWorkspaceId: string | null = null;
        if (workspaceId) {
          const { data: ws } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (ws) verifiedWorkspaceId = workspaceId;
        }

        const useSubagents = body?.use_subagents === false ? false : undefined;
        const liveProbe = body?.live_probe === false ? false : undefined;
        const { ENGINE_KEYS } = await import("@/lib/ai-engines");
        const requestedProbeEngines = Array.isArray(body?.probe_engines)
          ? [...new Set(body.probe_engines.filter((v: unknown): v is string => typeof v === "string" && (ENGINE_KEYS as readonly string[]).includes(v)))]
          : undefined;
        let selectedProbeEngines = requestedProbeEngines;
        const clarifications: Record<string, string> = {};
        if (body?.clarifications && typeof body.clarifications === "object") {
          for (const [k, v] of Object.entries(body.clarifications).slice(0, 10)) if (typeof v === "string") clarifications[String(k).slice(0, 40)] = v.slice(0, 200);
        }
        const detectedGeo = detectGeoFromRequest(request);
        const origin = new URL(request.url).origin;

        // Plan/token gate — treats Maaroof as a regular tool.
        const { chargeTokens, chargeFailureBody, resolveToolCost } = await import("@/lib/tokens.server");
        const priceKey = executionMode === "recommendation" || executionMode === "simulation" ? `maaroof.${executionMode}` : "maaroof";
        const cost = await resolveToolCost(userId, priceKey);
        const { data: prof } = await admin.from("profiles").select("is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", userId).maybeSingle();
        const hasMeter = Number((prof as any)?.tokens_balance) > 0 || (prof as any)?.tokens_daily_limit != null || (prof as any)?.tokens_monthly_limit != null;

        if ((cost.source as any) === "disabled_by_admin") {
          return Response.json(chargeFailureBody("tool_disabled"), { status: 403 });
        }
        if (hasMeter) {
          const charge = await chargeTokens({ userId, toolKey: priceKey, meta: { goal: goal.slice(0, 200), mode: executionMode || "execution" } });
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

        // Server-authoritative engine selection. Both manual and automatic choices
        // are constrained by admin policy and the user's current plan/override.
        if (body?.live_probe !== false && (body?.auto_select_probe_engines === true || Array.isArray(body?.probe_engines))) {
          const { enginesAllowedForUser } = await import("@/lib/ai-engines.server");
          const { resolveProbePolicy } = await import("@/lib/tokens.server");
          const entitlement = await enginesAllowedForUser(admin, userId);
          const policy = await resolveProbePolicy(userId);
          const maxByPolicy = policy.maxEngines == null ? entitlement.limit : Math.min(entitlement.limit, policy.maxEngines);
          const eligible = entitlement.allowed.slice(0, Math.max(0, maxByPolicy));
          const { data: engineProfile } = await admin.from("profiles")
            .select("tokens_balance,tokens_daily_limit,tokens_monthly_limit")
            .eq("id", userId).maybeSingle();
          const hasEngineMeter = Number((engineProfile as any)?.tokens_balance) > 0 ||
            (engineProfile as any)?.tokens_daily_limit != null || (engineProfile as any)?.tokens_monthly_limit != null;
          const probeCost = await resolveToolCost(userId, "visibility.probe");
          const perEngineTokens = policy.tokensPerEngine ?? probeCost.tokens;

          if (body?.auto_select_probe_engines === true) {
            const { data: freshProfile } = await admin.from("profiles")
              .select("tokens_balance,tokens_daily_limit,tokens_monthly_limit,tokens_used_today,tokens_used_month")
              .eq("id", userId).maybeSingle();
            const hasFreshMeter = Number((freshProfile as any)?.tokens_balance) > 0 ||
              (freshProfile as any)?.tokens_daily_limit != null || (freshProfile as any)?.tokens_monthly_limit != null;
            let affordableCount = eligible.length;
            if (hasFreshMeter) {
              if (!(perEngineTokens > 0) || probeCost.source === "unpriced" || (probeCost as any).source === "disabled_by_admin") {
                affordableCount = 0;
              } else {
                const balanceCount = Math.floor(Math.max(0, Number((freshProfile as any)?.tokens_balance) || 0) / perEngineTokens);
                const dailyLimit = (freshProfile as any)?.tokens_daily_limit;
                const monthlyLimit = (freshProfile as any)?.tokens_monthly_limit;
                const dailyLeft = dailyLimit == null ? Number.POSITIVE_INFINITY : Math.max(0, Number(dailyLimit) - Number((freshProfile as any)?.tokens_used_today || 0));
                const monthlyLeft = monthlyLimit == null ? Number.POSITIVE_INFINITY : Math.max(0, Number(monthlyLimit) - Number((freshProfile as any)?.tokens_used_month || 0));
                affordableCount = Math.min(affordableCount, balanceCount, Math.floor(dailyLeft / perEngineTokens), Math.floor(monthlyLeft / perEngineTokens));
              }
            }
            selectedProbeEngines = eligible.slice(0, Math.max(0, Math.min(affordableCount, ENGINE_KEYS.length)));
          } else {
            const requested = requestedProbeEngines || [];
            selectedProbeEngines = requested.filter((engine) => eligible.includes(engine as any));
          }

          // Do not charge the probe here: the existing /api/visibility endpoint
          // performs the authoritative atomic charge immediately before provider calls.
          // This endpoint only selects the eligible engine count.
          if (!selectedProbeEngines?.length) {
            return Response.json({
              error: "probe_balance_or_entitlement_insufficient",
              message: {
                ar: "لا توجد محركات مسموحة ومغطاة بالرصيد وحدود الاستخدام لهذه الخطة. راجع إعدادات الاشتراك أو الرصيد.",
                en: "No engines are allowed and covered by the current plan, balance, and usage limits.",
                ku: "هیچ بزوێنەرێک لە پلانی ئێستا و بەڵانس و سنوورەکاندا بەردەست نییە.",
              },
            }, { status: 402 });
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
                userId, goal, language: lang, detectedGeo, geoScope, workspaceId: verifiedWorkspaceId,
                authBearer: auth, origin, emit, signal: abortCtl.signal, executionMode, useSubagents, liveProbe, selectedProbeEngines, clarifications,
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
