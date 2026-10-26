// Maaroof chat mode. GET → history; POST { message, lang } → grounded reply; DELETE → clear.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectGeoFromRequest, effectiveGeo, normalizeGeoScope } from "@/lib/maaroof/geo.server";
import { buildFiveAxisAuditGoal, detectFiveAxisAuditRequest, fiveAxisAuditReply } from "@/lib/maaroof/chat-axis-audit";

async function authed(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(auth.slice(7));
  return data.user?.id ? { admin: admin as any, userId: data.user.id } : null;
}

async function resolveWorkspace(db: any, userId: string, raw: unknown): Promise<{ id: string | null; error?: string }> {
  if (raw == null || raw === "") return { id: null };
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) return { id: null, error: "invalid_workspace" };
  const { data } = await db.from("workspaces").select("id").eq("id", raw).eq("owner_id", userId).maybeSingle();
  return data ? { id: data.id } : { id: null, error: "workspace_not_found" };
}
function scopeWorkspace(query: any, workspaceId: string | null) {
  return workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
}

export const Route = createFileRoute("/api/maaroof-chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const workspace = await resolveWorkspace(a.admin, a.userId, new URL(request.url).searchParams.get("workspace_id"));
        if (workspace.error) return Response.json({ error: workspace.error }, { status: 400 });
        const { data } = await scopeWorkspace(a.admin.from("maaroof_chat_messages").select("id, role, content, grounded, created_at").eq("user_id", a.userId), workspace.id).order("created_at", { ascending: true }).limit(100);
        const { data: prof } = await a.admin.from("profiles").select("is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", a.userId).maybeSingle();
        const p: any = prof || {};
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const { count } = await a.admin.from("maaroof_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", a.userId).eq("role", "user").gte("created_at", today.toISOString());
        const { chatQuota } = await import("@/lib/maaroof/chat-policy");
        const { isUnlimitedAccount } = await import("@/lib/tokens.server");
        const unlimited = await isUnlimitedAccount(a.userId);
        const { data: jobs } = await scopeWorkspace(a.admin.from("maaroof_jobs").select("id, goal, status, created_at").eq("user_id", a.userId).eq("status", "completed"), workspace.id).order("created_at", { ascending: false }).limit(15);
        return Response.json({ items: data ?? [], tasks: jobs ?? [], quota: chatQuota({ metered: Number(p.tokens_balance) > 0 || p.tokens_daily_limit != null || p.tokens_monthly_limit != null, subscribed: !!p.is_subscribed, todayUserMessages: count || 0, unlimited }) });
      },
      DELETE: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const workspace = await resolveWorkspace(a.admin, a.userId, new URL(request.url).searchParams.get("workspace_id"));
        if (workspace.error) return Response.json({ error: workspace.error }, { status: 400 });
        await scopeWorkspace(a.admin.from("maaroof_chat_messages").delete().eq("user_id", a.userId), workspace.id);
        return Response.json({ ok: true });
      },
      POST: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const { admin, userId } = a;
        const body = await request.json().catch(() => ({} as any));
        const workspace = await resolveWorkspace(admin, userId, body?.workspace_id ?? new URL(request.url).searchParams.get("workspace_id"));
        if (workspace.error) return Response.json({ error: workspace.error }, { status: 400 });
        const workspaceId = workspace.id;
        const message = String(body?.message || "").trim().slice(0, 2000);
        if (!message) return Response.json({ error: "message_required" }, { status: 400 });
        const lang = (["ar", "en", "ku"].includes(body?.lang) ? body.lang : "ar") as "ar" | "en" | "ku";
        const axisAuditRequest = detectFiveAxisAuditRequest(message);
        const geoScope = normalizeGeoScope(body?.geo_scope);
        const geo = effectiveGeo(detectGeoFromRequest(request), geoScope);
        const { chatAllowed, parseReply, groundedSystemPrompt } = await import("@/lib/maaroof/chat-policy");
        const { ownerIdentity, freshFacts, interviewFacts } = await import("@/lib/knowledge-facts");

        const { data: prof } = await admin.from("profiles").select("full_name, brand_name, account_kind, specialty, hq_country, target_markets, entity_links, entity_verified_at, is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", userId).maybeSingle();
        const p: any = prof || {};
        const metered = Number(p.tokens_balance) > 0 || p.tokens_daily_limit != null || p.tokens_monthly_limit != null;
        const { isUnlimitedAccount } = await import("@/lib/tokens.server");
        const unlimited = await isUnlimitedAccount(userId);
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const { count } = await admin.from("maaroof_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", today.toISOString());
        if (!chatAllowed({ metered, subscribed: !!p.is_subscribed, todayUserMessages: count || 0, unlimited })) {
          return Response.json({ error: "chat_limit" }, { status: 402 });
        }
        const { chatQuota } = await import("@/lib/maaroof/chat-policy");
        const quota = chatQuota({ metered, subscribed: !!p.is_subscribed, todayUserMessages: (count || 0) + 1, unlimited });
        // Optional context from any earlier task owned by this user, including tasks in
        // another workspace. The selected task ID is supplied explicitly by the UI.
        let taskCtx: string[] = [];
        const taskId = typeof body?.task_id === "string" ? body.task_id : "";
        if (taskId && /^[0-9a-f-]{36}$/i.test(taskId)) {
          const { data: job } = await admin.from("maaroof_jobs")
            .select("goal, status")
            .eq("id", taskId).eq("user_id", userId).maybeSingle();
          if (job) {
            const { data: recorded } = await admin.from("maaroof_job_events")
              .select("event_type, payload, seq").eq("job_id", taskId).eq("user_id", userId)
              .in("event_type", ["final", "tool_result", "error", "phase"])
              .order("seq", { ascending: true }).limit(100);
            const relevant = ((recorded || []) as any[])
              .filter((e) => e.event_type !== "tool_result" || e.payload?.ok === true)
              .slice(-12)
              .map((e) => `${e.event_type}: ${JSON.stringify(e.payload || {}).slice(0, 450)}`)
              .join("\n").slice(0, 3600);
            taskCtx = [
              `[previous task] goal=${String((job as any).goal || "").slice(0, 500)}; status=${String((job as any).status || "unknown")}`,
              relevant ? `[recorded previous task events and evidence]\n${relevant}` : "[recorded previous task events] No useful tool results were saved; do not assume the task succeeded.",
            ];
          }
        }

        // Knowledge actually held for this user — the only ground Maaroof speaks from.
        const [{ data: kf }, { data: iv }, { data: ws }, { data: hist }] = await Promise.all([
          scopeWorkspace(admin.from("knowledge_facts").select("source, fact, confidence, created_at, expires_at").eq("user_id", userId), workspaceId).order("created_at", { ascending: false }).limit(120),
          workspaceId ? Promise.resolve({ data: [] as any[] }) : admin.from("knowledge_space_interviews").select("question, answer, answered_at, created_at").eq("user_id", userId).not("answer", "is", null).limit(60),
          workspaceId ? admin.from("workspaces").select("name, space_kind, profile, goals, entity_truth_card, onboarding, settings, brand_url, brand_summary, keywords, country, city").eq("owner_id", userId).eq("id", workspaceId).limit(1) : Promise.resolve({ data: [] as any[] }),
          scopeWorkspace(admin.from("maaroof_chat_messages").select("role, content").eq("user_id", userId), workspaceId).order("created_at", { ascending: false }).limit(40),
        ]);
        const id = ownerIdentity(p);
        const conf = id.verified ? "evidence" : "unverified profile entry";
        const knowledge: string[] = [
          ...(!workspaceId ? id.known.map((k) => `[profile, ${conf}] ${k}: ${typeof p[k] === "object" ? JSON.stringify(p[k]) : p[k]}`) : []),
          ...(ws || []).map((w: any) => `[workspace identity — user-entered, not independently verified] ${w.space_kind}: ${w.name}; profile=${JSON.stringify(w.profile || {})}; truth_card=${JSON.stringify(w.entity_truth_card || {})}; onboarding=${JSON.stringify(w.onboarding || {})}; settings=${JSON.stringify(w.settings || {})}; goals=${JSON.stringify(w.goals || [])}; website=${w.brand_url || ""}; sector=${w.brand_summary || ""}; keywords=${JSON.stringify(w.keywords || [])}; country=${w.country || ""}; city=${w.city || ""}`),
          ...freshFacts((kf || []) as any[]).map((f: any) => `[${f.source}, ${f.confidence}] ${String(f.fact).slice(0, 300)}`),
          ...interviewFacts((iv || []) as any).map((f) => `[interview] ${f.fact.slice(0, 300)}`),
        ].slice(0, 120);
        knowledge.unshift(
          `[geographic scope] ${geo.label}; country=${geo.country || "not resolved"}; city=${geo.city || "not resolved"}. Respect this selected scope. If visitor location is unavailable, do not infer or invent a country.`,
          ...taskCtx,
        );

        let reply: { text: string; needsTask: boolean; task: { kind: "scan" | "plan" | "recommend" | "simulate"; goal: string } | null };
        const { openRouterChat, detectCouncilRequest } = await import("@/lib/maaroof/openrouter.server");
        if (!axisAuditRequest && detectCouncilRequest(message)) {
          // Ten-engine council runs as a real approved task (live probe, charged only for answering engines).
          const t = lang === "en"
            ? "I can ask all ten Maaroof engines now: each one gets the same unbiased question, then an evidence check. You'll see every engine's status, answer, real sources and the conflict resolution. Approve to start."
            : lang === "ku"
              ? "دەتوانم ئێستا پرسیار لە هەر دە بزوێنەری معروف بکەم و وەڵام و سەرچاوە ڕاستەقینەکان پیشان بدەم. بۆ دەستپێکردن پەسەندی بکە."
              : "يمكنني الآن سؤال محركات معروف العشرة: سؤال محايد واحد لكل محرك ثم تحقق بالأدلة، وستظهر حالة كل محرك وإجابته ومصادره الحقيقية وحسم التعارض. وافق للبدء.";
          reply = { text: t, needsTask: true, task: { kind: "scan", goal: `${message}\n\n[visibility: probe all ten engines]` } };
        } else if (axisAuditRequest) {
          // This is an explicit user request for a live audit. Return an exact, localized task draft;
          // no live tools are run here, and the existing workspace approval/cost review still applies.
          reply = { text: fiveAxisAuditReply(lang), needsTask: true, task: { kind: "scan", goal: buildFiveAxisAuditGoal(lang) } };
        } else {
          const apiKey = process.env.LOVABLE_API_KEY;
          const { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } = await import("@/lib/lovable-ai");
          const { CHAT_MODEL_CHAIN, chatSamplingParams } = await import("@/lib/model-params");
          const history = ((hist || []) as any[]).reverse().map((m) => ({ role: m.role, content: m.content }));
          const msgs = [{ role: "system", content: groundedSystemPrompt(lang, knowledge) }, ...history, { role: "user", content: message }];
          // OpenRouter is primary; the existing gateway chain is the fallback.
          let raw = await openRouterChat(msgs); let lastErr = "ai_failed";
          if (!raw && !apiKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
          for (const model of raw ? [] : CHAT_MODEL_CHAIN) {
            try {
              const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
                method: "POST", headers: lovableAiHeaders(apiKey!), signal: AbortSignal.timeout(90_000),
                body: JSON.stringify({ model, ...chatSamplingParams(model), messages: msgs }),
              });
              if (!res.ok) { lastErr = res.status === 429 ? "rate_limited" : res.status === 402 ? "credits" : "ai_failed"; continue; }
              const j: any = await res.json().catch(() => null);
              raw = String(j?.choices?.[0]?.message?.content || "").trim();
              if (raw) break;
            } catch { lastErr = "ai_failed"; }
          }
          if (!raw) return Response.json({ error: lastErr }, { status: 502 });
          reply = parseReply(raw);
          try { const { brandModelIds } = await import("@/lib/maaroof/model-council"); reply.text = brandModelIds(reply.text, lang); } catch {}
        }

        // Charge only after a successful reply, for metered non-approved accounts.
        if (metered && !unlimited) {
          const { chargeTokens, chargeFailureBody } = await import("@/lib/tokens.server");
          const charge = await chargeTokens({ userId, toolKey: "maaroof.chat", meta: { chars: message.length } });
          if (!charge.ok) return Response.json(chargeFailureBody(charge.reason, (charge as any).left), { status: 402 });
        }
        const grounded = { knowledge_items: knowledge.length, needs_task: reply.needsTask, task: reply.task, geo_scope: geo, axis_audit_request: axisAuditRequest };
        await admin.from("maaroof_chat_messages").insert([
          { user_id: userId, workspace_id: workspaceId, role: "user", content: message },
          { user_id: userId, workspace_id: workspaceId, role: "assistant", content: reply.text, grounded },
        ]);
        return Response.json({ text: reply.text, needs_task: reply.needsTask, task: reply.task, axis_audit_request: axisAuditRequest, knowledge_items: knowledge.length, quota });
      },
    },
  },
});
