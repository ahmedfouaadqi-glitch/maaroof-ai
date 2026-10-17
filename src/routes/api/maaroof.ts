// Maaroof job submission endpoint. Both interfaces reconnect through persisted job events.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectGeoFromRequest, type GeoScope } from "@/lib/maaroof/geo.server";
import { MAAROOF_SKILLS, recommendMaaroofSkills, getSkillAccessMode } from "@/lib/maaroof/skill-catalog";
import { resolveSkillAccessPolicy, normalizePlanAccessKey } from "@/lib/maaroof/skill-access-policy";
import { enqueueMaaroofJob, hasMaaroofQueue } from "@/lib/request-ctx.server";
import { encryptJobToken } from "@/lib/maaroof/background-jobs.server";

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
        const interfaceMode = body?.interface_mode === "workspace" ? "workspace" : "professional";
        const [{ data: uiPolicyRow }, { data: userProfile }] = await Promise.all([
          admin.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle(),
          admin.from("profiles").select("subscription_tier,is_subscribed,subscription_expires_at").eq("id", userId).maybeSingle(),
        ]);
        const uiPolicy = (uiPolicyRow as any)?.value || {};
        const activeSubscription = !!(userProfile as any)?.is_subscribed &&
          (!(userProfile as any)?.subscription_expires_at || new Date((userProfile as any).subscription_expires_at).getTime() > Date.now());
        const planKey = activeSubscription ? normalizePlanAccessKey((userProfile as any)?.subscription_tier) : "";
        const availableInterfaces: string[] = Array.isArray(uiPolicy?.available_interfaces) ? uiPolicy.available_interfaces : uiPolicy?.enabled === false ? ["professional"] : ["workbench", "professional"];
        const requestedInterfaceKey = interfaceMode === "workspace" ? "workbench" : "professional";
        if (!hasMaaroofQueue()) {
          return Response.json({ error: "background_queue_not_configured" }, { status: 503 });
        }
        const [{ error: jobsTableError }, { error: eventsTableError }] = await Promise.all([
          admin.from("maaroof_background_jobs").select("id,auth_token_ciphertext").limit(1),
          admin.from("maaroof_background_job_events").select("seq").limit(1),
        ]);
        if (jobsTableError || eventsTableError) {
          return Response.json({ error: "background_jobs_migration_required" }, { status: 503 });
        }
        if (executionMode && Array.isArray(uiPolicy?.allowed_modes) && !uiPolicy.allowed_modes.includes(executionMode)) {
          return Response.json({ error: "execution_mode_disabled" }, { status: 403 });
        }
        let effectiveSkillKeys: string[] = [];
        if (!availableInterfaces.includes(requestedInterfaceKey)) return Response.json({ error: "interface_disabled" }, { status: 403 });
        if (interfaceMode === "workspace") {
          const allowedSkills = Array.isArray(uiPolicy?.enabled_skills) ? uiPolicy.enabled_skills : MAAROOF_SKILLS.map((skill) => skill.key);
          const accessPolicy = resolveSkillAccessPolicy({
            globalPolicy: uiPolicy?.skill_access && typeof uiPolicy.skill_access === "object" ? uiPolicy.skill_access : {},
            byPlan: uiPolicy?.skill_access_by_plan && typeof uiPolicy.skill_access_by_plan === "object" ? uiPolicy.skill_access_by_plan : {},
            byUser: uiPolicy?.skill_access_by_user && typeof uiPolicy.skill_access_by_user === "object" ? uiPolicy.skill_access_by_user : {},
            planKey,
            userId,
          });
          const requestedSkills = Array.isArray(body?.selected_skills) ? [...new Set(body.selected_skills.filter((key: unknown): key is string => typeof key === "string"))] : [];
          const requestedMode = requestedSkills.map((key) => MAAROOF_SKILLS.find((skill) => skill.key === key)).filter(Boolean);
          if (requestedSkills.some((key: string) => !allowedSkills.includes(key) || !MAAROOF_SKILLS.some((skill) => skill.key === key) || getSkillAccessMode(MAAROOF_SKILLS.find((skill) => skill.key === key)!, accessPolicy) === "disabled")) return Response.json({ error: "skill_disabled" }, { status: 403 });
          if (requestedMode.some((skill) => skill && getSkillAccessMode(skill, accessPolicy) === "contact")) return Response.json({ error: "sales_contact_required", contact_url: "/contact" }, { status: 403 });
          const validKeys = new Set(MAAROOF_SKILLS.map((skill) => skill.key));
          effectiveSkillKeys = requestedSkills.length
            ? requestedSkills.filter((key) => validKeys.has(key))
            : recommendMaaroofSkills(goal, 3).map((skill) => skill.key).filter((key) => allowedSkills.includes(key) && getSkillAccessMode(MAAROOF_SKILLS.find((skill) => skill.key === key)!, accessPolicy) === "self_service");
        }

        // Verify workspace ownership if provided.
        let verifiedWorkspaceId: string | null = null;
        if (workspaceId) {
          const { data: ws } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (ws) verifiedWorkspaceId = workspaceId;
        }

        const useSubagents = body?.use_subagents === false ? false : undefined;
        const liveProbe = body?.live_probe === false ? false : undefined;
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

        const authTokenCiphertext = await encryptJobToken(auth, srKey);
        const { data: job, error: jobError } = await admin.from("maaroof_background_jobs").insert({
            user_id: userId,
            workspace_id: verifiedWorkspaceId,
            goal,
            language: lang,
            mode: executionMode || "execution",
            status: "queued",
            auth_token_ciphertext: authTokenCiphertext,
            request_payload: {
              geo_scope: geoScope || null,
              detected_geo: detectedGeo || null,
              origin,
              selected_skills: interfaceMode === "workspace" ? effectiveSkillKeys : null,
              live_probe: liveProbe !== false,
              use_subagents: useSubagents !== false,
              clarifications,
              interface_mode: interfaceMode,
            },
          }).select("id").single();
          if (jobError || !job?.id) return Response.json({ error: "job_persist_failed" }, { status: 500 });
          const jobId = String(job.id);
          await admin.from("maaroof_background_job_events").insert({
            job_id: jobId, user_id: userId, event_type: "queued", payload: { goal, status: "queued" },
          });
          try {
            const enqueued = await enqueueMaaroofJob(jobId);
            if (!enqueued) throw new Error("background_queue_not_configured");
          } catch (error) {
            const message = String((error as any)?.message || "background_enqueue_failed");
            await admin.from("maaroof_background_jobs").update({
              status: "failed", auth_token_ciphertext: null, error: message, finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq("id", jobId).eq("user_id", userId);
            await admin.from("maaroof_background_job_events").insert({
              job_id: jobId, user_id: userId, event_type: "error", payload: { message },
            });
            return Response.json({ error: "background_enqueue_failed", job_id: jobId }, { status: 503 });
          }
          return Response.json({ job_id: jobId, status: "queued" }, { status: 202 });

      },
    },
  },
});
