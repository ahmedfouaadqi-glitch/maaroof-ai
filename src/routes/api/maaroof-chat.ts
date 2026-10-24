// Maaroof chat mode. GET → history; POST { message, lang } → grounded reply; DELETE → clear.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function authed(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(auth.slice(7));
  return data.user?.id ? { admin: admin as any, userId: data.user.id } : null;
}

export const Route = createFileRoute("/api/maaroof-chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data } = await a.admin.from("maaroof_chat_messages").select("id, role, content, grounded, created_at").eq("user_id", a.userId).order("created_at", { ascending: true }).limit(100);
        const { data: prof } = await a.admin.from("profiles").select("is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", a.userId).maybeSingle();
        const p: any = prof || {};
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const { count } = await a.admin.from("maaroof_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", a.userId).eq("role", "user").gte("created_at", today.toISOString());
        const { chatQuota } = await import("@/lib/maaroof/chat-policy");
        const { isUnlimitedAccount } = await import("@/lib/tokens.server");
        const unlimited = await isUnlimitedAccount(a.userId);
        const { data: jobs } = await a.admin.from("maaroof_jobs").select("id, goal, status, created_at").eq("user_id", a.userId).eq("status", "completed").order("created_at", { ascending: false }).limit(15);
        return Response.json({ items: data ?? [], tasks: jobs ?? [], quota: chatQuota({ metered: Number(p.tokens_balance) > 0 || p.tokens_daily_limit != null || p.tokens_monthly_limit != null, subscribed: !!p.is_subscribed, todayUserMessages: count || 0, unlimited }) });
      },
      DELETE: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        await a.admin.from("maaroof_chat_messages").delete().eq("user_id", a.userId);
        return Response.json({ ok: true });
      },
      POST: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const { admin, userId } = a;
        const body = await request.json().catch(() => ({} as any));
        const message = String(body?.message || "").trim().slice(0, 2000);
        if (!message) return Response.json({ error: "message_required" }, { status: 400 });
        const lang = (["ar", "en", "ku"].includes(body?.lang) ? body.lang : "ar") as "ar" | "en" | "ku";
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
        // Optional task context: the user's own completed job goal + final result.
        let taskCtx: string[] = [];
        const taskId = typeof body?.task_id === "string" ? body.task_id : "";
        if (taskId) {
          const { data: job } = await admin.from("maaroof_jobs").select("goal").eq("id", taskId).eq("user_id", userId).maybeSingle();
          if (job) {
            const { data: fin } = await admin.from("maaroof_job_events").select("payload").eq("job_id", taskId).eq("event_type", "final").order("seq", { ascending: false }).limit(1);
            const txt = JSON.stringify((fin as any)?.[0]?.payload ?? "").slice(0, 3000);
            taskCtx = [`[task, evidence] ${String((job as any).goal).slice(0, 300)}`, `[task result] ${txt}`];
          }
        }

        // Knowledge actually held for this user — the only ground Maaroof speaks from.
        const [{ data: kf }, { data: iv }, { data: ws }, { data: hist }] = await Promise.all([
          admin.from("knowledge_facts").select("source, fact, confidence, created_at, expires_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(120),
          admin.from("knowledge_space_interviews").select("question, answer, answered_at, created_at").eq("user_id", userId).not("answer", "is", null).limit(60),
          admin.from("workspaces").select("name, space_kind").eq("owner_id", userId).limit(50),
          admin.from("maaroof_chat_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
        ]);
        const id = ownerIdentity(p);
        const conf = id.verified ? "evidence" : "unverified profile entry";
        const knowledge: string[] = [
          ...id.known.map((k) => `[profile, ${conf}] ${k}: ${typeof p[k] === "object" ? JSON.stringify(p[k]) : p[k]}`),
          ...(ws || []).map((w: any) => `[workspace] ${w.space_kind}: ${w.name}`),
          ...freshFacts((kf || []) as any[]).map((f: any) => `[${f.source}, ${f.confidence}] ${String(f.fact).slice(0, 300)}`),
          ...interviewFacts((iv || []) as any).map((f) => `[interview] ${f.fact.slice(0, 300)}`),
        ].slice(0, 120);
        knowledge.unshift(...taskCtx);

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } = await import("@/lib/lovable-ai");
        const { CHAT_MODEL_CHAIN, chatSamplingParams } = await import("@/lib/model-params");
        const history = ((hist || []) as any[]).reverse().map((m) => ({ role: m.role, content: m.content }));
        const msgs = [{ role: "system", content: groundedSystemPrompt(lang, knowledge) }, ...history, { role: "user", content: message }];
        let raw = ""; let lastErr = "ai_failed";
        for (const model of CHAT_MODEL_CHAIN) {
          try {
            const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
              method: "POST", headers: lovableAiHeaders(apiKey), signal: AbortSignal.timeout(90_000),
              body: JSON.stringify({ model, ...chatSamplingParams(model), messages: msgs }),
            });
            if (!res.ok) { lastErr = res.status === 429 ? "rate_limited" : res.status === 402 ? "credits" : "ai_failed"; continue; }
            const j: any = await res.json().catch(() => null);
            raw = String(j?.choices?.[0]?.message?.content || "").trim();
            if (raw) break;
          } catch { lastErr = "ai_failed"; }
        }
        if (!raw) return Response.json({ error: lastErr }, { status: 502 });
        const reply = parseReply(raw);
        try { const { brandModelIds } = await import("@/lib/maaroof/model-council"); reply.text = brandModelIds(reply.text, lang); } catch {}

        // Charge only after a successful reply, for metered non-approved accounts.
        if (metered && !unlimited) {
          const { chargeTokens, chargeFailureBody } = await import("@/lib/tokens.server");
          const charge = await chargeTokens({ userId, toolKey: "maaroof.chat", meta: { chars: message.length } });
          if (!charge.ok) return Response.json(chargeFailureBody(charge.reason, (charge as any).left), { status: 402 });
        }
        const grounded = { knowledge_items: knowledge.length, needs_task: reply.needsTask, task: reply.task };
        await admin.from("maaroof_chat_messages").insert([
          { user_id: userId, role: "user", content: message },
          { user_id: userId, role: "assistant", content: reply.text, grounded },
        ]);
        return Response.json({ text: reply.text, needs_task: reply.needsTask, task: reply.task, knowledge_items: knowledge.length, quota });
      },
    },
  },
});
