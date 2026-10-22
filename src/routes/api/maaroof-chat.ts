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
        return Response.json({ items: data ?? [] });
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
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const { count } = await admin.from("maaroof_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", today.toISOString());
        if (!chatAllowed({ metered, subscribed: !!p.is_subscribed, todayUserMessages: count || 0 })) {
          return Response.json({ error: "chat_limit" }, { status: 402 });
        }

        // Knowledge actually held for this user — the only ground Maaroof speaks from.
        const [{ data: kf }, { data: iv }, { data: ws }, { data: hist }] = await Promise.all([
          admin.from("knowledge_facts").select("source, fact, confidence, created_at, expires_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
          admin.from("knowledge_space_interviews").select("question, answer, answered_at, created_at").eq("user_id", userId).not("answer", "is", null).limit(30),
          admin.from("workspaces").select("name, space_kind").eq("owner_id", userId).limit(50),
          admin.from("maaroof_chat_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
        ]);
        const id = ownerIdentity(p);
        const conf = id.verified ? "evidence" : "unverified profile entry";
        const knowledge: string[] = [
          ...id.known.map((k) => `[profile, ${conf}] ${k}: ${typeof p[k] === "object" ? JSON.stringify(p[k]) : p[k]}`),
          ...(ws || []).map((w: any) => `[workspace] ${w.space_kind}: ${w.name}`),
          ...freshFacts((kf || []) as any[]).map((f: any) => `[${f.source}, ${f.confidence}] ${String(f.fact).slice(0, 300)}`),
          ...interviewFacts((iv || []) as any).map((f) => `[interview] ${f.fact.slice(0, 300)}`),
        ].slice(0, 60);

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
        const { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } = await import("@/lib/lovable-ai");
        const { INTERVIEW_FALLBACK_MODEL } = await import("@/lib/model-params");
        const history = ((hist || []) as any[]).reverse().map((m) => ({ role: m.role, content: m.content }));
        const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
          method: "POST", headers: lovableAiHeaders(apiKey),
          body: JSON.stringify({ model: INTERVIEW_FALLBACK_MODEL, max_tokens: 900, temperature: 0.3, messages: [{ role: "system", content: groundedSystemPrompt(lang, knowledge) }, ...history, { role: "user", content: message }] }),
        });
        if (!res.ok) return Response.json({ error: res.status === 429 ? "rate_limited" : res.status === 402 ? "credits" : "ai_failed" }, { status: 502 });
        const j: any = await res.json().catch(() => null);
        const raw = String(j?.choices?.[0]?.message?.content || "").trim();
        if (!raw) return Response.json({ error: "ai_failed" }, { status: 502 });
        const reply = parseReply(raw);

        // Charge only after a successful reply, for metered accounts.
        if (metered) {
          const { chargeTokens, chargeFailureBody } = await import("@/lib/tokens.server");
          const charge = await chargeTokens({ userId, toolKey: "maaroof.chat", meta: { chars: message.length } });
          if (!charge.ok) return Response.json(chargeFailureBody(charge.reason, (charge as any).left), { status: 402 });
        }
        const grounded = { knowledge_items: knowledge.length, needs_task: reply.needsTask };
        await admin.from("maaroof_chat_messages").insert([
          { user_id: userId, role: "user", content: message },
          { user_id: userId, role: "assistant", content: reply.text, grounded },
        ]);
        return Response.json({ text: reply.text, needs_task: reply.needsTask, knowledge_items: knowledge.length });
      },
    },
  },
});
